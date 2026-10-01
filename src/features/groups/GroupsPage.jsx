import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../auth/AuthContext'
import { listRooms } from '../rooms/roomsApi'
import {
  createGroup,
  listGroupTrainers,
  listGroupsWithDetails,
  reconcileGroupTrainers,
  updateGroup,
} from './groupsApi'
import { listTrainers } from '../trainers/trainersApi'

const groupSchema = z.object({
  category: z.string(),
  default_room_id: z.string(),
  description: z.string(),
  level: z.string(),
  name: z.string().trim().min(1, 'Group name is required.'),
})

function trainerSummary(assignments) {
  const trainers = assignments
    .map((assignment) => {
      if (!assignment.trainer) {
        return null
      }

      const name = `${assignment.trainer.first_name} ${assignment.trainer.last_name}`
      return assignment.is_primary ? `${name} (Primary)` : name
    })
    .filter(Boolean)

  return trainers.length > 0 ? trainers.join(', ') : 'No trainers assigned'
}

function GroupForm({ assignments, group, onCancel, onSubmit, rooms, saving, trainers }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: group
      ? { ...group, default_room_id: group.default_room_id ?? '' }
      : { category: '', default_room_id: '', description: '', level: '', name: '' },
    resolver: zodResolver(groupSchema),
  })
  const [selectedTrainerIds, setSelectedTrainerIds] = useState([])
  const [primaryTrainerId, setPrimaryTrainerId] = useState('')

  useEffect(() => {
    setSelectedTrainerIds(assignments.map((assignment) => assignment.trainer_id))
    setPrimaryTrainerId(assignments.find((assignment) => assignment.is_primary)?.trainer_id ?? '')
  }, [assignments, group?.id])

  function toggleTrainer(trainerId) {
    setSelectedTrainerIds((current) => {
      const next = current.includes(trainerId)
        ? current.filter((id) => id !== trainerId)
        : [...current, trainerId]

      if (!next.includes(primaryTrainerId)) {
        setPrimaryTrainerId('')
      }

      return next
    })
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit((values) => onSubmit({
      primaryTrainerId,
      trainerIds: selectedTrainerIds,
      values: {
        ...values,
        default_room_id: values.default_room_id || null,
      },
    }))}>
      <Input label="Group name" {...register('name')} />
      {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
      <Input label="Category" {...register('category')} />
      <Input label="Level" {...register('level')} />
      <label className="field" htmlFor="group-room">
        <span className="field__label">Default room</span>
        <select className="field__input" id="group-room" {...register('default_room_id')}>
          <option value="">No default room</option>
          {rooms.filter((room) => room.active).map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="group-description">
        <span className="field__label">Description</span>
        <textarea className="field__input field__textarea" id="group-description" {...register('description')} />
      </label>
      <fieldset className="assignment-list">
        <legend>Assigned trainers</legend>
        {trainers.filter((trainer) => trainer.active).map((trainer) => (
          <label className="assignment-option" key={trainer.id}>
            <input
              checked={selectedTrainerIds.includes(trainer.id)}
              onChange={() => toggleTrainer(trainer.id)}
              type="checkbox"
            />
            {trainer.first_name} {trainer.last_name}
          </label>
        ))}
      </fieldset>
      <label className="field" htmlFor="group-primary-trainer">
        <span className="field__label">Primary trainer</span>
        <select
          className="field__input"
          id="group-primary-trainer"
          onChange={(event) => setPrimaryTrainerId(event.target.value)}
          value={primaryTrainerId}
        >
          <option value="">No primary trainer</option>
          {trainers.filter((trainer) => selectedTrainerIds.includes(trainer.id)).map((trainer) => (
            <option key={trainer.id} value={trainer.id}>{trainer.first_name} {trainer.last_name}</option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <Button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save group'}</Button>
        <Button disabled={saving} onClick={onCancel} variant="tertiary">Cancel</Button>
      </div>
    </form>
  )
}

export function GroupsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editingGroup, setEditingGroup] = useState(null)
  const [error, setError] = useState('')
  const groupsQuery = useQuery({ queryKey: ['groups-with-details'], queryFn: listGroupsWithDetails })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms })
  const trainersQuery = useQuery({ queryKey: ['trainers'], queryFn: listTrainers })
  const assignmentsQuery = useQuery({
    enabled: Boolean(editingGroup?.id),
    queryKey: ['group-trainers', editingGroup?.id],
    queryFn: () => listGroupTrainers(editingGroup.id),
  })
  const mutation = useMutation({
    mutationFn: async ({ primaryTrainerId, trainerIds, values }) => {
      let groupId
      let scalarSaveCompleted = false

      try {
        groupId = editingGroup?.id
          ? editingGroup.id
          : (await createGroup(values)).id

        if (editingGroup?.id) {
          await updateGroup({ id: groupId, values })
        }

        scalarSaveCompleted = true
        await reconcileGroupTrainers({ groupId, primaryTrainerId, trainerIds })
        return groupId
      } catch (saveError) {
        if (scalarSaveCompleted) {
          const reconciliationError = new Error(
            'Group details were saved, but trainer assignments could not be saved. Edit the group to retry the assignments.',
          )
          reconciliationError.entitySaved = true
          throw reconciliationError
        }

        throw saveError
      }
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups-with-details'] })
      queryClient.invalidateQueries({ queryKey: ['group-trainers', groupId] })
      setEditingGroup(null)
    },
  })
  const isAdmin = profile.role === 'admin'

  async function saveGroup(values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (saveError) {
      if (saveError.entitySaved) {
        await queryClient.invalidateQueries({ queryKey: ['groups'] })
        await queryClient.invalidateQueries({ queryKey: ['groups-with-details'] })
        setEditingGroup(null)
      }
      setError(saveError.message)
    }
  }

  async function setActive(group) {
    setError('')
    try {
      await updateGroup({ id: group.id, values: { active: !group.active } })
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: ['groups-with-details'] })
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  return (
    <AppShell title="Groups">
      <section className="page-intro" aria-labelledby="groups-title">
        <p className="eyebrow">Training</p>
        <h2 id="groups-title">Groups</h2>
        <p>{isAdmin ? 'Manage groups, trainer assignments, and default rooms.' : 'View your assigned dance groups.'}</p>
      </section>
      {isAdmin && <Button onClick={() => setEditingGroup({})}>Add group</Button>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {groupsQuery.isLoading && <LoadingState label="Loading groups" />}
      {groupsQuery.error && <ErrorState title="Unable to load groups" />}
      {groupsQuery.data?.length === 0 && <EmptyState description="No groups are available to your account." title="No groups yet" />}
      <section aria-label="Groups" className="entity-list">
        {groupsQuery.data?.map((group) => (
          <Card className="entity-row" key={group.id}>
            <div>
              <h3>{group.name}</h3>
              <p>{[group.category, group.level].filter(Boolean).join(' · ') || 'No category or level'}</p>
              <p>Trainers: {trainerSummary(group.group_trainers ?? [])}</p>
              <p>Default room: {group.default_room?.name || 'Not set'}</p>
              <p>
                Active students: {(group.student_groups ?? []).filter(
                  (membership) => membership.student?.status === 'active',
                ).length}
              </p>
              <Badge tone={group.active ? 'success' : 'danger'}>{group.active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="entity-row__actions">
              <Link className="button button--tertiary" to={`/app/groups/${group.id}`}>View details</Link>
              {isAdmin && <Button onClick={() => setEditingGroup(group)} variant="secondary">Edit</Button>}
              {isAdmin && (
                <Button onClick={() => void setActive(group)} variant="tertiary">
                  {group.active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </section>
      {isAdmin && (
        <Dialog
          onClose={() => !mutation.isPending && setEditingGroup(null)}
          open={editingGroup !== null}
          title={editingGroup?.id ? 'Edit group' : 'Add group'}
        >
          {editingGroup?.id && assignmentsQuery.isLoading && <LoadingState label="Loading trainer assignments" />}
          {editingGroup?.id && assignmentsQuery.error && <ErrorState title="Unable to load trainer assignments" />}
          {trainersQuery.error && <ErrorState title="Unable to load trainers" />}
          {(!editingGroup?.id || assignmentsQuery.data) && !trainersQuery.error && (
            <GroupForm
              assignments={assignmentsQuery.data ?? []}
              group={editingGroup?.id ? editingGroup : null}
              onCancel={() => setEditingGroup(null)}
              onSubmit={saveGroup}
              rooms={roomsQuery.data ?? []}
              saving={mutation.isPending}
              trainers={trainersQuery.data ?? []}
            />
          )}
        </Dialog>
      )}
    </AppShell>
  )
}
