import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../auth/AuthContext'
import { listTrainers } from '../trainers/trainersApi'
import { getGroup, listGroupTrainers, reconcileGroupTrainers } from './groupsApi'

function TrainerAssignments({ assignments, groupId, trainers }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [primaryId, setPrimaryId] = useState('')
  const mutation = useMutation({
    mutationFn: reconcileGroupTrainers,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-trainers', groupId] }),
  })

  useEffect(() => {
    setSelectedIds(assignments.map((assignment) => assignment.trainer_id))
    setPrimaryId(assignments.find((assignment) => assignment.is_primary)?.trainer_id ?? '')
  }, [assignments])

  function toggleTrainer(trainerId) {
    setSelectedIds((current) => {
      const next = current.includes(trainerId)
        ? current.filter((id) => id !== trainerId)
        : [...current, trainerId]
      if (!next.includes(primaryId)) {
        setPrimaryId('')
      }
      return next
    })
  }

  async function saveAssignments(event) {
    event.preventDefault()
    setError('')
    try {
      await mutation.mutateAsync({
        groupId,
        primaryTrainerId: primaryId,
        trainerIds: selectedIds,
      })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <Card className="detail-card">
      <h3>Trainer assignments</h3>
      <p>Changes are reconciled in a single database transaction.</p>
      <form className="entity-form" onSubmit={saveAssignments}>
        <fieldset className="assignment-list">
          <legend>Assigned trainers</legend>
          {trainers.filter((trainer) => trainer.active).map((trainer) => (
            <label className="assignment-option" key={trainer.id}>
              <input
                checked={selectedIds.includes(trainer.id)}
                onChange={() => toggleTrainer(trainer.id)}
                type="checkbox"
              />
              {trainer.first_name} {trainer.last_name}
            </label>
          ))}
        </fieldset>
        <label className="field" htmlFor="primary-trainer">
          <span className="field__label">Primary trainer</span>
          <select
            className="field__input"
            id="primary-trainer"
            onChange={(event) => setPrimaryId(event.target.value)}
            value={primaryId}
          >
            <option value="">No primary trainer</option>
            {trainers.filter((trainer) => selectedIds.includes(trainer.id)).map((trainer) => (
              <option key={trainer.id} value={trainer.id}>{trainer.first_name} {trainer.last_name}</option>
            ))}
          </select>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? 'Saving assignments...' : 'Save trainer assignments'}
        </Button>
      </form>
    </Card>
  )
}

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

  if (groupQuery.isLoading) {
    return <AppShell title="Group"><LoadingState label="Loading group" /></AppShell>
  }

  if (groupQuery.error) {
    return <AppShell title="Group"><ErrorState title="Unable to load group" /></AppShell>
  }

  const group = groupQuery.data
  const isAdmin = profile.role === 'admin'

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
          <div><dt>Status</dt><dd><Badge tone={group.active ? 'success' : 'danger'}>{group.active ? 'Active' : 'Inactive'}</Badge></dd></div>
        </dl>
      </Card>
      {isAdmin && assignmentsQuery.isLoading && <LoadingState label="Loading trainer assignments" />}
      {isAdmin && assignmentsQuery.error && <ErrorState title="Unable to load trainer assignments" />}
      {isAdmin && trainersQuery.error && <ErrorState title="Unable to load trainers" />}
      {isAdmin && assignmentsQuery.data && trainersQuery.data && (
        <TrainerAssignments assignments={assignmentsQuery.data} groupId={groupId} trainers={trainersQuery.data} />
      )}
    </AppShell>
  )
}
