import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  addSchoolDays,
  formatSchoolDate,
  formatSchoolTime,
  schoolDateBoundaryToIso,
  todayInSchoolTimezone,
} from '../../utils/scheduleDateTime'
import { useAuth } from '../auth/AuthContext'
import { dashboardDateRanges, schoolTimezone } from './dashboardDateRange'
import {
  dashboardSummaryQueryKey,
  dashboardUpcomingClassesQueryKey,
  getDashboardSummary,
  getUpcomingDashboardClasses,
} from './dashboardApi'

const fiveMinutes = 5 * 60 * 1000

function isValidDateRange({ endDate, startDate }) {
  return Boolean(startDate && endDate && startDate <= endDate)
}

function shouldRetry(error) {
  return !['42501', '42883', 'PGRST202', 'PGRST203'].includes(error?.code)
}

function attendanceRate(value) {
  return value == null ? '—' : new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(Number(value))
}

function summaryCards(summary, role) {
  const shared = [
    { label: "Today's Classes", value: summary.today_scheduled_classes },
    {
      description: 'Attendance rate is calculated from recorded present and absent marks. Recovery attendance and unmarked sessions are excluded.',
      label: 'Attendance Rate',
      value: attendanceRate(summary.attendance_rate),
    },
  ]

  if (role === 'admin') {
    return [
      { label: 'Active Students', value: summary.active_students },
      { label: 'Active Trainers', value: summary.active_trainers },
      { label: 'Active Groups', value: summary.active_groups },
      ...shared,
      { label: 'Upcoming Competitions', value: summary.upcoming_competitions },
      { label: 'Pending Tasks', value: summary.pending_tasks },
    ]
  }

  return [
    { label: 'My Groups', value: summary.active_groups },
    { label: 'My Students', value: summary.active_students },
    ...shared,
    { label: 'My Pending Tasks', value: summary.pending_tasks },
    { label: 'My Upcoming Competitions', value: summary.upcoming_competitions },
  ]
}

function DateRangeFilter({ onApply, preset, range, setPreset, setRange }) {
  const [validationError, setValidationError] = useState('')

  function selectPreset(nextPreset) {
    setPreset(nextPreset)
    setValidationError('')

    if (nextPreset !== 'custom') {
      onApply(nextPreset)
    }
  }

  function applyCustomRange(event) {
    event.preventDefault()

    if (!range.startDate || !range.endDate) {
      setValidationError('Start and end dates are required.')
      return
    }

    if (!isValidDateRange(range)) {
      setValidationError('The end date must be on or after the start date.')
      return
    }

    setValidationError('')
    onApply('custom')
  }

  return (
    <section aria-label="Attendance date range" className="dashboard-filters">
      <label className="field" htmlFor="dashboard-range-preset">
        <span className="field__label">Attendance period</span>
        <select
          className="field__input"
          id="dashboard-range-preset"
          onChange={(event) => selectPreset(event.target.value)}
          value={preset}
        >
          <option value="currentMonth">Current month</option>
          <option value="previousMonth">Previous month</option>
          <option value="last30Days">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      {preset === 'custom' && (
        <form className="dashboard-custom-range" onSubmit={applyCustomRange}>
          <label className="field" htmlFor="dashboard-start-date">
            <span className="field__label">Start date</span>
            <input
              className="field__input"
              id="dashboard-start-date"
              onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
              type="date"
              value={range.startDate}
            />
          </label>
          <label className="field" htmlFor="dashboard-end-date">
            <span className="field__label">End date</span>
            <input
              className="field__input"
              id="dashboard-end-date"
              onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
              type="date"
              value={range.endDate}
            />
          </label>
          <Button type="submit" variant="secondary">Apply range</Button>
          {validationError && <p className="form-error" role="alert">{validationError}</p>}
        </form>
      )}
    </section>
  )
}

export function DashboardPage() {
  const { profile, session } = useAuth()
  const dateRanges = useMemo(() => dashboardDateRanges(), [])
  const [preset, setPreset] = useState('currentMonth')
  const [activeRange, setActiveRange] = useState(dateRanges.currentMonth)
  const [draftRange, setDraftRange] = useState(dateRanges.currentMonth)
  const role = profile.role
  const userId = session.user.id
  const upcomingStartDate = todayInSchoolTimezone(schoolTimezone)
  const upcomingEndDate = addSchoolDays(upcomingStartDate, 7)
  const summaryQuery = useQuery({
    enabled: isValidDateRange(activeRange),
    gcTime: 15 * 60 * 1000,
    queryFn: () => getDashboardSummary({
      endDate: activeRange.endDate,
      role,
      startDate: activeRange.startDate,
    }),
    queryKey: dashboardSummaryQueryKey({ ...activeRange, role, userId }),
    refetchInterval: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => shouldRetry(error) && failureCount < 1,
    staleTime: fiveMinutes,
  })
  const upcomingQuery = useQuery({
    gcTime: 15 * 60 * 1000,
    queryFn: () => getUpcomingDashboardClasses({
      rangeEnd: schoolDateBoundaryToIso(addSchoolDays(upcomingEndDate, 1), schoolTimezone),
      rangeStart: new Date().toISOString(),
    }),
    queryKey: dashboardUpcomingClassesQueryKey({
      rangeEndDate: upcomingEndDate,
      rangeStartDate: upcomingStartDate,
      role,
      userId,
    }),
    refetchInterval: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => shouldRetry(error) && failureCount < 1,
    staleTime: fiveMinutes,
  })

  async function refreshDashboard() {
    await Promise.all([summaryQuery.refetch(), upcomingQuery.refetch()])
  }

  function applyPreset(nextPreset) {
    const nextRange = dateRanges[nextPreset]

    if (nextRange) {
      setActiveRange(nextRange)
      setDraftRange(nextRange)
      return
    }

    if (isValidDateRange(draftRange)) {
      setActiveRange(draftRange)
    }
  }

  const isRefreshing = summaryQuery.isFetching || upcomingQuery.isFetching
  const cards = summaryQuery.data ? summaryCards(summaryQuery.data, role) : []

  return (
    <AppShell title="Dashboard">
      <section className="page-intro dashboard-intro" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">Insane Dance Center</p>
          <h2 id="dashboard-title">Welcome, {profile.full_name}</h2>
          <p>{role === 'admin' ? 'School-wide operational overview.' : 'Your training overview.'}</p>
        </div>
        <Button disabled={isRefreshing} onClick={() => void refreshDashboard()} variant="secondary">
          <RefreshCw aria-hidden="true" size={18} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </section>

      <DateRangeFilter
        onApply={applyPreset}
        preset={preset}
        range={draftRange}
        setPreset={setPreset}
        setRange={setDraftRange}
      />

      {summaryQuery.isLoading && <LoadingState label="Loading dashboard summary" />}
      {summaryQuery.error && (
        <ErrorState
          action={<Button onClick={() => void summaryQuery.refetch()} variant="secondary">Retry</Button>}
          description={summaryQuery.error.message || 'The dashboard summary could not be loaded.'}
          title="Unable to load dashboard"
        />
      )}
      {summaryQuery.data && (
        <section aria-label="Dashboard summary" className="dashboard-kpis">
          {cards.map((card) => (
            <Card className="dashboard-kpi" key={card.label}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              {card.description && <span title={card.description}>{card.description}</span>}
            </Card>
          ))}
        </section>
      )}

      <section aria-labelledby="upcoming-classes-title" className="dashboard-upcoming">
        <div className="section-heading">
          <h2 id="upcoming-classes-title">Upcoming Classes</h2>
          {upcomingQuery.isFetching && !upcomingQuery.isLoading && <span role="status">Refreshing classes...</span>}
        </div>
        {upcomingQuery.isLoading && <LoadingState label="Loading upcoming classes" />}
        {upcomingQuery.error && (
          <ErrorState
            action={<Button onClick={() => void upcomingQuery.refetch()} variant="secondary">Retry</Button>}
            description={upcomingQuery.error.message || 'Upcoming classes could not be loaded.'}
            title="Unable to load upcoming classes"
          />
        )}
        {upcomingQuery.data?.length === 0 && (
          <EmptyState description="There are no upcoming classes in the next seven days." title="No upcoming classes" />
        )}
        {upcomingQuery.data?.length > 0 && (
          <ul className="dashboard-class-list">
            {upcomingQuery.data.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <Card className="dashboard-class">
                  <div>
                    <h3>{entry.group?.name || entry.title}</h3>
                    <p>{formatSchoolDate(entry.starts_at, schoolTimezone)} · {formatSchoolTime(entry.starts_at, schoolTimezone)}–{formatSchoolTime(entry.ends_at, schoolTimezone)}</p>
                  </div>
                  <dl>
                    <div><dt>Room</dt><dd>{entry.room?.name || 'Unavailable room'}</dd></div>
                    <div><dt>Trainer</dt><dd>{entry.trainer ? `${entry.trainer.first_name} ${entry.trainer.last_name}` : 'Unavailable trainer'}</dd></div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
