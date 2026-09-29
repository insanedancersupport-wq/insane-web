import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { supabase } from '../../services/supabaseClient'

export const AuthContext = createContext(null)

function configuredClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the public Vite environment variables.')
  }

  return supabase
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    isLoading: true,
    profile: null,
    profileError: null,
    session: null,
  })

  useEffect(() => {
    let mounted = true

    async function loadProfile(session) {
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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, active')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!mounted) {
        return
      }

      setState({
        isLoading: false,
        profile: data,
        profileError: error ? 'Your account profile could not be loaded.' : null,
        session,
      })
    }

    if (!supabase) {
      setState({
        isLoading: false,
        profile: null,
        profileError: 'Supabase is not configured.',
        session: null,
      })
      return undefined
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return
      }

      if (error) {
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
