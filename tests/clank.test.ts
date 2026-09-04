import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { base64ToBytes, computeContentHash, openClank } from '../src/course/clank'
import { sha256Hex } from '../src/course/hash'

const fixtureRoot = resolve(__dirname, '../src/fixtures')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (statSync(full).isFile()) out.push(full)
  }
  return out
}

function readFixtures(): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  for (const abs of walk(fixtureRoot)) {
    const rel = relative(fixtureRoot, abs).replaceAll('\\', '/')
    if (rel === 'course.clank' || rel === 'course.clank.b64') continue
    files[rel] = new Uint8Array(readFileSync(abs))
  }
  return files
}

async function buildClank(
  files: Record<string, Uint8Array>,
  manifestPatch: Record<string, unknown> = {},
): Promise<Uint8Array> {
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
  Object.assign(manifest, manifestPatch)

  const integrity: Record<string, string> = {}
  for (const [path, data] of Object.entries(files)) {
    if (path !== 'manifest.json') integrity[path] = await sha256Hex(data)
  }
  manifest.integrity = integrity
  manifest.content_hash = await computeContentHash(new Map(Object.entries(files)))

  const zipFiles: Record<string, Uint8Array> = {}
  for (const [path, data] of Object.entries(files)) {
    zipFiles[path] = path === 'manifest.json' ? strToU8(JSON.stringify(manifest)) : data
  }
  return zipSync(zipFiles, { level: 9 })
}

describe('the committed course.clank', () => {
  it('opens and yields three lessons with figures', async () => {
    const result = await openClank(readFileSync(join(fixtureRoot, 'course.clank')))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.course.lessons.map((l) => l.id)).toEqual(['L-001', 'L-002', 'L-003'])
    expect(result.course.figures.size).toBe(2)
    expect(result.course.manifest.course_id).toBeTruthy()
  })

  it('round-trips through base64', async () => {
    const b64 = readFileSync(join(fixtureRoot, 'course.clank.b64'), 'utf8')
    const fromB64 = base64ToBytes(b64)
    const result = await openClank(fromB64)
    expect(result.ok).toBe(true)
  })
})

describe('integrity verification', () => {
  it('refuses a file with one byte flipped inside a lesson', async () => {
    const files = readFixtures()
    const clank = await buildClank(files)

    const tampered = unzipSync(clank)
    const lesson = new TextDecoder().decode(tampered['lessons/L-001.json'])
    tampered['lessons/L-001.json'] = new TextEncoder().encode(
      lesson.replace('The Idea of a Limit', 'The Idea of a Limlt'),
    )
    const result = await openClank(zipSync(tampered))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/integrity mismatch for lessons\/L-001\.json/)
  })

  it('refuses content_hash mismatch when an extra file is added', async () => {
    const files = readFixtures()
    const clank = await buildClank(files)

    const tampered = unzipSync(clank)
    tampered['extra.txt'] = strToU8('smuggled')
    const result = await openClank(zipSync(tampered))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/content hash mismatch/)
  })
})

describe('schema validation at the boundary', () => {
  it('refuses a manifest missing a required field', async () => {
    const files = readFixtures()
    const clank = await buildClank(files, { course_id: undefined })

    const result = await openClank(clank)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/manifest\.json failed validation/)
  })

  it('refuses a zip with no lessons', async () => {
    const files = readFixtures()
    const withoutLessons: Record<string, Uint8Array> = {}
    for (const [path, data] of Object.entries(files)) {
      if (!path.startsWith('lessons/')) withoutLessons[path] = data
    }
    const clank = await buildClank(withoutLessons)

    const result = await openClank(clank)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/course has no lessons/)
  })

  it('refuses bytes that are not a zip', async () => {
    const result = await openClank(new Uint8Array([1, 2, 3, 4, 5]))
    expect(result).toEqual({ ok: false, reason: 'not a valid zip archive' })
  })
})