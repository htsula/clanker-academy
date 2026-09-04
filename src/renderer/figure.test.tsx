import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { checkRaster, isRasterImage } from '../course/images'
import { loadLesson } from '../course/load'
import { FigureBlock } from './FigureBlock'

const pngBytes = new Uint8Array(readFileSync(resolve(__dirname, '../fixtures/figures/limit-approach.png')))

const svgBytes = new TextEncoder().encode(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
)

function figureBlock(src: string, caption?: string) {
  return loadLesson({
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
  }).blocks[0]
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
    expect(img?.src.startsWith('blob:')).toBe(true)
    expect(screen.getByText('A caption.')).toBeInTheDocument()
  })

  it('refuses an SVG figure in place of the image', () => {
    const block = figureBlock('figures/evil.svg')
    render(<FigureBlock block={block} bytes={svgBytes} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/SVG is not supported/)
  })

  it('does not load a remote URL and shows an inline error instead', () => {
    const block = figureBlock('https://evil.example/figure.png')
    render(<FigureBlock block={block} />)
    const imgs = Array.from(document.querySelectorAll('img'))
    expect(imgs.every((img) => !img.src.includes('https://'))).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent(/figure not found/)
  })

  it('shows an inline error for bytes that are not an image', () => {
    const block = figureBlock('figures/junk.png')
    render(<FigureBlock block={block} bytes={new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9])} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/does not decode/)
  })
})