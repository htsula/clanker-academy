import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  lessonSchema,
  manifestSchema,
  parseBlock,
  parseLesson,
  parseManifest,
  parseSpine,
  spineSchema,
} from '../src/course/schema'

import manifest from '../src/fixtures/manifest.json'
import spine from '../src/fixtures/spine.json'

const lessonsDir = resolve(__dirname, '../src/fixtures/lessons')
const lessonIds = readdirSync(lessonsDir)
  .filter((name) => /^L-\d{3}\.json$/.test(name))
  .sort()
const lessons = lessonIds.map((name) => JSON.parse(readFileSync(join(lessonsDir, name), 'utf8')))

describe('schema fixtures validate', () => {
  it('parses every lesson fixture in the course', () => {
    expect(lessonIds.length).toBeGreaterThanOrEqual(9)
    for (const lesson of lessons) {
      expect(() => parseLesson(lesson)).not.toThrow()
    }
  })

  it('parses the manifest and spine fixtures', () => {
    expect(() => parseManifest(manifest)).not.toThrow()
    expect(() => parseSpine(spine)).not.toThrow()
  })

  it('every lesson in the spine has a fixture and vice versa', () => {
    const spineIds = spine.modules.flatMap((m) => m.lessons.map((l) => l.id)).sort()
    expect(spineIds).toEqual(lessonIds.map((name) => name.replace(/\.json$/, '')))
  })

  it('every figure referenced by a lesson exists in the figures folder', () => {
    const available = new Set(readdirSync(resolve(__dirname, '../src/fixtures/figures')))
    for (const lesson of lessons as unknown as ReturnType<typeof lessonSchema.parse>[]) {
      for (const block of lesson.blocks) {
        if (block.type === 'figure') {
          const name = block.src.split('/').pop()
          expect(available.has(name!), `missing figure ${block.src}`).toBe(true)
        }
      }
    }
  })
})

describe('schema rejections', () => {
  it('rejects an unknown block type', () => {
    expect(() => parseBlock({ type: 'not-a-real-block' })).toThrow()
  })

  it('rejects raw HTML in a paragraph', () => {
    expect(() =>
      parseBlock({ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }),
    ).toThrow(/HTML-like content/)
  })

  it('rejects an on* attribute in text', () => {
    expect(() => parseBlock({ type: 'paragraph', content: [{ type: 'text', text: 'x <img src=x onerror=pwn()>' }] })).toThrow()
  })

  it('rejects a heading missing its required content', () => {
    expect(() => parseBlock({ type: 'heading', level: 1 })).toThrow()
  })

  it('rejects a widget with a non-version identity', () => {
    expect(() =>
      parseBlock({ type: 'widget', name: 'plot', version: 'latest', parameters: {} }),
    ).toThrow()
  })

  it('rejects an empty paragraph', () => {
    expect(() => parseBlock({ type: 'paragraph', content: [] })).toThrow()
  })

  it('rejects an oversized math source', () => {
    expect(() =>
      parseBlock({ type: 'equation', source: 'x'.repeat(600), display: true }),
    ).toThrow(/length cap/)
  })

  it('rejects a deeply nested math source', () => {
    expect(() => parseBlock({ type: 'equation', source: '\\frac{' + '{'.repeat(40) + 'x' + '}'.repeat(40) + '}', display: true })).toThrow(/nesting cap/)
  })

  it('rejects a manifest missing a required field', () => {
    const broken = { ...(manifest as Record<string, unknown>) }
    delete broken.course_id
    expect(() => manifestSchema.parse(broken)).toThrow()
  })

  it('keeps widgets_used through a parse round-trip', () => {
    const withWidgets = { ...(manifest as Record<string, unknown>), widgets_used: ['plot@1.0'] }
    const parsed = manifestSchema.parse(withWidgets)
    expect(parsed.widgets_used).toEqual(['plot@1.0'])
  })

  it('rejects a malformed widgets_used entry', () => {
    const broken = { ...(manifest as Record<string, unknown>), widgets_used: ['plot'] }
    expect(() => manifestSchema.parse(broken)).toThrow()
    const brokenVersion = { ...(manifest as Record<string, unknown>), widgets_used: ['plot@1'] }
    expect(() => manifestSchema.parse(brokenVersion)).toThrow()
  })

  it('rejects an unrecognized manifest key instead of silently dropping it', () => {
    const sneaky = { ...(manifest as Record<string, unknown>), widgets_used: ['plot@1.0'], smuggled: true }
    expect(() => manifestSchema.parse(sneaky)).toThrow(/unrecognized/i)
  })

  it('rejects a spine missing the modules list', () => {
    const broken = { ...(spine as Record<string, unknown>) }
    delete (broken as { modules?: unknown }).modules
    expect(() => spineSchema.parse(broken)).toThrow()
  })

  it('rejects a spine missing the atoms list', () => {
    const broken = { ...(spine as Record<string, unknown>) }
    delete (broken as { atoms?: unknown }).atoms
    expect(() => spineSchema.parse(broken)).toThrow()
  })
})