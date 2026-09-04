import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('opens the course.clank and renders the first lesson', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Idea of a Limit' }),
    ).toBeInTheDocument()
  })
})