import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { isLoading, profile, profileError, session } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingState label="Restoring your session" />
  }

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (profileError || !profile) {
    return (
      <ErrorState
        description={profileError ?? 'Your account profile has not been configured yet.'}
        title="Account setup required"
      />
    )
  }

  if (!profile.active) {
    return (
      <ErrorState
        description="This account is inactive. Contact an administrator for access."
        title="Account unavailable"
      />
    )
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return <LoadingState label="Checking your session" />
  }

  return session ? <Navigate replace to="/app" /> : <Outlet />
}
