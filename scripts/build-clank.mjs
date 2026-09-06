import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packCourse } from './pack-course.mjs'

// Packages src/fixtures/ into a real .clank, the container layout of §3.1.
// The work is the pure packCourse() above; this script walks the fixture
// tree, packs, and writes the artifact plus the updated manifest back so the
// committed manifest always reflects the packed course.

const here = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = resolve(here, '..', 'src', 'fixtures')

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

const { clank, manifest, contentHash } = packCourse(files)

writeFileSync(join(fixtureRoot, 'course.clank'), clank)
writeFileSync(join(fixtureRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log(`course.clank written (${clank.length} bytes, ${Object.keys(files).length} files)`)
console.log(`content_hash ${contentHash}`)