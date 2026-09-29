import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingState } from '../../components/feedback/LoadingState'
import { useAuth } from './AuthContext'

export function ResetPasswordPage() {
  const { isLoading, session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  if (isLoading) {
    return <LoadingState label="Verifying password reset link" />
  }

  if (!session) {
    return <Navigate replace to="/login" />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await updatePassword(password)
      navigate('/app', { replace: true })
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="reset-password-title" className="auth-card">
        <p className="eyebrow">Password reset</p>
        <h1 id="reset-password-title">Choose a new password</h1>
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
          {error && <p className="auth-form__error" role="alert">{error}</p>}
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </section>
    </main>
  )
}
