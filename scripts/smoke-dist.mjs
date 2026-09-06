import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// CI smoke check for the course load path (step 13): the built app fetches
// the .clank as a same-origin asset at the URL the bundle references
// (src/course/load-course.ts). If the build emitted no .clank, or the bundle
// points at a URL nothing was emitted to, the three-platform build job would
// ship an app that can only render the error screen. Run after `npm run build`.

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8')
const bundles = [...indexHtml.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1])
if (bundles.length === 0) throw new Error('dist/index.html references no JS bundle')

let checked = 0
for (const bundle of bundles) {
  const bundlePath = join(dist, bundle)
  if (!existsSync(bundlePath)) throw new Error(`bundle referenced by index.html is missing: ${bundle}`)
  const source = readFileSync(bundlePath, 'utf8')
  const refs = [...source.matchAll(/["'`]([^"'`]*\.clank)["'`]/g)].map((m) => m[1])
  if (refs.length === 0) throw new Error(`bundle ${bundle} references no .clank asset`)
  for (const ref of refs) {
    if (!existsSync(join(dist, ref))) throw new Error(`.clank asset missing at the bundled URL: ${ref}`)
    checked += 1
  }
}

console.log(`dist ok: ${checked} .clank asset(s) emitted at the URL the bundle references`)