import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../features/auth/AuthContext'
import { AppShell } from './AppShell'

function renderShell(auth, initialEntry = '/app/dashboard') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<AppShell title="Dashboard"><p>Dashboard content</p></AppShell>} path="/app/dashboard" />
          <Route element={<p>Login page</p>} path="/login" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

afterEach(cleanup)

describe('AppShell user menu', () => {
  it('shows the authenticated admin profile information without an additional request', () => {
    renderShell({
      profile: { full_name: 'Alex Admin', role: 'admin' },
      session: { user: { email: 'admin@example.test' } },
      signOut: vi.fn(),
    })

    expect(screen.getByRole('button', { name: 'Open user menu' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }))

    expect(screen.getByText('Alex Admin')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('admin@example.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open user menu' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('displays the trainer role and closes on Escape or an outside click', () => {
    renderShell({
      profile: { full_name: 'Alex Trainer', role: 'trainer' },
      session: { user: { email: 'trainer@example.test' } },
      signOut: vi.fn(),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }))
    expect(screen.getByText('Trainer')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('trainer@example.test')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('trainer@example.test')).not.toBeInTheDocument()
  })

  it('uses the existing sign-out action and redirects after it succeeds', async () => {
    const signOut = vi.fn().mockResolvedValue()
    renderShell({
      profile: { full_name: 'Alex Trainer', role: 'trainer' },
      session: { user: { email: 'trainer@example.test' } },
      signOut,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })
})
