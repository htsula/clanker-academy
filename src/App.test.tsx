import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the first lesson of the fixture course', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'The Idea of a Limit' })).toBeInTheDocument()
  })
})