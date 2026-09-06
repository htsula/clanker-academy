import { strToU8, zipSync } from 'fflate'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectWidgets } from '../src/course/widgets-used.mjs'

// Packages src/fixtures/ into a real .clank (scripts/build-clank.mjs), the
// container layout of §3.1. Hash format must match src/course/clank.ts:
// content_hash = sha256 over sorted `${path}:${sha256(bytes)}\n` for every
// file except manifest.json, hashed once more.

const here = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = resolve(here, '..', 'src', 'fixtures')

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
    } else {
      out.push(full)
    }
  }
  return out
}

const files = {}
for (const abs of walk(fixtureRoot)) {
  const rel = relative(fixtureRoot, abs).replaceAll('\\', '/')
  if (rel === 'course.clank' || rel === 'course.clank.b64') continue
  if (!statSync(abs).isFile()) continue
  files[rel] = readFileSync(abs)
}

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

// widgets_used[] is collected from the lesson trees — never hand-edited, never
// generated. The walk is the shared module the runtime registry re-exports.
const widgetsUsed = new Set()
for (const [path, data] of Object.entries(files)) {
  if (!path.startsWith('lessons/') || !path.endsWith('.json')) continue
  const lesson = JSON.parse(new TextDecoder().decode(data))
  for (const w of collectWidgets(lesson.blocks ?? [])) widgetsUsed.add(`${w.name}@${w.version}`)
}
manifest.widgets_used = [...widgetsUsed].sort()

const zipFiles = {}
for (const [path, data] of Object.entries(files)) {
  zipFiles[path] = path === 'manifest.json' ? strToU8(JSON.stringify(manifest)) : data
}

const clank = zipSync(zipFiles, { level: 9 })
writeFileSync(join(fixtureRoot, 'course.clank'), clank)
writeFileSync(join(fixtureRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log(`course.clank written (${clank.length} bytes, ${Object.keys(files).length} files)`)
console.log(`content_hash ${contentHash}`)