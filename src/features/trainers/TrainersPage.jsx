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
import { createTrainer, listAvailableProfiles, listTrainers, updateTrainer } from './trainersApi'

const trainerSchema = z.object({
  email: z.string().email('Enter a valid email address.').or(z.literal('')),
  first_name: z.string().trim().min(1, 'First name is required.'),
  last_name: z.string().trim().min(1, 'Last name is required.'),
  notes: z.string(),
  phone: z.string(),
  profile_id: z.string(),
})

const emptyTrainer = {
  email: '',
  first_name: '',
  last_name: '',
  notes: '',
  phone: '',
  profile_id: '',
}

function TrainerForm({ onCancel, onSubmit, profiles, saving, trainer }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: trainer
      ? { ...trainer, profile_id: trainer.profile_id ?? '' }
      : emptyTrainer,
    resolver: zodResolver(trainerSchema),
  })

  return (
    <form className="entity-form" onSubmit={handleSubmit((values) => onSubmit({
      ...values,
      profile_id: values.profile_id || null,
    }))}>
      <Input label="First name" {...register('first_name')} />
      {errors.first_name && <p className="form-error" role="alert">{errors.first_name.message}</p>}
      <Input label="Last name" {...register('last_name')} />
      {errors.last_name && <p className="form-error" role="alert">{errors.last_name.message}</p>}
      <Input label="Phone" type="tel" {...register('phone')} />
      <Input label="Email" type="email" {...register('email')} />
      {errors.email && <p className="form-error" role="alert">{errors.email.message}</p>}
      <label className="field" htmlFor="trainer-profile">
        <span className="field__label">Linked application profile</span>
        <select className="field__input" id="trainer-profile" {...register('profile_id')}>
          <option value="">Not linked</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}{profile.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="trainer-notes">
        <span className="field__label">Notes</span>
        <textarea className="field__input field__textarea" id="trainer-notes" {...register('notes')} />
      </label>
      <div className="form-actions">
        <Button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save trainer'}</Button>
        <Button disabled={saving} onClick={onCancel} variant="tertiary">Cancel</Button>
      </div>
    </form>
  )
}

export function TrainersPage() {
  const queryClient = useQueryClient()
  const [editingTrainer, setEditingTrainer] = useState(null)
  const [error, setError] = useState('')
  const trainersQuery = useQuery({ queryKey: ['trainers'], queryFn: listTrainers })
  const profilesQuery = useQuery({ queryKey: ['trainer-profiles'], queryFn: listAvailableProfiles })
  const mutation = useMutation({
    mutationFn: (values) => (editingTrainer
      ? updateTrainer({ id: editingTrainer.id, values })
      : createTrainer(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainers'] })
      setEditingTrainer(null)
    },
  })

  async function saveTrainer(values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function setActive(trainer) {
    setError('')
    try {
      await updateTrainer({ id: trainer.id, values: { active: !trainer.active } })
      await queryClient.invalidateQueries({ queryKey: ['trainers'] })
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  const profiles = profilesQuery.data?.filter((profile) => (
    !trainersQuery.data?.some((trainer) => trainer.profile_id === profile.id && trainer.id !== editingTrainer?.id)
  )) ?? []

  return (
    <AppShell title="Trainers">
      <section className="page-intro" aria-labelledby="trainers-title">
        <p className="eyebrow">Administration</p>
        <h2 id="trainers-title">Trainers</h2>
        <p>Create, maintain, and deactivate trainer records. Application accounts are managed separately.</p>
      </section>
      <Button onClick={() => setEditingTrainer({})}>Add trainer</Button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {trainersQuery.isLoading && <LoadingState label="Loading trainers" />}
      {trainersQuery.error && <ErrorState title="Unable to load trainers" />}
      {trainersQuery.data?.length === 0 && <EmptyState description="Add the first trainer record." title="No trainers yet" />}
      <section aria-label="Trainers" className="entity-list">
        {trainersQuery.data?.map((trainer) => (
          <Card className="entity-row" key={trainer.id}>
            <div>
              <h3>{trainer.first_name} {trainer.last_name}</h3>
              <p>{trainer.email || trainer.phone || 'No contact details'}</p>
              <Badge tone={trainer.active ? 'success' : 'danger'}>{trainer.active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="entity-row__actions">
              <Link className="button button--tertiary" to={`/app/trainers/${trainer.id}`}>View details</Link>
              <Button onClick={() => setEditingTrainer(trainer)} variant="secondary">Edit</Button>
              <Button onClick={() => void setActive(trainer)} variant="tertiary">
                {trainer.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </Card>
        ))}
      </section>
      <Dialog
        onClose={() => !mutation.isPending && setEditingTrainer(null)}
        open={editingTrainer !== null}
        title={editingTrainer?.id ? 'Edit trainer' : 'Add trainer'}
      >
        <TrainerForm
          onCancel={() => setEditingTrainer(null)}
          onSubmit={saveTrainer}
          profiles={profiles}
          saving={mutation.isPending}
          trainer={editingTrainer?.id ? editingTrainer : null}
        />
      </Dialog>
    </AppShell>
  )
}
