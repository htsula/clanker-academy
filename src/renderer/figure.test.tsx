import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { checkRaster, isRasterImage } from '../course/images'
import { loadLesson } from '../course/load'
import { figure as figureSchema, type Figure } from '../course/schema'
import { FigureBlock } from './FigureBlock'

const pngBytes = new Uint8Array(readFileSync(resolve(__dirname, '../fixtures/figures/limit-approach.png')))
const pngBytes2 = new Uint8Array(readFileSync(resolve(__dirname, '../fixtures/figures/jump-discontinuity.png')))

const svgBytes = new TextEncoder().encode(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
)

function figureBlock(src: string, caption?: string): Figure {
  const lesson = loadLesson({
    id: 'L-901',
    title: 'Figures',
    atom_ids: [],
    blocks: [
      {
        type: 'figure',
        src,
        caption: caption ? [{ type: 'text', text: caption }] : undefined,
        atom_id: 'A-01',
      },
    ],
  })
  return figureSchema.parse(lesson.blocks[0])
}

describe('raster image detection', () => {
  it('accepts a PNG', () => {
    expect(isRasterImage(pngBytes)).toBe(true)
    expect(checkRaster(pngBytes)).toEqual({ ok: true })
  })

  it('rejects an SVG with a clear reason', () => {
    expect(isRasterImage(svgBytes)).toBe(false)
    expect(checkRaster(svgBytes)).toEqual({ ok: false, reason: expect.stringContaining('SVG') })
  })

  it('rejects bytes that are not an image', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(checkRaster(junk).ok).toBe(false)
  })

  it('rejects a too-short payload', () => {
    expect(checkRaster(new Uint8Array(4)).ok).toBe(false)
  })
})

describe('figure rendering', () => {
  it('renders a raster figure with its caption', () => {
    const block = figureBlock('figures/x.png', 'A caption.')
    render(<FigureBlock block={block} bytes={pngBytes} />)
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.src.startsWith('data:image/png;base64,')).toBe(true)
    expect(screen.getByText('A caption.')).toBeInTheDocument()
  })

  it('refuses an SVG figure in place of the image', () => {
    const block = figureBlock('figures/evil.svg')
    render(<FigureBlock block={block} bytes={svgBytes} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/SVG is not supported/)
  })

  it('rejects a remote URL at the schema boundary', () => {
    const remote = figureSchema.safeParse({
      type: 'figure',
      src: 'https://evil.example/figure.png',
      caption: [{ type: 'text', text: 'x' }],
    })
    expect(remote.success).toBe(false)
  })

  it('shows an inline error when a figure is missing its bytes', () => {
    const block = figureBlock('figures/x.png')
    render(<FigureBlock block={block} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/figure not found/)
  })

  it('shows an inline error for bytes that are not an image', () => {
    const block = figureBlock('figures/junk.png')
    render(<FigureBlock block={block} bytes={new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9])} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/does not decode/)
  })

  it('resets a decode failure when new bytes arrive', () => {
    const block = figureBlock('figures/x.png')
    const { rerender } = render(<FigureBlock block={block} bytes={pngBytes} />)

    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)

    expect(screen.getByRole('status')).toHaveTextContent(/image failed to decode/)
    expect(document.querySelector('img')).toBeNull()

    rerender(<FigureBlock block={block} bytes={pngBytes2} />)
    expect(document.querySelector('img')).not.toBeNull()
    expect(screen.queryByText(/image failed to decode/)).toBeNull()
  })
})