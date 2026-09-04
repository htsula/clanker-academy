import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadLesson } from '../course/load'
import { LessonPage } from './LessonPage'

describe('block renderer', () => {
  it('renders every block type in a lesson', () => {
    const lesson = loadLesson({
      id: 'L-999',
      title: 'All blocks',
      atom_ids: [],
      blocks: [
        { type: 'heading', level: 2, content: [{ type: 'text', text: 'A heading' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'A paragraph.' }] },
        { type: 'list', ordered: true, items: [[{ type: 'text', text: 'An item' }]] },
        { type: 'callout', kind: 'note', content: [{ type: 'text', text: 'A note.' }] },
        { type: 'definition', term: 'term', content: [{ type: 'text', text: 'A definition.' }] },
        {
          type: 'worked-example',
          problem: [{ type: 'text', text: 'A problem.' }],
          solution: [[{ type: 'text', text: 'A step.' }]],
        },
        { type: 'equation', source: 'x^2', display: true },
        { type: 'figure', src: 'figures/x.png', caption: [{ type: 'text', text: 'A caption.' }] },
        { type: 'widget', name: 'plot', version: '1.0', parameters: {} },
        {
          type: 'formative',
          prompt: [{ type: 'text', text: 'A prompt?' }],
          kind: 'multiple_choice',
          options: ['yes', 'no'],
        },
      ],
    })

    render(<LessonPage lesson={lesson} />)

    expect(screen.getByRole('heading', { name: 'A heading' })).toBeInTheDocument()
    expect(screen.getByText('A paragraph.')).toBeInTheDocument()
    expect(screen.getByText('An item')).toBeInTheDocument()
    expect(screen.getByText('A note.')).toBeInTheDocument()
    expect(screen.getByText('term')).toBeInTheDocument()
    expect(screen.getByText('A definition.')).toBeInTheDocument()
    expect(screen.getByText('A problem.')).toBeInTheDocument()
    expect(screen.getByText('A step.')).toBeInTheDocument()
    expect(screen.getByText('x^2')).toBeInTheDocument()
    expect(screen.getByText('A caption.')).toBeInTheDocument()
    expect(screen.getByText('plot@1.0')).toBeInTheDocument()
    expect(screen.getByText('A prompt?')).toBeInTheDocument()
    expect(screen.getByText('yes')).toBeInTheDocument()
  })

  it('renders an unknown block as a placeholder and leaves the rest of the lesson intact', () => {
    const lesson = loadLesson({
      id: 'L-998',
      title: 'Broken lesson',
      atom_ids: [],
      blocks: [
        { type: 'heading', level: 2, content: [{ type: 'text', text: 'Still readable' }] },
        { type: 'not-a-real-block', payload: 'whatever' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Still here.' }] },
      ],
    })

    render(<LessonPage lesson={lesson} />)

    expect(screen.getByRole('heading', { name: 'Still readable' })).toBeInTheDocument()
    expect(screen.getByText('Still here.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Unrecognised block')
    expect(screen.getByText('type: not-a-real-block')).toBeInTheDocument()
  })

  it('does not render the raw content of an unknown block', () => {
    const lesson = loadLesson({
      id: 'L-997',
      title: 'Hostile block',
      atom_ids: [],
      blocks: [{ type: 'widget', name: 'evil', version: '1.0', parameters: { html: '<script>alert(1)</script>' } }],
    })

    render(<LessonPage lesson={lesson} />)

    expect(document.body.textContent).not.toContain('<script>')
  })
})