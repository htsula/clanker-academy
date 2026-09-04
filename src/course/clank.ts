import { strFromU8, unzipSync } from 'fflate'
import { loadLesson, type LoadedLesson } from './load'
import type { FigureMap } from '../renderer/BlockRenderer'
import { sha256Hex } from './hash'
import type { Manifest, Spine } from './schema'
import { parseManifest, parseSpine } from './schema'

// The .clank container (§3.1). Zip work happens in the webview with fflate —
// no Rust command for this. A course file is a document from a stranger,
// including your own files, so nothing renders until integrity verifies and
// every file validates against the schemas.

export interface Course {
  manifest: Manifest
  spine: Spine
  lessons: LoadedLesson[]
  figures: FigureMap
}

export type OpenResult = { ok: true; course: Course } | { ok: false; reason: string }

// content_hash is the hash over every file in the container except the
// manifest, which is what carries the hashes (§3.2). The format is a sorted
// concatenation of `${path}:${sha256(path bytes)}\n`, hashed once more. The
// build script (scripts/build-clank.mjs) must produce exactly this.
export async function computeContentHash(files: ReadonlyMap<string, Uint8Array>): Promise<string> {
  const parts: string[] = []
  for (const [path, data] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (path === 'manifest.json') continue
    parts.push(`${path}:${await sha256Hex(data)}\n`)
  }
  return sha256Hex(new TextEncoder().encode(parts.join('')))
}

function parse<T>(bytes: Uint8Array | undefined, what: string, parseFn: (v: unknown) => T): T | { error: string } {
  if (!bytes) return { error: `missing ${what}` }
  try {
    return parseFn(JSON.parse(strFromU8(bytes)))
  } catch (err) {
    return { error: `${what} failed validation: ${err instanceof Error ? err.message : 'unknown error'}` }
  }
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// A course file is a document from a stranger, so opening it is a budgeted
// operation. This scans the local file headers before anything decompresses —
// fflate's unzipSync would otherwise decompress a zip bomb fully before we
// could refuse it. Heuristic by nature (data descriptors end the scan early),
// which is fine: it bounds the common case, and M1's import path owns the real
// defense.
const MAX_CLANK_ENTRIES = 1000
const MAX_CLANK_UNCOMPRESSED = 64 * 1024 * 1024

function zipBudget(bytes: Uint8Array): { ok: true } | { ok: false; reason: string } {
  let i = 0
  let entries = 0
  let total = 0
  const len = bytes.length
  while (i + 30 <= len) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b) break
    const isLocalHeader = bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04
    if (!isLocalHeader) break
    const compSize =
      bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24)
    const uncompSize =
      bytes[i + 22] | (bytes[i + 23] << 8) | (bytes[i + 24] << 16) | (bytes[i + 25] << 24)
    const nameLen = bytes[i + 26] | (bytes[i + 27] << 8)
    const extraLen = bytes[i + 28] | (bytes[i + 29] << 8)
    entries += 1
    total += uncompSize
    if (entries > MAX_CLANK_ENTRIES) return { ok: false, reason: 'archive has too many entries' }
    if (total > MAX_CLANK_UNCOMPRESSED) return { ok: false, reason: 'archive uncompressed size exceeds the budget' }
    i += 30 + nameLen + extraLen + compSize
  }
  return { ok: true }
}

export async function openClank(bytes: Uint8Array): Promise<OpenResult> {
  const budget = zipBudget(bytes)
  if (!budget.ok) return { ok: false, reason: budget.reason }

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    return { ok: false, reason: 'not a valid zip archive' }
  }

  const manifestBytes = files['manifest.json']
  if (!manifestBytes) return { ok: false, reason: 'missing manifest.json' }

  const manifestResult = parse(manifestBytes, 'manifest.json', parseManifest)
  if ('error' in manifestResult) return { ok: false, reason: manifestResult.error }
  const manifest = manifestResult

  // integrity must be complete, not merely consistent: the map has to name
  // exactly the non-manifest files, or a file can ride in unchecked.
  const integrityPaths = Object.keys(manifest.integrity).sort()
  const filePaths = Object.keys(files)
    .filter((p) => p !== 'manifest.json')
    .sort()
  if (integrityPaths.join('\n') !== filePaths.join('\n')) {
    return { ok: false, reason: 'integrity map does not cover every file in the archive' }
  }

  for (const [path, expected] of Object.entries(manifest.integrity)) {
    const actualBytes = files[path]
    if (!actualBytes) return { ok: false, reason: `integrity: file missing for ${path}` }
    const actual = await sha256Hex(actualBytes)
    if (actual !== expected) return { ok: false, reason: `integrity mismatch for ${path}` }
  }

  const expectedContentHash = manifest.content_hash
  if (!expectedContentHash || expectedContentHash === 'computed-by-build-clank') {
    return { ok: false, reason: 'manifest has no computed content hash' }
  }
  const actualContentHash = await computeContentHash(new Map(Object.entries(files)))
  if (actualContentHash !== expectedContentHash) {
    return { ok: false, reason: 'content hash mismatch — the file has been altered' }
  }

  const spineResult = parse(files['spine.json'], 'spine.json', parseSpine)
  if ('error' in spineResult) return { ok: false, reason: spineResult.error }

  const lessonPaths = Object.keys(files)
    .filter((p) => /^lessons\/L-\d{3}\.json$/.test(p))
    .sort()
  if (lessonPaths.length === 0) return { ok: false, reason: 'course has no lessons' }

  const lessons: LoadedLesson[] = []
  for (const path of lessonPaths) {
    const raw = files[path]
    try {
      lessons.push(loadLesson(JSON.parse(strFromU8(raw))))
    } catch (err) {
      return { ok: false, reason: `${path} failed validation: ${err instanceof Error ? err.message : 'unknown error'}` }
    }
  }

  const figures = new Map<string, Uint8Array>()
  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith('figures/')) figures.set(path, data)
  }

  return { ok: true, course: { manifest, spine: spineResult, lessons, figures } }
}