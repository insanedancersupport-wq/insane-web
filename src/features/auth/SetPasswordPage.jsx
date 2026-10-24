import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingState } from '../../components/feedback/LoadingState'
import { useAuth } from './AuthContext'

export function SetPasswordPage() {
  const { isLoading, refreshProfile, session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  if (isLoading) {
    return <LoadingState label="Verifying invitation" />
  }

  if (!session) {
    return <Navigate replace to="/login" />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await updatePassword(password)
      const refreshedProfile = await refreshProfile()

      if (!refreshedProfile.onboarding_completed_at) {
        throw new Error('Your password was updated, but account setup is still pending. Please try again.')
      }

      navigate('/app', { replace: true })
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="set-password-title" className="auth-card">
        <p className="eyebrow">Welcome to Insane Dance Center</p>
        <h1 id="set-password-title">Set your password</h1>
        <p className="auth-card__description">Create a password with at least 8 characters to access your workspace.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            autoComplete="new-password"
            label="New password"
            minLength="8"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <Input
            autoComplete="new-password"
            label="Confirm password"
            minLength="8"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
          {error && <p className="auth-form__error" role="alert">{error}</p>}
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Setting password...' : 'Set password'}
          </Button>
        </form>
      </section>
    </main>
  )
}
