import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './AuthContext'
import { queryClient } from '../../app/queryClient'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

function SessionConsumer() {
  const { isLoading, profile, session, signOut } = useAuth()

  if (isLoading) {
    return <p>Loading</p>
  }

  return <><p>{session?.user.id}:{profile?.role}</p><button onClick={() => void signOut()} type="button">Sign out</button></>
}

describe('AuthProvider', () => {
  let authStateChange

  beforeEach(() => {
    queryClient.clear()
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-id' } } },
      error: null,
    })
    supabase.auth.signOut.mockResolvedValue({ error: null })
    supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateChange = callback
      return {
      data: { subscription: { unsubscribe: vi.fn() } },
      }
    })
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { active: true, full_name: 'Alex Trainer', id: 'user-id', role: 'trainer' },
            error: null,
          }),
        }),
      }),
    })
  })

  it('restores the Supabase session and loads its application profile', async () => {
    render(
      <AuthProvider>
        <SessionConsumer />
      </AuthProvider>,
    )

    expect(await screen.findByText('user-id:trainer')).toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
  })

  it('removes dashboard and reports data on explicit sign-out, including an in-flight report', async () => {
    render(
      <AuthProvider>
        <SessionConsumer />
      </AuthProvider>,
    )
    await screen.findByText('user-id:trainer')
    queryClient.setQueryData(['dashboard', 'user-id'], { summary: true })
    queryClient.setQueryData(['reports', 'user-id', 'trainer'], { student: 'Alex' })
    queryClient.setQueryData(['groups'], { unrelated: true })

    let resolveRequest
    const request = queryClient.fetchQuery({
      queryKey: ['reports', 'user-id', 'trainer', 'pending'],
      queryFn: () => new Promise((resolve) => { resolveRequest = resolve }),
    })
    void request.catch(() => undefined)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => {
      expect(queryClient.getQueryData(['dashboard', 'user-id'])).toBeUndefined()
      expect(queryClient.getQueryData(['reports', 'user-id', 'trainer'])).toBeUndefined()
    })
    resolveRequest({ student: 'Sensitive result' })
    await Promise.resolve()

    expect(queryClient.getQueryData(['reports', 'user-id', 'trainer', 'pending'])).toBeUndefined()
    expect(queryClient.getQueryData(['groups'])).toEqual({ unrelated: true })
  })

  it('removes report and dashboard data on session loss and user switching', async () => {
    render(
      <AuthProvider>
        <SessionConsumer />
      </AuthProvider>,
    )
    await screen.findByText('user-id:trainer')
    queryClient.setQueryData(['dashboard', 'user-id'], { summary: true })
    queryClient.setQueryData(['reports', 'user-id', 'trainer'], { student: 'Alex' })

    await act(async () => {
      authStateChange('SIGNED_OUT', null)
    })
    await waitFor(() => expect(queryClient.getQueryData(['reports', 'user-id', 'trainer'])).toBeUndefined())
    expect(queryClient.getQueryData(['dashboard', 'user-id'])).toBeUndefined()

    await act(async () => {
      authStateChange('SIGNED_IN', { user: { id: 'new-user-id' } })
    })
    await screen.findByText('new-user-id:trainer')
    queryClient.setQueryData(['reports', 'new-user-id', 'trainer'], { student: 'Alex' })
    queryClient.setQueryData(['dashboard', 'new-user-id'], { summary: true })
    await act(async () => {
      authStateChange('SIGNED_IN', { user: { id: 'another-user-id' } })
    })

    await waitFor(() => expect(queryClient.getQueryData(['reports', 'new-user-id', 'trainer'])).toBeUndefined())
    expect(queryClient.getQueryData(['dashboard', 'new-user-id'])).toBeUndefined()
  })

  afterEach(() => {
    cleanup()
    queryClient.clear()
  })
})
