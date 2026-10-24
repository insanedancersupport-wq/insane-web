import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { AppShell } from '../../components/layout/AppShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../auth/AuthContext'
import { invalidateDashboardQueries } from '../dashboard/dashboardApi'
import { createCompetition, getCompetitions } from './competitionsApi'

const competitionSchema = z.object({
  competition_date: z.string().min(1, 'Competition date is required.'),
  description: z.string(),
  location: z.string(),
  name: z.string().trim().min(1, 'Competition name is required.'),
  status: z.enum(['upcoming', 'completed', 'cancelled']),
})

const emptyCompetition = {
  competition_date: '',
  description: '',
  location: '',
  name: '',
  status: 'upcoming',
}

function displayDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function statusTone(status) {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'warning'
}

function CompetitionForm({ onSubmit, saving }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: emptyCompetition,
    resolver: zodResolver(competitionSchema),
  })

  return (
    <form className="entity-form" id="competition-form" onSubmit={handleSubmit(onSubmit)}>
      <Input label="Competition name" {...register('name')} />
      {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
      <Input label="Competition date" type="date" {...register('competition_date')} />
      {errors.competition_date && <p className="form-error" role="alert">{errors.competition_date.message}</p>}
      <Input label="Location" {...register('location')} />
      <label className="field" htmlFor="competition-status">
        <span className="field__label">Status</span>
        <select className="field__input" id="competition-status" {...register('status')}>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="field" htmlFor="competition-description">
        <span className="field__label">Description</span>
        <textarea className="field__input field__textarea" id="competition-description" {...register('description')} />
      </label>
      {saving && <LoadingState label="Creating competition" />}
    </form>
  )
}

function sortCompetitions(competitions, order) {
  const statusRank = { upcoming: 0, completed: 1, cancelled: 2 }
  return [...competitions].sort((left, right) => {
    if (order === 'default' && statusRank[left.status] !== statusRank[right.status]) {
      return statusRank[left.status] - statusRank[right.status]
    }

    const comparison = left.competition_date.localeCompare(right.competition_date)
    return order === 'date-desc' ? -comparison : comparison
  })
}

export function CompetitionsPage() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('default')
  const [statusFilter, setStatusFilter] = useState('all')
  const competitionsQuery = useQuery({ queryKey: ['competitions'], queryFn: getCompetitions })
  const createMutation = useMutation({
    mutationFn: createCompetition,
    onSuccess: async (competition) => {
      await queryClient.invalidateQueries({ queryKey: ['competitions'] })
      await invalidateDashboardQueries(queryClient)
      setCreateOpen(false)
      navigate(`/app/competitions/${competition.id}`, {
        state: { message: 'Competition created successfully.' },
      })
    },
  })
  const isAdmin = profile.role === 'admin'

  const filteredCompetitions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const matching = (competitionsQuery.data ?? []).filter((competition) => (
      (statusFilter === 'all' || competition.status === statusFilter)
      && (!normalizedSearch || competition.name.toLowerCase().includes(normalizedSearch))
    ))
    return sortCompetitions(matching, sortOrder)
  }, [competitionsQuery.data, search, sortOrder, statusFilter])

  async function saveCompetition(values) {
    setError('')
    try {
      await createMutation.mutateAsync({
        ...values,
        description: values.description || null,
        location: values.location || null,
      })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <AppShell title="Competitions">
      <section className="page-intro" aria-labelledby="competitions-title">
        <p className="eyebrow">Events</p>
        <h2 id="competitions-title">Competitions</h2>
        <p>Review competition plans, responsible trainers, groups, and registered students.</p>
      </section>
      {isAdmin && <Button onClick={() => setCreateOpen(true)}>New competition</Button>}
      {location.state?.message && <p className="success-message" role="status">{location.state.message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {competitionsQuery.isLoading && <LoadingState label="Loading competitions" />}
      {competitionsQuery.error && <ErrorState title="Unable to load competitions" />}
      {competitionsQuery.data?.length === 0 && (
        <EmptyState
          action={isAdmin ? <Button onClick={() => setCreateOpen(true)}>New competition</Button> : null}
          description="No competitions are available yet."
          title="No competitions yet"
        />
      )}
      {competitionsQuery.data?.length > 0 && (
        <>
          <section aria-label="Competition filters" className="list-filters competition-filters">
            <Input label="Search competitions" onChange={(event) => setSearch(event.target.value)} value={search} />
            <label className="field" htmlFor="competition-status-filter">
              <span className="field__label">Status</span>
              <select className="field__input" id="competition-status-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="all">All statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="field" htmlFor="competition-sort">
              <span className="field__label">Sort</span>
              <select className="field__input" id="competition-sort" onChange={(event) => setSortOrder(event.target.value)} value={sortOrder}>
                <option value="default">Upcoming, completed, cancelled</option>
                <option value="date-asc">Competition date: earliest first</option>
                <option value="date-desc">Competition date: latest first</option>
              </select>
            </label>
          </section>
          <section aria-label="Competitions" className="entity-list">
            {filteredCompetitions.length === 0 && (
              <EmptyState description="Adjust the search or status filter to see competitions." title="No matching competitions" />
            )}
            {filteredCompetitions.map((competition) => (
              <Card className="entity-row" key={competition.id}>
                <div>
                  <h3>{competition.name}</h3>
                  <p>{displayDate(competition.competition_date)} · {competition.location || 'Location not set'}</p>
                  <p>
                    {competition.competition_participants?.length ?? 0} participants · {competition.competition_groups?.length ?? 0} groups · {competition.competition_trainers?.length ?? 0} responsible trainers
                  </p>
                  <Badge tone={statusTone(competition.status)}>{competition.status}</Badge>
                </div>
                <div className="entity-row__actions">
                  <Link className="button button--tertiary" to={`/app/competitions/${competition.id}`}>View details</Link>
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
      <Dialog
        footer={(
          <div className="form-actions">
            <Button disabled={createMutation.isPending} form="competition-form" type="submit">
              {createMutation.isPending ? 'Creating...' : 'Create competition'}
            </Button>
            <Button disabled={createMutation.isPending} onClick={() => setCreateOpen(false)} variant="tertiary">Cancel</Button>
          </div>
        )}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        open={createOpen}
        scrollable
        title="New competition"
      >
        <CompetitionForm onSubmit={saveCompetition} saving={createMutation.isPending} />
      </Dialog>
    </AppShell>
  )
}
