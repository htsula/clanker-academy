import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { packCourse } from '../scripts/pack-course.mjs'

// The build's deliverable is one .clank that a script reproduces from source
// (step 12, plan item 3) — and it must reproduce byte-for-byte on every OS.
// The .clank is a hashed, verifiable container, so the committed artifact and
// the manifest it carries must be exactly what packing the checked-out
// fixtures produces. This is what pins src/fixtures/** to LF in
// .gitattributes: a Windows checkout with CRLF text would hash differently.

const fixtureRoot = resolve(__dirname, '../src/fixtures')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (statSync(full).isFile()) out.push(full)
  }
  return out
}

function readSourceFiles(): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  for (const abs of walk(fixtureRoot)) {
    const rel = relative(fixtureRoot, abs).replaceAll('\\', '/')
    if (rel === 'course.clank' || rel === 'course.clank.b64') continue
    files[rel] = new Uint8Array(readFileSync(abs))
  }
  return files
}

describe('the packer reproduces the committed course', () => {
  it('packing the checked-out fixtures yields the committed course.clank byte-for-byte', () => {
    const committed = readFileSync(join(fixtureRoot, 'course.clank'))
    const { clank } = packCourse(readSourceFiles())
    expect(clank.equals(committed)).toBe(true)
  })

  it('the manifest inside the committed archive matches the manifest on disk', () => {
    const committed = readFileSync(join(fixtureRoot, 'course.clank'))
    const inArchive = JSON.parse(strFromU8(unzipSync(committed)['manifest.json']))
    const onDisk = JSON.parse(readFileSync(join(fixtureRoot, 'manifest.json'), 'utf8'))
    expect(inArchive).toEqual(onDisk)
  })

  it('fixture text files are checked out with LF line endings, as the hashes assume', () => {
    for (const abs of walk(fixtureRoot)) {
      const rel = relative(fixtureRoot, abs)
      if (!rel.endsWith('.json') && !rel.endsWith('.clank.b64')) continue
      const bytes = readFileSync(abs)
      for (let i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) {
          throw new Error(`${rel} has CRLF line endings; rebuild will not match the committed .clank`)
        }
      }
    }
  })
})