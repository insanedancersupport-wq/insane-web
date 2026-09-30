import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { getTrainer } from './trainersApi'

export function TrainerDetailPage() {
  const { trainerId } = useParams()
  const trainerQuery = useQuery({
    queryKey: ['trainers', trainerId],
    queryFn: () => getTrainer(trainerId),
  })

  if (trainerQuery.isLoading) {
    return <AppShell title="Trainer"><LoadingState label="Loading trainer" /></AppShell>
  }

  if (trainerQuery.error) {
    return <AppShell title="Trainer"><ErrorState title="Unable to load trainer" /></AppShell>
  }

  const trainer = trainerQuery.data

  return (
    <AppShell title="Trainer details">
      <Link className="back-link" to="/app/trainers">Back to trainers</Link>
      <section className="page-intro" aria-labelledby="trainer-detail-title">
        <p className="eyebrow">Trainer</p>
        <h2 id="trainer-detail-title">{trainer.first_name} {trainer.last_name}</h2>
        <p>{trainer.notes || 'No notes provided.'}</p>
      </section>
      <Card className="detail-card">
        <h3>Trainer information</h3>
        <dl className="detail-list">
          <div><dt>Status</dt><dd><Badge tone={trainer.active ? 'success' : 'danger'}>{trainer.active ? 'Active' : 'Inactive'}</Badge></dd></div>
          <div><dt>Email</dt><dd>{trainer.email || 'Not set'}</dd></div>
          <div><dt>Phone</dt><dd>{trainer.phone || 'Not set'}</dd></div>
          <div><dt>Application profile</dt><dd>{trainer.profile_id ? 'Linked' : 'Not linked'}</dd></div>
        </dl>
      </Card>
    </AppShell>
  )
}
