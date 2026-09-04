import clankUrl from '../fixtures/course.clank?url'

// The app opens a real .clank — in dev the URL resolves to the file on disk
// served by Vite; in the built app it resolves to the asset emitted alongside
// the bundle. The fetch is same-origin, which is exactly what the CSP's
// connect-src 'self' exists to allow. No base64 baking, no generated copy of
// the file: the .clank is the artifact, and this is how the app reads it.
export async function loadCourseBytes(): Promise<Uint8Array> {
  const res = await fetch(clankUrl)
  if (!res.ok) throw new Error(`failed to load course (HTTP ${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}