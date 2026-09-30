import { Link } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { Card } from '../components/ui/Card'
import { useAuth } from '../features/auth/AuthContext'

export function MorePage() {
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'

  return (
    <AppShell title="More">
      <section className="page-intro" aria-labelledby="more-title">
        <p className="eyebrow">Workspace</p>
        <h2 id="more-title">More</h2>
        <p>Access the areas available to your role.</p>
      </section>
      <section aria-label="Additional navigation" className="more-links">
        {isAdmin && (
          <>
            <Card><Link to="/app/trainers">Trainers</Link><p>Create and manage trainer records.</p></Card>
            <Card><Link to="/app/rooms">Rooms</Link><p>Maintain available studio spaces.</p></Card>
            <Card><Link to="/app/users">Users</Link><p>Invite and manage application accounts.</p></Card>
          </>
        )}
        <Card><Link to="/app/groups">Groups</Link><p>Review dance groups and assignments.</p></Card>
        <Card><Link to="/app/students">Students</Link><p>Review student records.</p></Card>
      </section>
    </AppShell>
  )
}
