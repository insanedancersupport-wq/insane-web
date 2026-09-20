import { Sparkles } from 'lucide-react'

import { EmptyState } from '../components/feedback/EmptyState'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { AppShell } from '../components/layout/AppShell'

export function App() {
  return (
    <AppShell>
      <section className="page-intro" aria-labelledby="dashboard-title">
        <p className="eyebrow">Insane Dance Center</p>
        <h2 id="dashboard-title">Your workspace is ready</h2>
        <p>Dashboard data will appear here once the connected services are available.</p>
      </section>

      <Card className="dashboard-placeholder">
        <EmptyState
          description="Add the first workspace item when the relevant module is available."
          icon={Sparkles}
          title="A focused day starts here"
          action={<Button disabled>Coming soon</Button>}
        />
      </Card>
    </AppShell>
  )
}
