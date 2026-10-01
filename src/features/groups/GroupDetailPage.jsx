import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../auth/AuthContext'
import { listTrainers } from '../trainers/trainersApi'
import { getGroup, listGroupTrainers } from './groupsApi'
import { listRooms } from '../rooms/roomsApi'

export function GroupDetailPage() {
  const { profile } = useAuth()
  const { groupId } = useParams()
  const groupQuery = useQuery({ queryKey: ['groups', groupId], queryFn: () => getGroup(groupId) })
  const assignmentsQuery = useQuery({
    enabled: profile.role === 'admin',
    queryKey: ['group-trainers', groupId],
    queryFn: () => listGroupTrainers(groupId),
  })
  const trainersQuery = useQuery({
    enabled: profile.role === 'admin',
    queryKey: ['trainers'],
    queryFn: listTrainers,
  })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms })

  if (groupQuery.isLoading) {
    return <AppShell title="Group"><LoadingState label="Loading group" /></AppShell>
  }

  if (groupQuery.error) {
    return <AppShell title="Group"><ErrorState title="Unable to load group" /></AppShell>
  }

  const group = groupQuery.data
  const isAdmin = profile.role === 'admin'
  const defaultRoom = roomsQuery.data?.find((room) => room.id === group.default_room_id)
  const trainersById = new Map(trainersQuery.data?.map((trainer) => [trainer.id, trainer]))

  return (
    <AppShell title="Group details">
      <Link className="back-link" to="/app/groups">Back to groups</Link>
      <section className="page-intro" aria-labelledby="group-detail-title">
        <p className="eyebrow">Training group</p>
        <h2 id="group-detail-title">{group.name}</h2>
        <p>{group.description || 'No description provided.'}</p>
      </section>
      <Card className="detail-card">
        <h3>Group information</h3>
        <dl className="detail-list">
          <div><dt>Category</dt><dd>{group.category || 'Not set'}</dd></div>
          <div><dt>Level</dt><dd>{group.level || 'Not set'}</dd></div>
          <div><dt>Default room</dt><dd>{defaultRoom?.name || 'Not set'}</dd></div>
          <div><dt>Status</dt><dd><Badge tone={group.active ? 'success' : 'danger'}>{group.active ? 'Active' : 'Inactive'}</Badge></dd></div>
        </dl>
      </Card>
      {isAdmin && assignmentsQuery.isLoading && <LoadingState label="Loading trainer assignments" />}
      {isAdmin && assignmentsQuery.error && <ErrorState title="Unable to load trainer assignments" />}
      {isAdmin && trainersQuery.error && <ErrorState title="Unable to load trainers" />}
      {isAdmin && assignmentsQuery.data && trainersQuery.data && (
        <Card className="detail-card">
          <h3>Assigned trainers</h3>
          {assignmentsQuery.data.length === 0 ? (
            <p>No trainers are assigned to this group.</p>
          ) : (
            <ul className="assigned-trainer-list">
              {assignmentsQuery.data.map((assignment) => {
                const trainer = trainersById.get(assignment.trainer_id)
                return (
                  <li key={assignment.trainer_id}>
                    <span>{trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Unavailable trainer'}</span>
                    {assignment.is_primary && <Badge tone="warning">Primary trainer</Badge>}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}
    </AppShell>
  )
}
