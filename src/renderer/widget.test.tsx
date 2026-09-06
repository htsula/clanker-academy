import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Block } from '../course/schema'
import { loadLesson } from '../course/load'
import { PlotWidget } from '../course/widgets/plot'
import {
  collectWidgets,
  isWidgetSatisfiable,
  parseWidgetVersion,
  registerWidget,
  resolveWidget,
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

  it('distinguishes a malformed version from bad parameters', () => {
    render(
      <WidgetBlock
        block={{ type: 'widget', name: 'plot', version: '1.x', parameters: {} }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/malformed version/)
    expect(screen.getByRole('status')).not.toHaveTextContent(/parameters/)
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

  it('a widget that throws during render is caught by the boundary and does not take down the lesson', () => {
    registerWidget({
      name: 'exploder',
      major: 1,
      version: { major: 1, minor: 0 },
      schema: z.object({}).strict(),
      Component: () => {
        throw new Error('boom')
      },
    })
    const lesson = loadLesson({
      id: 'L-903',
      title: 'Exploder',
      atom_ids: [],
      blocks: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before.' }] },
        { type: 'widget', name: 'exploder', version: '1.0', parameters: {} },
        { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
      ],
    })
    render(<LessonPage lesson={lesson} figures={new Map()} />)
    expect(screen.getByRole('status')).toHaveTextContent('exploder@1.0')
    expect(screen.getByRole('status')).toHaveTextContent(/crashed while rendering/)
    expect(screen.getByText('Before.')).toBeInTheDocument()
    expect(screen.getByText('After.')).toBeInTheDocument()
  })

  it('resets the crash latch when the widget input changes', () => {
    registerWidget({
      name: 'flaky',
      major: 1,
      version: { major: 1, minor: 0 },
      schema: z.object({ boom: z.boolean().optional() }).strict(),
      Component: (props) => {
        if ((props.params as { boom?: boolean }).boom) throw new Error('boom')
        return <span data-testid="flaky-ok">fine</span>
      },
    })

    const { rerender } = render(
      <WidgetBlock
        block={{ type: 'widget', name: 'flaky', version: '1.0', parameters: { boom: true } }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/crashed while rendering/)

    rerender(<WidgetBlock block={{ type: 'widget', name: 'flaky', version: '1.0', parameters: {} }} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTestId('flaky-ok')).toBeInTheDocument()
  })

  it('keeps the legend inside the frame, below the title, with five distinct colours', () => {
    const series = Array.from({ length: 5 }, (_, i) => ({
      label: `series ${i + 1}`,
      points: [[i, 0], [i + 1, 1]] as [number, number][],
    }))
    const { container } = render(<PlotWidget params={{ series, title: 'A titled plot' }} />)
    const svg = container.querySelector('svg')
    const viewBox = svg?.getAttribute('viewBox')?.split(' ').map(Number) ?? [0, 0, 480, 320]
    const [, , vbW, vbH] = viewBox
    const legendTexts = Array.from(container.querySelectorAll('text.plot-legend'))
    for (const text of legendTexts) {
      const y = Number(text.getAttribute('y'))
      expect(y, 'legend row must render inside the frame').toBeLessThan(vbH)
      const x = Number(text.getAttribute('x'))
      expect(x, 'legend row must render inside the frame width').toBeGreaterThanOrEqual(0)
      expect(x, 'legend row must render inside the frame width').toBeLessThan(vbW)
    }
    expect(legendTexts.length).toBe(5)

    // The backdrop is 88% opaque — it must not sit over the title text.
    const title = container.querySelector('.plot-title')
    const backdrop = container.querySelector('.plot-legend-backdrop')
    expect(title).not.toBeNull()
    expect(backdrop).not.toBeNull()
    const backdropTop = Number(backdrop?.getAttribute('y'))
    const titleBaseline = Number(title?.getAttribute('y'))
    expect(backdropTop, 'backdrop must start below the title baseline').toBeGreaterThan(titleBaseline)

    // Five series must be five distinguishable colours — the L-009 window
    // plot's whole point is telling the epsilon band from the delta lines.
    const strokes = Array.from(container.querySelectorAll('polyline')).map((p) =>
      p.getAttribute('class')?.replace('plot-series ', ''),
    )
    expect(new Set(strokes).size).toBe(5)
  })

  it('rejects a plot range where min >= max at the schema', () => {
    const result = resolveWidget('plot', '1.0', {
      series: [{ points: [[0, 0]] }],
      xmin: 5,
      xmax: 5,
    })
    expect(result.status).toBe('invalid-parameters')
  })

  it('does not divide by zero when an explicit range conflicts with the data', () => {
    render(
      <PlotWidget
        params={{ series: [{ label: 's', points: [[0, 0], [1, 1]] }], xmin: 5 }}
      />,
    )
    expect(screen.getByText('invalid plot range')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
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