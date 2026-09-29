import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '../components/feedback/EmptyState'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../features/auth/AuthContext'

export function App() {
  const { profile, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')

    try {
      await signOut()
    } catch (error) {
      setSignOutError(error.message)
    }
  }

  return (
    <AppShell title="Dashboard">
      <section className="page-intro" aria-labelledby="dashboard-title">
        <p className="eyebrow">Insane Dance Center</p>
        <h2 id="dashboard-title">Welcome, {profile.full_name}</h2>
        <p>You are signed in as a {profile.role}.</p>
      </section>

      <Card className="dashboard-placeholder">
        <EmptyState
          description="Your workspace is ready for the next approved module."
          icon={Sparkles}
          title="Authentication is connected"
          action={(
            <div className="dashboard-placeholder__actions">
              {signOutError && <p role="alert">{signOutError}</p>}
              <Button onClick={handleSignOut} variant="secondary">Sign out</Button>
            </div>
          )}
        />
      </Card>
    </AppShell>
  )
}
