import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '../../services/supabaseClient'
import { queryClient } from '../../app/queryClient'

export const AuthContext = createContext(null)

function configuredClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the public Vite environment variables.')
  }

  return supabase
}

async function clearAuthenticatedQueryCaches() {
  await queryClient.cancelQueries({ queryKey: ['reports'] })
  queryClient.removeQueries({ queryKey: ['reports'] })
  queryClient.removeQueries({ queryKey: ['dashboard'] })
}

export function AuthProvider({ children }) {
  const currentUserId = useRef(null)
  const [state, setState] = useState({
    isLoading: true,
    profile: null,
    profileError: null,
    session: null,
  })

  useEffect(() => {
    let mounted = true

    async function fetchProfile(session) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, active, onboarding_completed_at')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        throw new Error('Your account profile could not be loaded.')
      }

      return data
    }

    async function loadProfile(session) {
      const nextUserId = session?.user.id ?? null
      const userChanged = currentUserId.current !== null && currentUserId.current !== nextUserId

      if (!session || userChanged) {
        currentUserId.current = nextUserId
        await clearAuthenticatedQueryCaches()
      } else if (nextUserId) {
        currentUserId.current = nextUserId
      }

      if (!session) {
        if (mounted) {
          setState({ isLoading: false, profile: null, profileError: null, session: null })
        }
        return
      }

      if (!supabase) {
        if (mounted) {
          setState({
            isLoading: false,
            profile: null,
            profileError: 'Supabase is not configured.',
            session,
          })
        }
        return
      }

      let profile = null
      let profileError = null

      try {
        profile = await fetchProfile(session)
      } catch (error) {
        profileError = error.message
      }

      if (!mounted) {
        return
      }

      setState({
        isLoading: false,
        profile,
        profileError,
        session,
      })
    }

    if (!supabase) {
      void clearAuthenticatedQueryCaches()
      setState({
        isLoading: false,
        profile: null,
        profileError: 'Supabase is not configured.',
        session: null,
      })
      return undefined
    }

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) {
        return
      }

      if (error) {
        await clearAuthenticatedQueryCaches()
        if (!mounted) {
          return
        }
        setState({
          isLoading: false,
          profile: null,
          profileError: 'Your session could not be restored.',
          session: null,
        })
        return
      }

      void loadProfile(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      async signIn({ email, password }) {
        const client = configuredClient()
        const { error } = await client.auth.signInWithPassword({ email, password })

        if (error) {
          throw new Error('Unable to sign in. Check your email and password.')
        }
      },
      async signOut() {
        const client = configuredClient()
        const { error } = await client.auth.signOut()

        if (error) {
          throw new Error('Unable to sign out. Please try again.')
        }

        await clearAuthenticatedQueryCaches()
      },
      async sendPasswordReset(email) {
        const client = configuredClient()
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })

        if (error) {
          throw new Error('Unable to send the reset email. Please try again.')
        }
      },
      async updatePassword(password) {
        const client = configuredClient()
        const { error } = await client.auth.updateUser({ password })

        if (error) {
          throw new Error('Unable to update your password. Please try again.')
        }
      },
      async completeInitialPassword(password) {
        const client = configuredClient()
        const { error } = await client.functions.invoke('complete-initial-password', {
          body: { password },
        })

        if (error) {
          throw new Error('Unable to set your password. Please try again.')
        }
      },
      async refreshProfile() {
        if (!state.session) {
          throw new Error('Your session has expired. Please sign in again.')
        }

        const client = configuredClient()
        const { data, error } = await client
          .from('profiles')
          .select('id, full_name, role, active, onboarding_completed_at')
          .eq('id', state.session.user.id)
          .maybeSingle()

        if (error || !data) {
          throw new Error('Your account profile could not be refreshed. Please try again.')
        }

        setState((currentState) => (
          currentState.session?.user.id === state.session.user.id
            ? { ...currentState, profile: data, profileError: null }
            : currentState
        ))

        return data
      },
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }

  return context
}
