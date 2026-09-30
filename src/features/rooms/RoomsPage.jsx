import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { createRoom, listRooms, updateRoom } from './roomsApi'

const roomSchema = z.object({
  description: z.string(),
  name: z.string().trim().min(1, 'Room name is required.'),
})

function RoomForm({ onCancel, onSubmit, room, saving }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: room ?? { description: '', name: '' },
    resolver: zodResolver(roomSchema),
  })

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <Input label="Room name" {...register('name')} />
      {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
      <label className="field" htmlFor="room-description">
        <span className="field__label">Description</span>
        <textarea className="field__input field__textarea" id="room-description" {...register('description')} />
      </label>
      <div className="form-actions">
        <Button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save room'}</Button>
        <Button disabled={saving} onClick={onCancel} variant="tertiary">Cancel</Button>
      </div>
    </form>
  )
}

export function RoomsPage() {
  const queryClient = useQueryClient()
  const [editingRoom, setEditingRoom] = useState(null)
  const [error, setError] = useState('')
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms })
  const mutation = useMutation({
    mutationFn: (values) => (editingRoom?.id
      ? updateRoom({ id: editingRoom.id, values })
      : createRoom(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setEditingRoom(null)
    },
  })

  async function saveRoom(values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function setActive(room) {
    setError('')
    try {
      await updateRoom({ id: room.id, values: { active: !room.active } })
      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  return (
    <AppShell title="Rooms">
      <section className="page-intro" aria-labelledby="rooms-title">
        <p className="eyebrow">Administration</p>
        <h2 id="rooms-title">Rooms</h2>
        <p>Maintain the spaces available for future class scheduling.</p>
      </section>
      <Button onClick={() => setEditingRoom({})}>Add room</Button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {roomsQuery.isLoading && <LoadingState label="Loading rooms" />}
      {roomsQuery.error && <ErrorState title="Unable to load rooms" />}
      {roomsQuery.data?.length === 0 && <EmptyState description="Add the first available room." title="No rooms yet" />}
      <section aria-label="Rooms" className="entity-list">
        {roomsQuery.data?.map((room) => (
          <Card className="entity-row" key={room.id}>
            <div>
              <h3>{room.name}</h3>
              <p>{room.description || 'No description'}</p>
              <Badge tone={room.active ? 'success' : 'danger'}>{room.active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="entity-row__actions">
              <Button onClick={() => setEditingRoom(room)} variant="secondary">Edit</Button>
              <Button onClick={() => void setActive(room)} variant="tertiary">
                {room.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </Card>
        ))}
      </section>
      <Dialog
        onClose={() => !mutation.isPending && setEditingRoom(null)}
        open={editingRoom !== null}
        title={editingRoom?.id ? 'Edit room' : 'Add room'}
      >
        <RoomForm
          onCancel={() => setEditingRoom(null)}
          onSubmit={saveRoom}
          room={editingRoom?.id ? editingRoom : null}
          saving={mutation.isPending}
        />
      </Dialog>
    </AppShell>
  )
}
