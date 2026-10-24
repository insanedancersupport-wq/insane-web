import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../auth/AuthContext'
import { DashboardPage } from './DashboardPage'
import { getDashboardSummary, getUpcomingDashboardClasses } from './dashboardApi'
import { dashboardDateRanges } from './dashboardDateRange'

vi.mock('./dashboardApi', () => ({
  dashboardSummaryQueryKey: ({ endDate, role, startDate, userId }) => ['dashboard', userId, role, 'summary', startDate, endDate],
  dashboardUpcomingClassesQueryKey: ({ rangeEndDate, rangeStartDate, role, userId }) => ['dashboard', userId, role, 'upcoming-classes', rangeStartDate, rangeEndDate],
  getDashboardSummary: vi.fn(),
  getUpcomingDashboardClasses: vi.fn(),
}))

const adminSummary = {
  active_groups: 4,
  active_students: 20,
  active_trainers: 3,
  attendance_rate: null,
  pending_tasks: 2,
  today_scheduled_classes: 5,
  upcoming_competitions: 1,
}

const trainerSummary = {
  active_groups: 2,
  active_students: 11,
  attendance_rate: 0.75,
  pending_tasks: 1,
  today_scheduled_classes: 3,
  upcoming_competitions: 2,
}

function renderDashboard({ profile, session = { user: { id: 'user-1' } } }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ profile, session }}>
          <DashboardPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DashboardPage', () => {
  it('uses the admin summary and displays admin KPIs with an unavailable attendance rate', async () => {
    getDashboardSummary.mockResolvedValue(adminSummary)
    getUpcomingDashboardClasses.mockResolvedValue([])

    renderDashboard({ profile: { full_name: 'Alex Admin', role: 'admin' } })

    expect(await screen.findByText('Active Students')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('Active Trainers')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('My Groups')).not.toBeInTheDocument()
    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' })))
  })

  it('uses the trainer summary without school-wide KPIs', async () => {
    getDashboardSummary.mockResolvedValue(trainerSummary)
    getUpcomingDashboardClasses.mockResolvedValue([])

    renderDashboard({ profile: { full_name: 'Alex Trainer', role: 'trainer' } })

    expect(await screen.findByText('My Groups')).toBeInTheDocument()
    expect(screen.getByText('My Students')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.queryByText('Active Trainers')).not.toBeInTheDocument()
    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledWith(expect.objectContaining({ role: 'trainer' })))
  })

  it('does not fetch a custom range until valid dates are submitted', async () => {
    getDashboardSummary.mockResolvedValue(adminSummary)
    getUpcomingDashboardClasses.mockResolvedValue([])

    renderDashboard({ profile: { full_name: 'Alex Admin', role: 'admin' } })
    await screen.findByText('Active Students')
    const initialCalls = getDashboardSummary.mock.calls.length

    fireEvent.change(screen.getByLabelText('Attendance period'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-31' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The end date must be on or after the start date.')
    expect(getDashboardSummary).toHaveBeenCalledTimes(initialCalls)
  })

  it('refetches only dashboard data when manually refreshed', async () => {
    getDashboardSummary.mockResolvedValue(adminSummary)
    getUpcomingDashboardClasses.mockResolvedValue([])

    renderDashboard({ profile: { full_name: 'Alex Admin', role: 'admin' } })
    await screen.findByText('Active Students')
    const summaryCalls = getDashboardSummary.mock.calls.length
    const upcomingCalls = getUpcomingDashboardClasses.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(summaryCalls + 1))
    expect(getUpcomingDashboardClasses).toHaveBeenCalledTimes(upcomingCalls + 1)
  })

  it('renders no more than five authorized upcoming classes', async () => {
    getDashboardSummary.mockResolvedValue(adminSummary)
    getUpcomingDashboardClasses.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        ends_at: `2026-10-2${index}T11:00:00.000Z`,
        group: { name: `Group ${index + 1}` },
        id: `entry-${index + 1}`,
        room: { name: `Room ${index + 1}` },
        starts_at: `2026-10-2${index}T10:00:00.000Z`,
        trainer: { first_name: 'Trainer', last_name: String(index + 1) },
      })),
    )

    renderDashboard({ profile: { full_name: 'Alex Admin', role: 'admin' } })

    expect(await screen.findByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 5')).toBeInTheDocument()
    expect(screen.queryByText('Group 6')).not.toBeInTheDocument()
  })
})

describe('dashboardDateRanges', () => {
  it('uses school-calendar date strings for preset ranges', () => {
    expect(dashboardDateRanges('2026-10-24')).toEqual({
      currentMonth: { endDate: '2026-10-31', startDate: '2026-10-01' },
      last30Days: { endDate: '2026-10-24', startDate: '2026-09-25' },
      previousMonth: { endDate: '2026-09-30', startDate: '2026-09-01' },
    })
  })
})
