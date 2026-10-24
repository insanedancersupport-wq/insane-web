import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import {
  getAttendanceTrendSeries,
  getCompetitionParticipationSeries,
  getCompetitionResultsReport,
  getGroupAttendanceReport,
  getStudentAttendanceReport,
  getTrainerActivityReport,
} from './reportsApi'
import { ReportsPage } from './ReportsPage'

vi.mock('../groups/groupsApi', () => ({ listGroups: vi.fn() }))
vi.mock('./reportsApi', () => ({
  getAttendanceTrendSeries: vi.fn(),
  getCompetitionParticipationSeries: vi.fn(),
  getCompetitionResultsReport: vi.fn(),
  getGroupAttendanceReport: vi.fn(),
  getStudentAttendanceReport: vi.fn(),
  getTrainerActivityReport: vi.fn(),
  reportsQueryKey: ({ competitionId, cursor, endDate, groupId, pageSize, reportType, resultType, role, startDate, status, trainerId, userId }) =>
    ['reports', userId, role, reportType, startDate, endDate, groupId, trainerId, competitionId, status, resultType, pageSize, cursor],
}))

const studentRows = [{
  absent_count: 1, attendance_rate: null, group_id: 'group-1', group_name: 'Historical Group',
  has_more: true, next_cursor: 'next-page', present_count: 2, recorded_marks_count: 4,
  recovery_count: 1, student_display_name: 'Alex Student', student_id: 'student-1',
}]

function renderReports({ role = 'admin' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ profile: { full_name: 'Alex User', role }, session: { user: { id: `${role}-id` } } }}>
          <ReportsPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  listGroups.mockResolvedValue([{ id: 'group-1', name: 'Group One' }])
  getStudentAttendanceReport.mockResolvedValue(studentRows)
  getGroupAttendanceReport.mockResolvedValue([{
    absent_count: 1, attendance_rate: null, current_active_students_count: 5, group_id: 'group-1',
    group_name: 'Group One', historical_recorded_students_count: 4, present_count: 2,
    recovery_count: 1, started_classes_count: 3, status_completed_classes_count: 2,
  }])
  getAttendanceTrendSeries.mockResolvedValue([
    { absent_count: 0, attendance_rate: null, bucket_start: '2026-09-01', present_count: 0, recovery_count: 0 },
    { absent_count: 2, attendance_rate: 0.5, bucket_start: '2026-10-01', present_count: 2, recovery_count: 1 },
  ])
  getTrainerActivityReport.mockResolvedValue([{
    absent_count: 1, attendance_rate: null, cancelled_classes_count: 1, distinct_groups_taught_count: 2,
    future_scheduled_classes_count: 3, present_count: 2, recorded_attendance_marks_count: 4,
    recovery_count: 1, started_classes_count: 5, status_completed_classes_count: 4,
    trainer_display_name: 'Alex Trainer', trainer_id: 'trainer-1',
  }])
  getCompetitionResultsReport.mockResolvedValue([{
    award: 'Gold', category: 'Junior', competition_date: '2026-10-10', competition_id: 'competition-1',
    competition_name: 'Autumn Cup', competition_status: 'completed', has_more: false,
    next_cursor: null, placement: 1, result_id: 'result-1', result_member_count: 2,
    result_member_display_names: [{ display_name: 'Ana One', student_id: 'student-1' }, { display_name: 'Bea Two', student_id: 'student-2' }],
    result_type: 'team', team_name: 'Fire', unique_enrolled_participants_count: 4,
  }])
  getCompetitionParticipationSeries.mockResolvedValue([
    { bucket_start: '2026-09-01', competitions_count: 0, individual_results_count: 0, result_entries_count: 0, team_results_count: 0, unique_enrolled_participants_count: 0 },
    { bucket_start: '2026-10-01', competitions_count: 1, individual_results_count: 1, result_entries_count: 2, team_results_count: 1, unique_enrolled_participants_count: 4 },
  ])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReportsPage', () => {
  it('renders student attendance, preserves null rates, and pages with final-row cursors', async () => {
    getStudentAttendanceReport
      .mockResolvedValueOnce(studentRows)
      .mockResolvedValueOnce([{ ...studentRows[0], has_more: false, next_cursor: null, student_id: 'student-2', student_display_name: 'Bea Student' }])

    renderReports()

    expect(await screen.findByText('Alex Student')).toBeInTheDocument()
    expect(screen.getByText('Historical Group')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Bea Student')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Alex Student')).toBeInTheDocument()
    expect(getStudentAttendanceReport.mock.calls.some(([values]) => values.afterCursor === 'next-page')).toBe(true)

    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'group-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByText('Alex Student')).toBeInTheDocument()
    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(getStudentAttendanceReport.mock.calls.at(-1)[0]).toMatchObject({ afterCursor: null, groupId: 'group-1' })
  })

  it('applies and resets filters without fetching for invalid ranges', async () => {
    renderReports()
    await screen.findByText('Alex Student')
    const initialCalls = getStudentAttendanceReport.mock.calls.length

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-31' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The end date must be on or after the start date.')
    expect(getStudentAttendanceReport).toHaveBeenCalledTimes(initialCalls)

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(screen.getByLabelText('Group')).toHaveValue('')
  })

  it('renders group metrics, zero-count chart months, and an accessible table alternative', async () => {
    renderReports({ role: 'trainer' })
    fireEvent.click(screen.getByRole('tab', { name: 'Group Attendance' }))

    expect(await screen.findByText('Current active students')).toBeInTheDocument()
    expect(screen.getByText('Historical recorded students')).toBeInTheDocument()
    expect(screen.getByText('Status-completed classes')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('50.00%')).toBeInTheDocument()
    expect(await screen.findByText('Attendance trend data')).toBeInTheDocument()
    expect(screen.getByLabelText('Present 0')).toBeInTheDocument()
    await waitFor(() => expect(getAttendanceTrendSeries).toHaveBeenCalled())
  })

  it('shows initial empty states and a retryable error without raw backend output', async () => {
    getStudentAttendanceReport.mockResolvedValueOnce([])
    renderReports()
    expect(await screen.findByText('No student attendance records')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()

    cleanup()
    getStudentAttendanceReport.mockRejectedValueOnce({ code: '42501', message: 'internal SQL message' })
    renderReports()
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to view this report.')
    expect(screen.queryByText('internal SQL message')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('keeps table reports available while blocking a thirteen-month attendance trend', async () => {
    renderReports()
    await screen.findByText('Alex Student')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(getStudentAttendanceReport.mock.calls.at(-1)[0]).toMatchObject({
      endDate: '2027-01-01',
      startDate: '2026-01-01',
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Group Attendance' }))

    expect(await screen.findByText('Current active students')).toBeInTheDocument()
    expect(await screen.findByText('Attendance trend unavailable for this range')).toBeInTheDocument()
    expect(screen.getByText('The attendance chart supports ranges touching at most 12 calendar months.')).toBeInTheDocument()
    expect(getAttendanceTrendSeries).not.toHaveBeenCalled()
  })

  it('blocks both table reports when an applied range exceeds 366 inclusive days', async () => {
    renderReports()
    await screen.findByText('Alex Student')
    fireEvent.click(screen.getByRole('tab', { name: 'Group Attendance' }))
    await screen.findByText('Current active students')
    const groupCalls = getGroupAttendanceReport.mock.calls.length
    const trendCalls = getAttendanceTrendSeries.mock.calls.length

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-01-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Reports support an inclusive range of up to 366 days.')
    expect(getGroupAttendanceReport).toHaveBeenCalledTimes(groupCalls)
    expect(getAttendanceTrendSeries).toHaveBeenCalledTimes(trendCalls)
  })

  it('keeps Previous available after an empty continuation page', async () => {
    getStudentAttendanceReport
      .mockResolvedValueOnce(studentRows)
      .mockResolvedValueOnce([])

    renderReports()
    expect(await screen.findByText('Alex Student')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('No additional student attendance records')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Alex Student')).toBeInTheDocument()
  })

  it('does not render a stale response after a newer applied filter request', async () => {
    let resolveFirst
    let resolveSecond
    const firstPending = new Promise((resolve) => { resolveFirst = resolve })
    const secondPending = new Promise((resolve) => { resolveSecond = resolve })
    getStudentAttendanceReport
      .mockResolvedValueOnce(studentRows)
      .mockImplementationOnce(() => firstPending)
      .mockImplementationOnce(() => secondPending)

    renderReports()
    expect(await screen.findByText('Alex Student')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-03-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-04-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    resolveFirst([{ ...studentRows[0], student_display_name: 'Stale Student' }])
    await Promise.resolve()
    expect(screen.queryByText('Stale Student')).not.toBeInTheDocument()

    resolveSecond([{ ...studentRows[0], student_display_name: 'Current Student' }])
    expect(await screen.findByText('Current Student')).toBeInTheDocument()
    expect(screen.queryByText('Stale Student')).not.toBeInTheDocument()
  })

  it('renders trainer activity directly from the aggregate RPC for admins and trainers', async () => {
    renderReports({ role: 'trainer' })
    fireEvent.click(screen.getByRole('tab', { name: 'Trainer Activity' }))

    expect((await screen.findAllByText('Alex Trainer')).length).toBeGreaterThan(0)
    expect(screen.getByText('Started classes')).toBeInTheDocument()
    expect(screen.getByText('Status-completed classes')).toBeInTheDocument()
    expect(screen.getByText('Future scheduled classes')).toBeInTheDocument()
    expect(screen.getByText('Cancelled classes')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Trainer class activity chart')).toBeInTheDocument()
    expect(getTrainerActivityReport).toHaveBeenCalledWith(expect.objectContaining({ endDate: expect.any(String), startDate: expect.any(String) }))

    fireEvent.click(screen.getByRole('tab', { name: 'Competition Results' }))
    expect(await screen.findByText('Autumn Cup')).toBeInTheDocument()
  })

  it('renders trainer activity for administrators without a client-supplied trainer ID', async () => {
    renderReports()
    fireEvent.click(screen.getByRole('tab', { name: 'Trainer Activity' }))

    expect(await screen.findAllByText('Alex Trainer')).not.toHaveLength(0)
    expect(getTrainerActivityReport.mock.calls.at(-1)[0]).not.toHaveProperty('trainerId')
  })

  it('shows a controlled trainer limit error with retry', async () => {
    getTrainerActivityReport.mockRejectedValueOnce({ code: '22023', message: 'internal backend text' })
    renderReports()
    fireEvent.click(screen.getByRole('tab', { name: 'Trainer Activity' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many trainers match this period. Please narrow your filters.')
    expect(screen.queryByText('internal backend text')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('renders no-result and separate competition result rows with bounded member display and trend data', async () => {
    getCompetitionResultsReport.mockResolvedValueOnce([
      {
        competition_date: '2026-10-09', competition_id: 'competition-0', competition_name: 'No Result Cup',
        competition_status: 'completed', has_more: false, next_cursor: null, result_id: null,
        unique_enrolled_participants_count: 3,
      },
      {
        ...Array.from({ length: 50 }, (_, index) => ({ display_name: `Student ${index + 1}`, student_id: `student-${index + 1}` })),
        award: 'Silver', category: 'Senior', competition_date: '2026-10-10', competition_id: 'competition-1',
        competition_name: 'Autumn Cup', competition_status: 'completed', has_more: false, next_cursor: null,
        placement: 2, result_id: 'result-2', result_member_count: 51, result_type: 'individual',
        result_member_display_names: Array.from({ length: 50 }, (_, index) => ({ display_name: `Student ${index + 1}`, student_id: `student-${index + 1}` })),
        team_name: null, unique_enrolled_participants_count: 4,
      },
      {
        ...studentRows[0],
        award: 'Gold', category: 'Junior', competition_date: '2026-10-10', competition_id: 'competition-1',
        competition_name: 'Autumn Cup', competition_status: 'completed', has_more: false, next_cursor: null,
        placement: 1, result_id: 'result-3', result_member_count: 2, result_member_display_names: [{ display_name: 'Ana One', student_id: 'student-1' }, { display_name: 'Bea Two', student_id: 'student-2' }],
        result_type: 'team', team_name: 'Fire', unique_enrolled_participants_count: 4,
      },
    ])
    renderReports()
    fireEvent.click(screen.getByRole('tab', { name: 'Competition Results' }))

    expect(await screen.findByText('No results recorded')).toBeInTheDocument()
    expect(screen.getByText('individual')).toBeInTheDocument()
    expect(screen.getByText('team')).toBeInTheDocument()
    expect(screen.getByText('Showing 50 of 51 members')).toBeInTheDocument()
    expect(screen.getByText('Competition participation trend data')).toBeInTheDocument()
    expect(screen.getByLabelText('Unique enrolled participants 0')).toBeInTheDocument()
  })

  it('applies competition filters, resets pagination, and preserves Previous after an empty continuation', async () => {
    getCompetitionResultsReport
      .mockResolvedValueOnce([{ ...studentRows[0], competition_date: '2026-10-10', competition_id: 'competition-1', competition_name: 'Autumn Cup', competition_status: 'completed', result_id: 'result-1', result_member_count: 1, result_member_display_names: [{ display_name: 'Ana One', student_id: 'student-1' }], result_type: 'individual', unique_enrolled_participants_count: 1, has_more: true, next_cursor: 'competition-next' }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ ...studentRows[0], competition_date: '2026-10-10', competition_id: 'competition-1', competition_name: 'Autumn Cup', competition_status: 'completed', result_id: 'result-1', result_member_count: 1, result_member_display_names: [{ display_name: 'Ana One', student_id: 'student-1' }], result_type: 'individual', unique_enrolled_participants_count: 1, has_more: false, next_cursor: null }])
    renderReports()
    fireEvent.click(screen.getByRole('tab', { name: 'Competition Results' }))
    expect(await screen.findByText('Autumn Cup')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('No additional competition result records')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Autumn Cup')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Competition status'), { target: { value: 'completed' } })
    fireEvent.change(screen.getByLabelText('Result type'), { target: { value: 'individual' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(getCompetitionResultsReport.mock.calls.at(-1)[0]).toMatchObject({ afterCursor: null, resultType: 'individual', status: 'completed' }))
    expect(await screen.findByText('Autumn Cup')).toBeInTheDocument()
    expect(screen.getByText('Page 1')).toBeInTheDocument()
  })

  it('keeps competition results available while blocking a thirteen-month participation trend', async () => {
    renderReports()
    fireEvent.click(screen.getByRole('tab', { name: 'Competition Results' }))
    await screen.findByText('Autumn Cup')
    const trendCalls = getCompetitionParticipationSeries.mock.calls.length

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(getCompetitionResultsReport.mock.calls.at(-1)[0]).toMatchObject({
      endDate: '2027-01-01',
      startDate: '2026-01-01',
    }))
    expect(getCompetitionParticipationSeries).toHaveBeenCalledTimes(trendCalls)
    expect(await screen.findByText('Competition trend unavailable for this range')).toBeInTheDocument()
  })

  it('exposes an enabled CSV export action after the initial student report loads', async () => {
    renderReports()
    await screen.findByText('Alex Student')

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
  })

  it('cancels a pending export without downloading and permits a later export', async () => {
    const createObjectUrl = vi.fn(() => 'blob:report')
    const revokeObjectUrl = vi.fn()
    Object.assign(URL, { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })
    let resolvePage
    getStudentAttendanceReport
      .mockResolvedValueOnce(studentRows)
      .mockImplementationOnce(() => new Promise((resolve) => { resolvePage = resolve }))
      .mockResolvedValueOnce(studentRows)
    renderReports()
    await screen.findByText('Alex Student')

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel export' }))
    resolvePage(studentRows)
    await Promise.resolve()
    expect(createObjectUrl).not.toHaveBeenCalled()
    expect(screen.queryByText('CSV export downloaded.')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(getStudentAttendanceReport).toHaveBeenCalledTimes(3))
  })

})
