import { strToU8, zipSync } from 'fflate'
import { createHash } from 'node:crypto'

// The pure packer behind scripts/build-clank.mjs, exported so the
// reproducibility test exercises the exact code the build uses. Hash format
// must match src/course/clank.ts: content_hash = sha256 over sorted
// `${path}:${sha256(bytes)}\n` for every file except manifest.json, hashed
// once more.

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

// The .clank is a hashed, verifiable container; its bytes must be a pure
// function of the source files. fflate stamps each entry with the current
// time by default, which would make "rebuild the course" depend on when it
// ran — pin the timestamp so the archive is fully deterministic.
const PINNED_MTIME = new Date(1980, 0, 1, 0, 0, 0)

/**
 * Pack a source tree (the fixtures folder) into a .clank.
 * @param {Record<string, Uint8Array>} files every container file except the
 *   artifact itself, keyed by its path inside the archive (manifest.json,
 *   spine.json, lessons/…, figures/…, items/…)
 * @returns {{ clank: Buffer, manifest: object, contentHash: string }}
 */
export function packCourse(files) {
  const integrity = {}
  for (const [path, data] of Object.entries(files)) {
    if (path !== 'manifest.json') integrity[path] = sha256(data)
  }

  const parts = Object.entries(files)
    .filter(([path]) => path !== 'manifest.json')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, data]) => `${path}:${sha256(data)}\n`)
  const contentHash = sha256(Buffer.from(parts.join(''), 'utf8'))

  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
  manifest.integrity = integrity
  manifest.content_hash = contentHash

  // widgets_used[] is collected from the lesson and item trees — never
  // hand-edited, never generated. The walk is the shared module the runtime
  // registry re-exports (§11.6a: gathered by walking the lesson and item trees
  // at Stage 7). Items carry widgets under each item's own shape, so a
  // recursive descent over every JSON container covers both.
  const widgetsUsed = new Set()
  function walkBlocks(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) walkBlocks(child)
      return
    }
    if (node.type === 'widget') {
      widgetsUsed.add(`${node.name}@${node.version}`)
    }
    for (const value of Object.values(node)) walkBlocks(value)
  }
  for (const [path, data] of Object.entries(files)) {
    if (!path.startsWith('lessons/') && !path.startsWith('items/')) continue
    if (!path.endsWith('.json')) continue
    walkBlocks(JSON.parse(new TextDecoder().decode(data)))
  }
  manifest.widgets_used = [...widgetsUsed].sort()

  const zipFiles = {}
  for (const [path, data] of Object.entries(files)) {
    zipFiles[path] = path === 'manifest.json' ? strToU8(JSON.stringify(manifest)) : data
  }

  return { clank: Buffer.from(zipSync(zipFiles, { level: 9, mtime: PINNED_MTIME })), manifest, contentHash }
}