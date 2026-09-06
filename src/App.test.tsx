import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// The App fetches the .clank asset; jsdom has no server, so supply the real
// committed file's bytes here. openClank (integrity, schema, budget) is
// exercised on those bytes end to end.
vi.mock('./course/load-course', () => ({
  loadCourseBytes: async () =>
    new Uint8Array(readFileSync(resolve(__dirname, 'fixtures/course.clank'))),
}))

describe('App', () => {
  it('opens the course.clank and renders the first lesson', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Idea of a Limit' }),
    ).toBeInTheDocument()
  })

  it('shows the modules as the lesson nav shape', async () => {
    render(<App />)
    expect(await screen.findByText('1. The Concept of a Limit')).toBeInTheDocument()
    expect(screen.getByText('2. Continuity')).toBeInTheDocument()
    expect(screen.getByText('3. Limits at Infinity and Asymptotes')).toBeInTheDocument()
    expect(screen.getByText('4. The Precise Definition')).toBeInTheDocument()
  })
})