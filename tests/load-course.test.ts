import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCourseBytes } from '../src/course/load-course'

// The real load path, unmocked: the module imports the .clank asset URL at
// load time (?url) and fetches it. jsdom has no server, so fetch is stubbed
// to serve the committed .clank bytes — the same bytes the app reads in dev
// and in the built app (dist/ emits the asset at the bundled URL).

const committed = readFileSync(resolve(__dirname, '../src/fixtures/course.clank'))

describe('loadCourseBytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the committed .clank bytes when the fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          committed.buffer.slice(committed.byteOffset, committed.byteOffset + committed.byteLength),
      })),
    )

    const bytes = await loadCourseBytes()
    expect(Buffer.from(bytes).equals(committed)).toBe(true)
  })

  it('throws with the HTTP status when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))

    await expect(loadCourseBytes()).rejects.toThrow(/failed to load course \(HTTP 404\)/)
  })
})