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

  if (!profile.onboarding_completed_at) {
    return <Navigate replace to="/set-password" />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isLoading, profile, session } = useAuth()

  if (isLoading) {
    return <LoadingState label="Checking your session" />
  }

  if (!session) {
    return <Outlet />
  }

  return <Navigate replace to={profile?.onboarding_completed_at ? '/app/dashboard' : '/set-password'} />
}

export function PasswordSetupRoute() {
  const { isLoading, profile, profileError, session } = useAuth()

  if (isLoading) {
    return <LoadingState label="Checking your account" />
  }

  if (!session) {
    return <Navigate replace to="/login" />
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

  return profile.onboarding_completed_at ? <Navigate replace to="/app/dashboard" /> : <Outlet />
}

export function AdminRoute() {
  const { profile } = useAuth()

  if (profile?.role !== 'admin') {
    return (
      <ErrorState
        description="Only administrators can manage application users."
        title="Administrator access required"
      />
    )
  }

  return <Outlet />
}
