import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { createGroup, listGroups, updateGroup } from './groupsApi'

const groupSchema = z.object({
  category: z.string(),
  default_room_id: z.string(),
  description: z.string(),
  level: z.string(),
  name: z.string().trim().min(1, 'Group name is required.'),
})

function GroupForm({ onCancel, onSubmit, group, rooms, saving }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: group
      ? { ...group, default_room_id: group.default_room_id ?? '' }
      : { category: '', default_room_id: '', description: '', level: '', name: '' },
    resolver: zodResolver(groupSchema),
  })

  return (
    <form className="entity-form" onSubmit={handleSubmit((values) => onSubmit({
      ...values,
      default_room_id: values.default_room_id || null,
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
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: listGroups })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms })
  const mutation = useMutation({
    mutationFn: (values) => (editingGroup?.id
      ? updateGroup({ id: editingGroup.id, values })
      : createGroup(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setEditingGroup(null)
    },
  })
  const isAdmin = profile.role === 'admin'

  async function saveGroup(values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function setActive(group) {
    setError('')
    try {
      await updateGroup({ id: group.id, values: { active: !group.active } })
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
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
          <GroupForm
            group={editingGroup?.id ? editingGroup : null}
            onCancel={() => setEditingGroup(null)}
            onSubmit={saveGroup}
            rooms={roomsQuery.data ?? []}
            saving={mutation.isPending}
          />
        </Dialog>
      )}
    </AppShell>
  )
}
