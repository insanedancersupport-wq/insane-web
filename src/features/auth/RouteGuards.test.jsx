import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthContext } from './AuthContext'
import { AdminRoute, PasswordSetupRoute, ProtectedRoute, PublicOnlyRoute } from './RouteGuards'

afterEach(cleanup)

function renderWithAuth(initialEntry, auth, routes) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('route guards', () => {
  it('redirects unauthenticated users away from protected app routes', () => {
    renderWithAuth('/app', {
      isLoading: false,
      profile: null,
      profileError: null,
      session: null,
    }, (
      <>
        <Route element={<ProtectedRoute />}>
          <Route element={<p>Protected dashboard</p>} path="/app" />
        </Route>
        <Route element={<p>Login screen</p>} path="/login" />
      </>
    ))

    expect(screen.getByText('Login screen')).toBeInTheDocument()
  })

  it('allows an authenticated user with an active profile into the app', () => {
    renderWithAuth('/app', {
      isLoading: false,
      profile: { active: true, full_name: 'Alex Trainer', onboarding_completed_at: '2026-10-24T12:00:00Z', role: 'trainer' },
      profileError: null,
      session: { user: { id: 'user-id' } },
    }, (
      <Route element={<ProtectedRoute />}>
        <Route element={<p>Protected dashboard</p>} path="/app" />
      </Route>
    ))

    expect(screen.getByText('Protected dashboard')).toBeInTheDocument()
  })

  it('redirects authenticated users away from the login route', () => {
    renderWithAuth('/login', {
      isLoading: false,
      profile: { active: true, full_name: 'Alex Admin', onboarding_completed_at: '2026-10-24T12:00:00Z', role: 'admin' },
      profileError: null,
      session: { user: { id: 'admin-id' } },
    }, (
      <>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<p>Login screen</p>} path="/login" />
        </Route>
        <Route element={<p>Protected dashboard</p>} path="/app/dashboard" />
      </>
    ))

    expect(screen.getByText('Protected dashboard')).toBeInTheDocument()
  })

  it('denies non-admin users access to user administration routes', () => {
    renderWithAuth('/app/users', {
      isLoading: false,
      profile: { active: true, full_name: 'Alex Trainer', onboarding_completed_at: '2026-10-24T12:00:00Z', role: 'trainer' },
      profileError: null,
      session: { user: { id: 'trainer-id' } },
    }, (
      <Route element={<AdminRoute />}>
        <Route element={<p>Users page</p>} path="/app/users" />
      </Route>
    ))

    expect(screen.getByRole('heading', { name: 'Administrator access required' })).toBeInTheDocument()
    expect(screen.queryByText('Users page')).not.toBeInTheDocument()
  })

  it('redirects an incomplete authenticated user from the app to password setup', () => {
    renderWithAuth('/app', {
      isLoading: false,
      profile: { active: true, full_name: 'Invited Trainer', onboarding_completed_at: null, role: 'trainer' },
      profileError: null,
      session: { user: { id: 'invited-user-id' } },
    }, (
      <>
        <Route element={<ProtectedRoute />}>
          <Route element={<p>Protected dashboard</p>} path="/app" />
        </Route>
        <Route element={<p>Password setup</p>} path="/set-password" />
      </>
    ))

    expect(screen.getByText('Password setup')).toBeInTheDocument()
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument()
  })

  it('allows only incomplete active users into password setup', () => {
    renderWithAuth('/set-password', {
      isLoading: false,
      profile: { active: true, full_name: 'Invited Trainer', onboarding_completed_at: null, role: 'trainer' },
      profileError: null,
      session: { user: { id: 'invited-user-id' } },
    }, (
      <Route element={<PasswordSetupRoute />}>
        <Route element={<p>Set password form</p>} path="/set-password" />
      </Route>
    ))

    expect(screen.getByText('Set password form')).toBeInTheDocument()
  })

  it('redirects completed users away from password setup without a loop', () => {
    renderWithAuth('/set-password', {
      isLoading: false,
      profile: { active: true, full_name: 'Alex Trainer', onboarding_completed_at: '2026-10-24T12:00:00Z', role: 'trainer' },
      profileError: null,
      session: { user: { id: 'user-id' } },
    }, (
      <>
        <Route element={<PasswordSetupRoute />}>
          <Route element={<p>Set password form</p>} path="/set-password" />
        </Route>
        <Route element={<p>Protected dashboard</p>} path="/app/dashboard" />
      </>
    ))

    expect(screen.getByText('Protected dashboard')).toBeInTheDocument()
  })

  it('keeps inactive users blocked from password setup', () => {
    renderWithAuth('/set-password', {
      isLoading: false,
      profile: { active: false, full_name: 'Inactive Invite', onboarding_completed_at: null, role: 'trainer' },
      profileError: null,
      session: { user: { id: 'inactive-user-id' } },
    }, (
      <Route element={<PasswordSetupRoute />}>
        <Route element={<p>Set password form</p>} path="/set-password" />
      </Route>
    ))

    expect(screen.getByRole('heading', { name: 'Account unavailable' })).toBeInTheDocument()
    expect(screen.queryByText('Set password form')).not.toBeInTheDocument()
  })
})
