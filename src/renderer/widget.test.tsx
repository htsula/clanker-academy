import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Block } from '../course/schema'
import { loadLesson } from '../course/load'
import {
  collectWidgets,
  isWidgetSatisfiable,
  parseWidgetVersion,
  type WidgetVersion,
} from '../course/widget-registry'
import { LessonPage } from './LessonPage'
import { WidgetBlock } from './WidgetBlock'

describe('widget version rule (pure, every combination)', () => {
  const shipped: WidgetVersion = { major: 1, minor: 0 }

  it.each([
    ['0.9', false],
    ['1.0', true],
    ['1.9', false],
    ['2.0', false],
    ['0.0', false],
    ['2.5', false],
  ])('plot@1.0 build vs requested %s → %s', (requested, expected) => {
    expect(isWidgetSatisfiable(requested, shipped)).toBe(expected)
  })

  it('a minor bump on the renderer widens the satisfiable set', () => {
    const newer: WidgetVersion = { major: 1, minor: 4 }
    expect(isWidgetSatisfiable('1.1', newer)).toBe(true)
    expect(isWidgetSatisfiable('1.4', newer)).toBe(true)
    expect(isWidgetSatisfiable('1.5', newer)).toBe(false)
    expect(isWidgetSatisfiable('2.0', newer)).toBe(false)
    expect(isWidgetSatisfiable('0.9', newer)).toBe(false)
  })

  it('rejects a malformed version string', () => {
    expect(parseWidgetVersion('latest')).toBeNull()
    expect(parseWidgetVersion('1')).toBeNull()
    expect(parseWidgetVersion('1.0.1')).toBeNull()
    expect(parseWidgetVersion('1.0')).toEqual({ major: 1, minor: 0 })
  })
})

describe('widget rendering', () => {
  it('renders a satisfiable plot@1.0 instance', () => {
    render(
      <WidgetBlock
        block={{
          type: 'widget',
          name: 'plot',
          version: '1.0',
          parameters: {
            series: [{ label: 'points', points: [[0, 0], [1, 1], [2, 4]] }],
            title: 'A parabola',
          },
        }}
      />,
    )
    expect(document.querySelector('.plot-widget')).not.toBeNull()
    expect(screen.getByText('A parabola')).toBeInTheDocument()
  })

  it('shows the error card for a minor that is too new', () => {
    render(
      <WidgetBlock
        block={{ type: 'widget', name: 'plot', version: '1.9', parameters: { series: [] } }}
      />,
    )
    expect(document.querySelector('.plot-widget')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('plot@1.9')
    expect(screen.getByRole('status')).toHaveTextContent(/needs a newer version/)
    expect(screen.getByRole('status')).toHaveTextContent('renderer ships 1.0')
  })

  it('shows the error card for an unknown major', () => {
    render(
      <WidgetBlock
        block={{ type: 'widget', name: 'plot', version: '2.0', parameters: { series: [] } }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('plot@2.0')
    expect(screen.getByRole('status')).toHaveTextContent(/no plot major 2/)
  })

  it('shows the error card for an unknown widget', () => {
    render(
      <WidgetBlock
        block={{ type: 'widget', name: 'derivation-stepper', version: '1.0', parameters: {} }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('derivation-stepper@1.0')
    expect(screen.getByRole('status')).toHaveTextContent(/unknown widget/)
  })

  it('refuses unrecognized parameters', () => {
    render(
      <WidgetBlock
        block={{
          type: 'widget',
          name: 'plot',
          version: '1.0',
          parameters: { series: [{ label: 's', points: [[0, 0]] }], onload: 'alert(1)' },
        }}
      />,
    )
    expect(document.querySelector('.plot-widget')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/do not match the widget/)
  })

  it('does not let an error card affect the rest of the lesson', () => {
    const lesson = loadLesson({
      id: 'L-902',
      title: 'Widgets',
      atom_ids: [],
      blocks: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Readable.' }] },
        { type: 'widget', name: 'plot', version: '2.0', parameters: {} },
        { type: 'paragraph', content: [{ type: 'text', text: 'Still readable.' }] },
      ],
    })
    render(<LessonPage lesson={lesson} figures={new Map()} />)
    expect(screen.getByRole('status')).toHaveTextContent('plot@2.0')
    expect(screen.getByText('Readable.')).toBeInTheDocument()
    expect(screen.getByText('Still readable.')).toBeInTheDocument()
  })
})

describe('collectWidgets', () => {
  it('collects unique widget identities in stable order', () => {
    const blocks: Block[] = [
      { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
      { type: 'widget', name: 'plot', version: '1.0', parameters: {} },
      { type: 'widget', name: 'plot', version: '1.0', parameters: {} },
      { type: 'widget', name: 'plot', version: '1.4', parameters: {} },
      { type: 'heading', level: 2, content: [{ type: 'text', text: 'y' }] },
    ]
    expect(collectWidgets(blocks)).toEqual([
      { name: 'plot', version: '1.0' },
      { name: 'plot', version: '1.4' },
    ])
  })
})