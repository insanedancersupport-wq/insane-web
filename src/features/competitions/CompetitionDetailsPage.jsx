import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { AppShell } from '../../components/layout/AppShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../auth/AuthContext'
import {
  addCompetitionGroup,
  addCompetitionParticipant,
  addCompetitionTrainer,
  deleteCompetition,
  enrollCompetitionGroup,
  getAvailableGroups,
  getCompetitionById,
  getCompetitionGroups,
  getCompetitionParticipants,
  getCompetitionTrainers,
  getCurrentTrainerId,
  getEligibleStudents,
  getEligibleTrainers,
  removeCompetitionGroup,
  removeCompetitionParticipant,
  removeCompetitionTrainer,
  updateCompetition,
} from './competitionsApi'

const competitionSchema = z.object({
  competition_date: z.string().min(1, 'Competition date is required.'),
  description: z.string(),
  location: z.string(),
  name: z.string().trim().min(1, 'Competition name is required.'),
  status: z.enum(['upcoming', 'completed', 'cancelled']),
})

function displayDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function displayDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusTone(status) {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'warning'
}

function trainerName(trainer) {
  return `${trainer.first_name} ${trainer.last_name}`
}

function CompetitionEditForm({ competition, onSubmit }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: {
      competition_date: competition.competition_date,
      description: competition.description ?? '',
      location: competition.location ?? '',
      name: competition.name,
      status: competition.status,
    },
    resolver: zodResolver(competitionSchema),
  })

  return (
    <form className="entity-form" id="competition-edit-form" onSubmit={handleSubmit(onSubmit)}>
      <Input label="Competition name" {...register('name')} />
      {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
      <Input label="Competition date" type="date" {...register('competition_date')} />
      {errors.competition_date && <p className="form-error" role="alert">{errors.competition_date.message}</p>}
      <Input label="Location" {...register('location')} />
      <label className="field" htmlFor="competition-edit-status">
        <span className="field__label">Status</span>
        <select className="field__input" id="competition-edit-status" {...register('status')}>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="field" htmlFor="competition-edit-description">
        <span className="field__label">Description</span>
        <textarea className="field__input field__textarea" id="competition-edit-description" {...register('description')} />
      </label>
    </form>
  )
}

function SelectForm({ buttonLabel, id, label, onSubmit, options, value, onChange }) {
  return (
    <form className="entity-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit()
    }}>
      <label className="field" htmlFor={id}>
        <span className="field__label">{label}</span>
        <select className="field__input" id={id} onChange={(event) => onChange(event.target.value)} value={value}>
          <option value="">Select an option</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <div className="form-actions">
        <Button disabled={!value} type="submit">{buttonLabel}</Button>
      </div>
    </form>
  )
}

export function CompetitionDetailsPage() {
  const { profile } = useAuth()
  const { competitionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState(location.state?.message ?? '')
  const [selectedId, setSelectedId] = useState('')
  const competitionQuery = useQuery({
    queryKey: ['competitions', competitionId],
    queryFn: () => getCompetitionById(competitionId),
  })
  const trainersQuery = useQuery({
    queryKey: ['competition-trainers', competitionId],
    queryFn: () => getCompetitionTrainers(competitionId),
  })
  const groupsQuery = useQuery({
    queryKey: ['competition-groups', competitionId],
    queryFn: () => getCompetitionGroups(competitionId),
  })
  const participantsQuery = useQuery({
    queryKey: ['competition-participants', competitionId],
    queryFn: () => getCompetitionParticipants(competitionId),
  })
  const currentTrainerQuery = useQuery({
    enabled: profile.role === 'trainer',
    queryKey: ['current-trainer', profile.id],
    queryFn: () => getCurrentTrainerId(profile.id),
  })
  const eligibleTrainersQuery = useQuery({
    enabled: dialog === 'add-trainer',
    queryKey: ['eligible-competition-trainers'],
    queryFn: getEligibleTrainers,
  })
  const availableGroupsQuery = useQuery({
    enabled: dialog === 'add-group',
    queryKey: ['available-competition-groups'],
    queryFn: getAvailableGroups,
  })
  const eligibleStudentsQuery = useQuery({
    enabled: dialog === 'add-participant',
    queryKey: ['eligible-competition-students'],
    queryFn: getEligibleStudents,
  })

  const invalidateCompetition = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['competitions'] }),
      queryClient.invalidateQueries({ queryKey: ['competitions', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['competition-trainers', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['competition-groups', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['competition-participants', competitionId] }),
    ])
  }

  const editMutation = useMutation({
    mutationFn: updateCompetition,
    onSuccess: async () => {
      await invalidateCompetition()
      setDialog(null)
      setFeedback('Competition details saved.')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteCompetition,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['competitions'] })
      navigate('/app/competitions', { state: { message: 'Competition deleted.' } })
    },
  })
  const trainerMutation = useMutation({
    mutationFn: addCompetitionTrainer,
    onSuccess: async () => {
      await invalidateCompetition()
      setDialog(null)
      setSelectedId('')
      setFeedback('Responsible trainer assigned.')
    },
  })
  const removeTrainerMutation = useMutation({
    mutationFn: removeCompetitionTrainer,
    onSuccess: async () => {
      await invalidateCompetition()
      setFeedback('Responsible trainer removed.')
    },
  })
  const groupMutation = useMutation({
    mutationFn: addCompetitionGroup,
    onSuccess: async () => {
      await invalidateCompetition()
      setDialog(null)
      setSelectedId('')
      setFeedback('Group associated with this competition. Enroll its students separately when ready.')
    },
  })
  const removeGroupMutation = useMutation({
    mutationFn: removeCompetitionGroup,
    onSuccess: async () => {
      await invalidateCompetition()
      setFeedback('Group association removed. Existing participants were not changed.')
    },
  })
  const enrollGroupMutation = useMutation({
    mutationFn: enrollCompetitionGroup,
    onSuccess: async (insertedCount) => {
      await invalidateCompetition()
      setFeedback(insertedCount === 0
        ? 'No new students were enrolled. They may already be registered.'
        : `${insertedCount} ${insertedCount === 1 ? 'student' : 'students'} enrolled successfully.`)
    },
  })
  const participantMutation = useMutation({
    mutationFn: addCompetitionParticipant,
    onSuccess: async () => {
      await invalidateCompetition()
      setDialog(null)
      setSelectedId('')
      setFeedback('Student enrolled successfully.')
    },
  })
  const removeParticipantMutation = useMutation({
    mutationFn: removeCompetitionParticipant,
    onSuccess: async () => {
      await invalidateCompetition()
      setDialog(null)
      setFeedback('Participant removed. The student and their group memberships were not changed.')
    },
  })

  const isAdmin = profile.role === 'admin'
  const responsibleTrainerIds = trainersQuery.data?.map((assignment) => assignment.trainer_id) ?? []
  const canManage = isAdmin || responsibleTrainerIds.includes(currentTrainerQuery.data)
  const competition = competitionQuery.data
  const trainerOptions = useMemo(() => (eligibleTrainersQuery.data ?? [])
    .filter((trainer) => !trainersQuery.data?.some((assignment) => assignment.trainer_id === trainer.id))
    .map((trainer) => ({ id: trainer.id, label: trainerName(trainer) })), [eligibleTrainersQuery.data, trainersQuery.data])
  const groupOptions = useMemo(() => (availableGroupsQuery.data ?? [])
    .filter((group) => !groupsQuery.data?.some((assignment) => assignment.group_id === group.id))
    .map((group) => ({ id: group.id, label: group.name })), [availableGroupsQuery.data, groupsQuery.data])
  const studentOptions = useMemo(() => {
    const enrolledStudentIds = new Set(participantsQuery.data?.map((participant) => participant.student_id))
    return (eligibleStudentsQuery.data ?? [])
      .filter((student) => !enrolledStudentIds.has(student.id))
      .map((student) => ({ id: student.id, label: `${student.first_name} ${student.last_name}` }))
  }, [eligibleStudentsQuery.data, participantsQuery.data])

  function closeDialog() {
    if (!editMutation.isPending && !deleteMutation.isPending && !participantMutation.isPending) {
      setDialog(null)
      setSelectedId('')
    }
  }

  async function runMutation(mutation, values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (mutationError) {
      setError(mutationError.message)
    }
  }

  async function saveCompetition(values) {
    const original = competitionQuery.data
    const normalized = {
      ...values,
      description: values.description || null,
      location: values.location || null,
    }
    const changedValues = Object.fromEntries(Object.entries(normalized).filter(([key, value]) => value !== original[key]))
    if (Object.keys(changedValues).length === 0) {
      setDialog(null)
      return
    }
    await runMutation(editMutation, { id: competitionId, values: changedValues })
  }

  if (competitionQuery.isLoading) {
    return <AppShell title="Competition"><LoadingState label="Loading competition" /></AppShell>
  }

  if (competitionQuery.error || !competition) {
    return <AppShell title="Competition"><ErrorState title="Unable to load competition" /></AppShell>
  }

  const participantCount = participantsQuery.data?.length ?? 0

  return (
    <AppShell title="Competition details">
      <Link className="back-link" to="/app/competitions">Back to competitions</Link>
      <section className="page-intro" aria-labelledby="competition-detail-title">
        <p className="eyebrow">Competition</p>
        <h2 id="competition-detail-title">{competition.name}</h2>
        <p>{displayDate(competition.competition_date)} · {competition.location || 'Location not set'}</p>
        <Badge tone={statusTone(competition.status)}>{competition.status}</Badge>
        {competition.description && <p>{competition.description}</p>}
      </section>
      {feedback && <p className="success-message" role="status">{feedback}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {isAdmin && (
        <section className="competition-actions" aria-label="Competition actions">
          <Button onClick={() => setDialog('edit')} variant="secondary">Edit competition</Button>
          <Button disabled={participantCount > 0} onClick={() => setDialog('delete')} variant="tertiary">
            Delete competition
          </Button>
          {participantCount > 0 && <p>Remove all current participants before this competition can be permanently deleted.</p>}
        </section>
      )}
      <section className="competition-detail-grid">
        <Card className="detail-card">
          <div className="competition-section-heading">
            <div><h3>Responsible trainers</h3><p>Assigned trainers can manage groups and participants.</p></div>
            {isAdmin && <Button onClick={() => setDialog('add-trainer')} variant="secondary">Add trainer</Button>}
          </div>
          {trainersQuery.isLoading && <LoadingState label="Loading responsible trainers" />}
          {trainersQuery.error && <p className="form-error" role="alert">Unable to load responsible trainers.</p>}
          {trainersQuery.data?.length === 0 && <p>No responsible trainers assigned.</p>}
          <ul className="assigned-trainer-list">
            {trainersQuery.data?.map((assignment) => (
              <li key={assignment.trainer_id}>
                <span>{trainerName(assignment)}</span>
                {isAdmin && <Button onClick={() => runMutation(removeTrainerMutation, { competitionId, trainerId: assignment.trainer_id })} variant="tertiary">Remove</Button>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="detail-card">
          <div className="competition-section-heading">
            <div><h3>Participating groups</h3><p>Associating a group does not enroll its students.</p></div>
            {canManage && <Button onClick={() => setDialog('add-group')} variant="secondary">Add group</Button>}
          </div>
          {groupsQuery.isLoading && <LoadingState label="Loading participating groups" />}
          {groupsQuery.error && <p className="form-error" role="alert">Unable to load participating groups.</p>}
          {groupsQuery.data?.length === 0 && <p>No groups associated yet.</p>}
          <ul className="assigned-trainer-list">
            {groupsQuery.data?.map((assignment) => (
              <li key={assignment.group_id}>
                <span>{assignment.name}</span>
                {canManage && (
                  <span className="competition-row-actions">
                    <Button onClick={() => runMutation(enrollGroupMutation, { competitionId, groupId: assignment.group_id })} variant="secondary">Enroll students from group</Button>
                    <Button onClick={() => runMutation(removeGroupMutation, { competitionId, groupId: assignment.group_id })} variant="tertiary">Remove group</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="detail-card competition-detail-grid__wide">
          <div className="competition-section-heading">
            <div><h3>Participants</h3><p>{participantCount} currently enrolled.</p></div>
            {canManage && <Button onClick={() => setDialog('add-participant')} variant="secondary">Add student</Button>}
          </div>
          {participantsQuery.isLoading && <LoadingState label="Loading participants" />}
          {participantsQuery.error && <p className="form-error" role="alert">Unable to load participants.</p>}
          {participantsQuery.data?.length === 0 && <p>No students enrolled yet.</p>}
          <ul className="assigned-trainer-list">
            {participantsQuery.data?.map((participant) => (
              <li key={participant.participant_id}>
                <span>
                  <strong>{participant.first_name} {participant.last_name}</strong>
                  <small>Enrolled {displayDateTime(participant.enrolled_at)}</small>
                </span>
                {canManage && <Button onClick={() => {
                  setSelectedId(participant.participant_id)
                  setDialog('remove-participant')
                }} variant="tertiary">Remove</Button>}
              </li>
            ))}
          </ul>
        </Card>
      </section>
      <Dialog
        footer={(
          <div className="form-actions">
            <Button disabled={editMutation.isPending} form="competition-edit-form" type="submit">
              {editMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
            <Button disabled={editMutation.isPending} onClick={closeDialog} variant="tertiary">Cancel</Button>
          </div>
        )}
        onClose={closeDialog}
        open={dialog === 'edit'}
        scrollable
        title="Edit competition"
      >
        <CompetitionEditForm competition={competition} onSubmit={saveCompetition} />
      </Dialog>
      <Dialog onClose={closeDialog} open={dialog === 'add-trainer'} title="Add responsible trainer">
        {eligibleTrainersQuery.isLoading && <LoadingState label="Loading trainers" />}
        {eligibleTrainersQuery.error && <ErrorState title="Unable to load trainers" />}
        {eligibleTrainersQuery.data && <SelectForm buttonLabel="Assign trainer" id="responsible-trainer" label="Eligible trainer" onChange={setSelectedId} onSubmit={() => runMutation(trainerMutation, { competitionId, trainerId: selectedId })} options={trainerOptions} value={selectedId} />}
      </Dialog>
      <Dialog onClose={closeDialog} open={dialog === 'add-group'} title="Add participating group">
        {availableGroupsQuery.isLoading && <LoadingState label="Loading groups" />}
        {availableGroupsQuery.error && <ErrorState title="Unable to load groups" />}
        {availableGroupsQuery.data && <SelectForm buttonLabel="Add group" id="competition-group" label="Available group" onChange={setSelectedId} onSubmit={() => runMutation(groupMutation, { competitionId, groupId: selectedId })} options={groupOptions} value={selectedId} />}
      </Dialog>
      <Dialog onClose={closeDialog} open={dialog === 'add-participant'} title="Enroll individual student">
        {eligibleStudentsQuery.isLoading && <LoadingState label="Loading active students" />}
        {eligibleStudentsQuery.error && <ErrorState title="Unable to load active students" />}
        {eligibleStudentsQuery.data && <SelectForm buttonLabel="Enroll student" id="competition-student" label="Active student" onChange={setSelectedId} onSubmit={() => runMutation(participantMutation, { competitionId, studentId: selectedId })} options={studentOptions} value={selectedId} />}
      </Dialog>
      <Dialog onClose={closeDialog} open={dialog === 'remove-participant'} title="Remove participant">
        <form className="entity-form" onSubmit={(event) => {
          event.preventDefault()
          runMutation(removeParticipantMutation, { competitionId, participantId: selectedId })
        }}>
          <p>This removes only this competition enrollment. The student and their normal group memberships will not change.</p>
          <div className="form-actions">
            <Button disabled={removeParticipantMutation.isPending} type="submit">
              {removeParticipantMutation.isPending ? 'Removing...' : 'Remove participant'}
            </Button>
            <Button disabled={removeParticipantMutation.isPending} onClick={closeDialog} variant="tertiary">Cancel</Button>
          </div>
        </form>
      </Dialog>
      <Dialog onClose={closeDialog} open={dialog === 'delete'} title="Delete competition">
        <form className="entity-form" onSubmit={(event) => {
          event.preventDefault()
          runMutation(deleteMutation, competitionId)
        }}>
          <p>This permanently deletes the competition and its group/trainer associations. Students and their normal memberships will not change.</p>
          <div className="form-actions">
            <Button disabled={deleteMutation.isPending} type="submit">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete competition'}
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={closeDialog} variant="tertiary">Cancel</Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  )
}
