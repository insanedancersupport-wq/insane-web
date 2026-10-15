import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AttendancePage } from './AttendancePage'
import {
  getAttendanceEntry,
  listAttendanceRecords,
  listAttendanceRoster,
  saveAttendanceRecords,
} from './attendanceApi'
import { AuthContext } from '../auth/AuthContext'
import { getAuthoritativeSchoolSettings } from '../calendar/calendarApi'
import { listTrainers } from '../trainers/trainersApi'

vi.mock('./attendanceApi', () => ({
  getAttendanceEntry: vi.fn(),
  listAttendanceRecords: vi.fn(),
  listAttendanceRoster: vi.fn(),
  saveAttendanceRecords: vi.fn(),
}))

vi.mock('../calendar/calendarApi', () => ({
  getAuthoritativeSchoolSettings: vi.fn(),
}))

vi.mock('../trainers/trainersApi', () => ({
  listTrainers: vi.fn(),
}))

function startedClassTimes() {
  const endsAt = new Date(Date.now() - (30 * 60 * 1000))
  const startsAt = new Date(endsAt.getTime() - (60 * 60 * 1000))

  return {
    ends_at: endsAt.toISOString(),
    starts_at: startsAt.toISOString(),
  }
}

afterEach(cleanup)

function renderPage(role = 'trainer') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile: { id: 'profile-id', role } }}>
        <MemoryRouter initialEntries={['/app/attendance/entries/entry-id']}>
          <Routes>
            <Route element={<AttendancePage />} path="/app/attendance/entries/:scheduleEntryId" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )

  return { ...rendered, queryClient }
}

describe('AttendancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthoritativeSchoolSettings.mockResolvedValue({ timezone: 'Europe/Bucharest' })
    getAttendanceEntry.mockResolvedValue({
      ...startedClassTimes(),
      entry_type: 'class',
      group: { name: 'Junior Crew' },
      group_id: 'group-id',
      id: 'entry-id',
      status: 'scheduled',
      title: 'Evening class',
      trainer_id: 'trainer-id',
    })
    listAttendanceRoster.mockResolvedValue([
      { first_name: 'Maya', id: 'student-id', last_name: 'Dance' },
    ])
    listAttendanceRecords.mockResolvedValue([])
    listTrainers.mockResolvedValue([{ id: 'trainer-id', profile_id: 'profile-id' }])
    saveAttendanceRecords.mockResolvedValue([{ id: 'attendance-id' }])
  })

  it('loads the class roster and batch saves a selected attendance status', async () => {
    renderPage()

    expect(await screen.findByText('Maya Dance')).toBeInTheDocument()
    expect(screen.getByText('Unmarked')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Attendance status'), { target: { value: 'recovery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }))

    await waitFor(() => {
      expect(saveAttendanceRecords).toHaveBeenCalledWith({
        records: [{ notes: '', status: 'recovery', studentId: 'student-id' }],
        scheduleEntryId: 'entry-id',
      })
    })
  })

  it('shows persisted absence separately from an unmarked student', async () => {
    listAttendanceRoster.mockResolvedValue([
      { first_name: 'Maya', id: 'student-id', last_name: 'Dance' },
      { first_name: 'Zoey', id: 'unmarked-student-id', last_name: 'Rhythm' },
    ])
    listAttendanceRecords.mockResolvedValue([{
      id: 'attendance-id',
      notes: null,
      schedule_entry_id: 'entry-id',
      status: 'absent',
      student: { first_name: 'Maya', id: 'student-id', last_name: 'Dance' },
      student_id: 'student-id',
    }])

    renderPage()

    const markedRow = (await screen.findByText('Maya Dance')).closest('.attendance-row')
    const unmarkedRow = screen.getByText('Zoey Rhythm').closest('.attendance-row')

    expect(within(markedRow).getByLabelText('Attendance status')).toHaveValue('absent')
    expect(screen.getByText('Marked')).toBeInTheDocument()
    expect(within(unmarkedRow).getByLabelText('Attendance status')).toHaveValue('')
    expect(screen.getByText('Unmarked')).toBeInTheDocument()
  })

  it.each(['present', 'absent', 'recovery'])('saves %s changed to not marked as a clearing operation', async (status) => {
    listAttendanceRecords.mockResolvedValue([{
      id: 'attendance-id',
      notes: null,
      schedule_entry_id: 'entry-id',
      status,
      student: { first_name: 'Maya', id: 'student-id', last_name: 'Dance' },
      student_id: 'student-id',
    }])
    renderPage()

    const statusSelect = await screen.findByLabelText('Attendance status')
    fireEvent.change(statusSelect, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }))

    await waitFor(() => {
      expect(saveAttendanceRecords).toHaveBeenCalledWith({
        records: [{ notes: '', status: '', studentId: 'student-id' }],
        scheduleEntryId: 'entry-id',
      })
    })
  })

  it('shows cleared attendance as unmarked after records are refetched', async () => {
    listAttendanceRecords
      .mockResolvedValueOnce([{
        id: 'attendance-id',
        notes: null,
        schedule_entry_id: 'entry-id',
        status: 'present',
        student: { first_name: 'Maya', id: 'student-id', last_name: 'Dance' },
        student_id: 'student-id',
      }])
      .mockResolvedValueOnce([])
    renderPage()

    const statusSelect = await screen.findByLabelText('Attendance status')
    fireEvent.change(statusSelect, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }))

    await waitFor(() => {
      expect(listAttendanceRecords).toHaveBeenCalledTimes(2)
      expect(statusSelect).toHaveValue('')
      expect(screen.getByText('Unmarked')).toBeInTheDocument()
    })
  })

  it('preserves an unsaved draft when attendance records are refetched', async () => {
    const { queryClient } = renderPage()

    const status = await screen.findByLabelText('Attendance status')
    fireEvent.change(status, { target: { value: 'recovery' } })
    queryClient.setQueryData(['attendance-records', 'entry-id'], [{
      id: 'attendance-id',
      notes: null,
      schedule_entry_id: 'entry-id',
      status: 'present',
      student: { first_name: 'Maya', id: 'student-id', last_name: 'Dance' },
      student_id: 'student-id',
    }])

    await waitFor(() => expect(status).toHaveValue('recovery'))
  })
})
