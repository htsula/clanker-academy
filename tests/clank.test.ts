import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { computeContentHash, openClank } from '../src/course/clank'
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

  it('was packed from exactly the fixture files — no build artifacts inside', () => {
    const entries = Object.keys(unzipSync(readFileSync(join(fixtureRoot, 'course.clank')))).sort()
    const expected = ['manifest.json', ...Object.keys(readFixtures()).filter((p) => p !== 'manifest.json')].sort()
    expect(entries).toEqual(expected)
    expect(entries).not.toContain('course.clank.b64')
    expect(entries).not.toContain('course.clank')
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

  it('refuses a file smuggled in alongside the expected set', async () => {
    const files = readFixtures()
    const clank = await buildClank(files)

    const tampered = unzipSync(clank)
    tampered['extra.txt'] = strToU8('smuggled')
    const result = await openClank(zipSync(tampered))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/integrity map does not cover every file/)
  })

  it('refuses an incomplete integrity map, even when every listed hash matches', async () => {
    const files = readFixtures()
    const clank = await buildClank(files)

    const tampered = unzipSync(clank)
    const manifest = JSON.parse(new TextDecoder().decode(tampered['manifest.json']))
    manifest.integrity = {}
    tampered['manifest.json'] = strToU8(JSON.stringify(manifest))
    const result = await openClank(zipSync(tampered))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/integrity map does not cover every file/)
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

  it('refuses a zip whose central directory declares a huge entry — before decompressing', async () => {
    const files = readFixtures()
    const clank = await buildClank(files)

    // Patch the FIRST central directory entry's uncompressed-size field
    // (offset +24) to 80 MiB, exactly as a zip bomb would. The budget reads
    // the central directory — the same structure fflate consumes — so it must
    // refuse here, not hand back a lazy "missing manifest" after decompressing.
    const tampered = new Uint8Array(clank)
    const eocd = findEocd(tampered)
    expect(eocd).toBeGreaterThan(-1)
    const centralOffset = readU32At(tampered, eocd + 16)
    tampered[centralOffset + 24] = 0x00
    tampered[centralOffset + 25] = 0x00
    tampered[centralOffset + 26] = 0x00
    tampered[centralOffset + 27] = 0x05 // 0x05000000 = 80 MiB

    const result = await openClank(tampered)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/exceeds the budget/)
  })

  it('does not trust local file header sizes — zeroing them changes nothing', async () => {
    const files = readFixtures()
    const clank = await buildClank(files)

    // Zero the uncompressed-size fields (offsets 18–25) of every local file
    // header. The old budget saw ~0 and passed; the central directory still
    // says the truth, so a small honest archive must still open.
    const tampered = new Uint8Array(clank)
    for (let i = 0; i + 30 <= tampered.length; i++) {
      if (
        tampered[i] === 0x50 &&
        tampered[i + 1] === 0x4b &&
        tampered[i + 2] === 0x03 &&
        tampered[i + 3] === 0x04
      ) {
        for (let j = 18; j <= 25; j++) tampered[i + j] = 0
      }
    }

    const result = await openClank(tampered)
    expect(result.ok).toBe(true)
  })
})

function findEocd(bytes: Uint8Array): number {
  const tailStart = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= tailStart; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i
  }
  return -1
}

function readU32At(bytes: Uint8Array, off: number): number {
  return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
}