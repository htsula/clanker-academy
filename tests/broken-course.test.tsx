import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { strFromU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { openClank } from '../src/course/clank'
import { LessonPage } from '../src/renderer/LessonPage'
import { packCourse } from '../scripts/pack-course.mjs'

// Step 13, plan item 3 — the deliberately broken variant of the course. Every
// failure a course file can carry must be element-scoped and clearly stated:
// a widget the renderer cannot satisfy, an unknown block type, a malformed
// equation. None of them may take the rest of the lesson down, and a flipped
// byte must refuse the file before anything renders. These are the M0 exit
// criteria, tested end to end through the real pipeline: fixture sources →
// packer → openClank → LessonPage.

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

// A broken lesson surrounded by readable ones: L-001 gains two unsatisfiable
// widgets, an unknown block type, and a malformed equation, sandwiched between
// ordinary paragraphs. The rest of the course stays untouched.
function brokenVariantFiles(): Record<string, Uint8Array> {
  const files = readSourceFiles()
  const lesson = JSON.parse(strFromU8(files['lessons/L-001.json']))
  lesson.blocks = [
    { type: 'paragraph', content: [{ type: 'text', text: 'Before the breakage.' }] },
    { type: 'widget', name: 'plot', version: '1.9', parameters: { series: [] } },
    { type: 'widget', name: 'plot', version: '2.0', parameters: { series: [] } },
    { type: 'not-a-real-block', payload: 'whatever' },
    { type: 'equation', source: '\\notarealcommand', display: true },
    { type: 'paragraph', content: [{ type: 'text', text: 'After the breakage.' }] },
  ]
  files['lessons/L-001.json'] = new TextEncoder().encode(JSON.stringify(lesson))
  return files
}

describe('step 13 — the deliberately broken course variant', () => {
  it('opens: none of the broken elements is refused at the container boundary', async () => {
    const { clank } = packCourse(brokenVariantFiles())
    const result = await openClank(clank)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // All nine lessons survive; the other eight are untouched.
    expect(result.course.lessons.map((l) => l.id)).toEqual([
      'L-001', 'L-002', 'L-003', 'L-004', 'L-005',
      'L-006', 'L-007', 'L-008', 'L-009',
    ])
  })

  it('every failure is element-scoped and clearly stated, and the lesson stays readable', async () => {
    const { clank } = packCourse(brokenVariantFiles())
    const result = await openClank(clank)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const lesson = result.course.lessons.find((l) => l.id === 'L-001')
    expect(lesson).toBeDefined()
    if (!lesson) return

    render(<LessonPage lesson={lesson} figures={result.course.figures} />)

    // The surrounding prose is untouched by the breakage.
    expect(screen.getByText('Before the breakage.')).toBeInTheDocument()
    expect(screen.getByText('After the breakage.')).toBeInTheDocument()

    const statuses = screen.getAllByRole('status').map((el) => el.textContent ?? '')

    // plot@1.9 — same major, minor too new: names both versions.
    const at19 = statuses.find((s) => s.includes('plot@1.9'))
    expect(at19).toBeTruthy()
    expect(at19).toContain('renderer ships 1.0')
    expect(at19).toContain('needs a newer version')

    // plot@2.0 — unknown major.
    const at20 = statuses.find((s) => s.includes('plot@2.0'))
    expect(at20).toBeTruthy()
    expect(at20).toContain('no plot major 2')

    // Unknown block type — labelled placeholder, not raw content.
    const placeholder = statuses.find((s) => s.includes('Unrecognised block'))
    expect(placeholder).toBeTruthy()
    expect(placeholder).toContain('type: not-a-real-block')
    expect(screen.queryByText('payload: whatever')).toBeNull()

    // Malformed equation — inline error from KaTeX.
    expect(statuses.some((s) => /Undefined control sequence|could not render|KaTeX/.test(s))).toBe(true)
  })

  it('a flipped byte is refused on the hash check before anything renders', async () => {
    const { clank } = packCourse(brokenVariantFiles())
    const tampered = unzipSync(clank)
    const lesson = strFromU8(tampered['lessons/L-001.json'])
    tampered['lessons/L-001.json'] = new TextEncoder().encode(
      lesson.replace('Before the breakage.', 'Before the breakagf.'),
    )
    const result = await openClank(zipSync(tampered))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/integrity mismatch for lessons\/L-001\.json/)
  })
})
