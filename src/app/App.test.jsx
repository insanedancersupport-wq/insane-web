import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import { AuthContext } from '../features/auth/AuthContext'

describe('App', () => {
  it('renders the responsive application shell', () => {
    render(
      <AuthContext.Provider
        value={{
          profile: { active: true, full_name: 'Alex Trainer', role: 'trainer' },
          signOut: async () => {},
        }}
      >
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(
      screen.getByRole('heading', { name: 'Welcome, Alex Trainer' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).not.toHaveLength(0)
  })
})
