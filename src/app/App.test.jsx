import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders the responsive application shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Your workspace is ready' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).not.toHaveLength(0)
  })
})
