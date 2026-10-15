import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AttendanceMatrixPage, attendanceColumnHeader, attendanceStatistics, monthlyRange } from './AttendanceMatrixPage'
import { getMonthlyAttendance } from './attendanceApi'
import { AuthContext } from '../auth/AuthContext'
import { getAuthoritativeSchoolSettings } from '../calendar/calendarApi'
import { listGroups } from '../groups/groupsApi'

vi.mock('./attendanceApi', () => ({ getMonthlyAttendance: vi.fn() }))
vi.mock('../calendar/calendarApi', () => ({ getAuthoritativeSchoolSettings: vi.fn() }))
vi.mock('../groups/groupsApi', () => ({ listGroups: vi.fn() }))

afterEach(cleanup)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={{ profile: { role: 'admin' } }}><MemoryRouter initialEntries={['/app/attendance?groupId=group-id']}><AttendanceMatrixPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('attendance matrix helpers', () => {
  beforeEach(() => {
    getAuthoritativeSchoolSettings.mockResolvedValue({ timezone: 'Europe/Bucharest' })
    listGroups.mockResolvedValue([{ id: 'group-id', name: 'Junior Crew' }])
    getMonthlyAttendance.mockResolvedValue({
      entries: [
        { ends_at: '2026-10-01T16:00:00.000Z', id: 'class-one', starts_at: '2026-10-01T15:00:00.000Z' },
        { ends_at: '2026-10-08T16:00:00.000Z', id: 'class-two', starts_at: '2026-10-08T15:00:00.000Z' },
      ],
      records: [
        { schedule_entry_id: 'class-one', status: 'present', student_id: 'current', student: { first_name: 'Maya', id: 'current', last_name: 'Dance' } },
        { schedule_entry_id: 'class-two', status: 'absent', student_id: 'current', student: { first_name: 'Maya', id: 'current', last_name: 'Dance' } },
        { schedule_entry_id: 'class-one', status: 'recovery', student_id: 'historical', student: { first_name: 'Zoe', id: 'historical', last_name: 'Former' } },
      ],
      roster: [{ first_name: 'Maya', id: 'current', last_name: 'Dance' }],
    })
  })

  it('renders current and historical students with persisted and unmarked cells', async () => {
    renderPage()

    expect(await screen.findByText('Maya Dance')).toBeInTheDocument()
    expect(screen.getByText('Zoe Former')).toBeInTheDocument()
    expect(screen.getByLabelText(/Maya Dance, 2026-10-01: present/)).toHaveTextContent('P')
    expect(screen.getByLabelText(/Maya Dance, 2026-10-08: absent/)).toHaveTextContent('A')
    expect(screen.getByLabelText(/Zoe Former, 2026-10-01: recovery/)).toHaveTextContent('R')
    expect(screen.getByLabelText(/Zoe Former, 2026-10-08: unmarked/)).toHaveTextContent('—')
    expect(screen.getByRole('columnheader', { name: '01.10.2026, 18:00–19:00' })).toHaveTextContent('01.10')
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('keeps unmarked cells distinct from absence and excludes them from participation', () => {
    expect(attendanceStatistics([
      { status: 'present' },
      { status: 'absent' },
      { status: 'recovery' },
    ], 2, 2)).toEqual({
      absent: 1,
      participation: 67,
      present: 1,
      recovery: 1,
      unmarked: 1,
    })
  })

  it('handles a month with no recorded attendance safely', () => {
    expect(attendanceStatistics([], 3, 2)).toMatchObject({
      absent: 0,
      participation: 0,
      present: 0,
      recovery: 0,
      unmarked: 6,
    })
  })

  it('counts a cleared record as unmarked after the matrix reloads', () => {
    expect(attendanceStatistics([], 1, 1)).toMatchObject({
      absent: 0,
      participation: 0,
      present: 0,
      recovery: 0,
      unmarked: 1,
    })
  })

  it('uses school-timezone month boundaries for bounded class queries', () => {
    expect(monthlyRange('2026-10', 'Europe/Bucharest')).toMatchObject({
      endIso: '2026-10-31T22:00:00.000Z',
      startIso: '2026-09-30T21:00:00.000Z',
    })
  })

  it('formats separate date and time headers for multiple classes on one school date', () => {
    expect(attendanceColumnHeader({
      ends_at: '2026-10-11T19:30:00.000Z',
      starts_at: '2026-10-11T18:30:00.000Z',
    }, 'Europe/Bucharest')).toEqual({
      accessibleLabel: '11.10.2026, 21:30–22:30',
      date: '11.10',
      timeRange: '21:30–22:30',
    })
    expect(attendanceColumnHeader({
      ends_at: '2026-10-11T21:00:00.000Z',
      starts_at: '2026-10-11T20:00:00.000Z',
    }, 'Europe/Bucharest').timeRange).toBe('23:00–00:00')
  })

  it('formats headers using the Europe/Bucharest DST offset at the boundary', () => {
    expect(attendanceColumnHeader({
      ends_at: '2026-10-25T02:30:00.000Z',
      starts_at: '2026-10-25T01:30:00.000Z',
    }, 'Europe/Bucharest')).toMatchObject({
      date: '25.10',
      timeRange: '03:30–04:30',
    })
  })
})
