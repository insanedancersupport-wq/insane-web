import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthContext } from './AuthContext'
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from './RouteGuards'

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
      profile: { active: true, full_name: 'Alex Trainer', role: 'trainer' },
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
      profile: { active: true, full_name: 'Alex Admin', role: 'admin' },
      profileError: null,
      session: { user: { id: 'admin-id' } },
    }, (
      <>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<p>Login screen</p>} path="/login" />
        </Route>
        <Route element={<p>Protected dashboard</p>} path="/app" />
      </>
    ))

    expect(screen.getByText('Protected dashboard')).toBeInTheDocument()
  })

  it('denies non-admin users access to user administration routes', () => {
    renderWithAuth('/app/users', {
      isLoading: false,
      profile: { active: true, full_name: 'Alex Trainer', role: 'trainer' },
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
})
