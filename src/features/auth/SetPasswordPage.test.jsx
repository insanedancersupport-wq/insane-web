import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from './AuthContext'
import { SetPasswordPage } from './SetPasswordPage'

afterEach(cleanup)

function renderPage(auth, initialEntry = '/set-password') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<SetPasswordPage />} path="/set-password" />
          <Route element={<p>Workspace</p>} path="/app" />
          <Route element={<p>Login</p>} path="/login" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function createAuth(overrides = {}) {
  return {
    isLoading: false,
    refreshProfile: vi.fn().mockResolvedValue({
      active: true,
      onboarding_completed_at: '2026-10-24T12:00:00Z',
    }),
    session: { user: { id: 'invited-user-id' } },
    updatePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

async function submit(password, confirmation) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'Set password' }))
}

describe('SetPasswordPage', () => {
  it('requires matching passwords before calling Supabase', async () => {
    const auth = createAuth()
    renderPage(auth)

    await submit('password-one', 'password-two')

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(auth.updatePassword).not.toHaveBeenCalled()
  })

  it('shows the existing eight-character password policy', async () => {
    const auth = createAuth()
    renderPage(auth)

    await submit('short', 'short')

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters long.')
    expect(auth.updatePassword).not.toHaveBeenCalled()
  })

  it('shows password update errors and remains on setup', async () => {
    const auth = createAuth({
      updatePassword: vi.fn().mockRejectedValue(new Error('Unable to update your password. Please try again.')),
    })
    renderPage(auth)

    await submit('secure-password', 'secure-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to update your password. Please try again.')
    expect(auth.refreshProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument()
  })

  it('requires server-confirmed onboarding before navigating', async () => {
    const auth = createAuth({
      refreshProfile: vi.fn().mockResolvedValue({ active: true, onboarding_completed_at: null }),
    })
    renderPage(auth)

    await submit('secure-password', 'secure-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('account setup is still pending')
    expect(auth.updatePassword).toHaveBeenCalledWith('secure-password')
    expect(auth.refreshProfile).toHaveBeenCalledOnce()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
  })

  it('shows profile refresh failures without granting access', async () => {
    const auth = createAuth({
      refreshProfile: vi.fn().mockRejectedValue(new Error('Your account profile could not be refreshed. Please try again.')),
    })
    renderPage(auth)

    await submit('secure-password', 'secure-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Your account profile could not be refreshed. Please try again.')
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
  })

  it('navigates only after password update and confirmed profile refresh', async () => {
    const auth = createAuth()
    renderPage(auth)

    await submit('secure-password', 'secure-password')

    await waitFor(() => expect(screen.getByText('Workspace')).toBeInTheDocument())
    expect(auth.updatePassword).toHaveBeenCalledWith('secure-password')
    expect(auth.refreshProfile).toHaveBeenCalledOnce()
  })

  it('redirects missing invitation sessions to login', () => {
    renderPage(createAuth({ session: null }))

    expect(screen.getByText('Login')).toBeInTheDocument()
  })
})
