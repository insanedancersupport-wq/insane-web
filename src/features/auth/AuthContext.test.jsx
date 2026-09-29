import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

function SessionConsumer() {
  const { isLoading, profile, session } = useAuth()

  if (isLoading) {
    return <p>Loading</p>
  }

  return <p>{session?.user.id}:{profile?.role}</p>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-id' } } },
      error: null,
    })
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
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
})
