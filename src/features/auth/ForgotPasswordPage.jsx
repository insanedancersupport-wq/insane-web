import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from './AuthContext'

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wasSubmitted, setWasSubmitted] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await sendPasswordReset(email)
      setWasSubmitted(true)
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="forgot-password-title" className="auth-card">
        <p className="eyebrow">Password reset</p>
        <h1 id="forgot-password-title">Reset your password</h1>
        {wasSubmitted ? (
          <p className="auth-card__description" role="status">
            If an account exists for that email address, a password reset link has been sent.
          </p>
        ) : (
          <>
            <p className="auth-card__description">Enter your work email address to receive a reset link.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <Input
                autoComplete="email"
                label="Email address"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              {error && <p className="auth-form__error" role="alert">{error}</p>}
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
        <Link className="auth-card__link" to="/login">Back to sign in</Link>
      </section>
    </main>
  )
}
