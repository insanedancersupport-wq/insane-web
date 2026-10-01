import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { MorePage } from './MorePage'
import { AuthContext } from '../features/auth/AuthContext'

afterEach(cleanup)

function renderPage(role) {
  return render(
    <AuthContext.Provider value={{ profile: { role } }}>
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('MorePage', () => {
  it('hides administration links from trainers', () => {
    renderPage('trainer')

    expect(screen.queryByRole('link', { name: 'Trainers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Groups' })).not.toHaveLength(0)
  })

  it('shows administration links to admins', () => {
    renderPage('admin')

    expect(screen.getAllByRole('link', { name: 'Trainers' })).not.toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Rooms' })).not.toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Users' })).not.toHaveLength(0)
  })
})
