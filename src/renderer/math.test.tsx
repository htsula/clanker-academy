import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadLesson } from '../course/load'
import { MATH_DEPTH_MAX, MATH_SOURCE_MAX } from '../course/schema'
import { LessonPage } from './LessonPage'

function lessonWithMath(blocks: unknown[]) {
  return loadLesson({ id: 'L-900', title: 'Math lesson', atom_ids: [], blocks })
}

describe('math rendering', () => {
  it('renders a valid display equation with KaTeX', () => {
    const lesson = lessonWithMath([{ type: 'equation', source: 'x^2 + 1', display: true }])
    const { container } = render(<LessonPage lesson={lesson} figures={new Map()} />)
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('renders a valid inline equation with KaTeX', () => {
    const lesson = lessonWithMath([
      { type: 'paragraph', content: [{ type: 'math', source: '\\lim_{x \\to 0} x' }] },
    ])
    const { container } = render(<LessonPage lesson={lesson} figures={new Map()} />)
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('renders an inline error for a malformed expression and keeps the lesson readable', () => {
    const lesson = lessonWithMath([
      { type: 'paragraph', content: [{ type: 'text', text: 'Before.' }] },
      { type: 'equation', source: '\\notarealcommand', display: true },
      { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
    ])
    render(<LessonPage lesson={lesson} figures={new Map()} />)

    expect(screen.getByText('Before.')).toBeInTheDocument()
    expect(screen.getByText('After.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/parse error|could not render|KaTeX/)
  })

  it('refuses an expression over the length cap', () => {
    const lesson = lessonWithMath([
      { type: 'equation', source: 'x'.repeat(MATH_SOURCE_MAX + 1), display: true },
      { type: 'paragraph', content: [{ type: 'text', text: 'Still readable.' }] },
    ])
    render(<LessonPage lesson={lesson} figures={new Map()} />)

    expect(screen.getByRole('status')).toHaveTextContent(/length cap/)
    expect(screen.getByText('Still readable.')).toBeInTheDocument()
  })

  it('refuses an expression over the nesting cap', () => {
    const deep = '\\frac{' + '{'.repeat(MATH_DEPTH_MAX + 1) + 'x' + '}'.repeat(MATH_DEPTH_MAX + 1) + '}'
    const lesson = lessonWithMath([{ type: 'equation', source: deep, display: true }])
    render(<LessonPage lesson={lesson} figures={new Map()} />)

    expect(screen.getByRole('status')).toHaveTextContent(/nesting cap/)
  })
})