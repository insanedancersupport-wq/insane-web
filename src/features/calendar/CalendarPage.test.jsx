import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarPage } from './CalendarPage'
import {
  createScheduleEntry,
  createWeeklyScheduleEntries,
  getAuthoritativeSchoolSettings,
  listScheduleEntries,
} from './calendarApi'
import { AuthContext } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import { listRooms } from '../rooms/roomsApi'
import { listTrainers } from '../trainers/trainersApi'

vi.mock('./calendarApi', () => ({
  cancelScheduleEntry: vi.fn(),
  createScheduleEntry: vi.fn(),
  createWeeklyScheduleEntries: vi.fn(),
  deleteScheduleEntry: vi.fn(),
  getAuthoritativeSchoolSettings: vi.fn(),
  listScheduleEntries: vi.fn(),
  updateScheduleEntry: vi.fn(),
}))

vi.mock('../groups/groupsApi', () => ({ listGroups: vi.fn() }))
vi.mock('../rooms/roomsApi', () => ({ listRooms: vi.fn() }))
vi.mock('../trainers/trainersApi', () => ({ listTrainers: vi.fn() }))

const group = { active: true, id: 'group-id', name: 'Junior Crew' }
const room = { active: true, id: 'room-id', name: 'Studio A' }
const trainer = { active: true, first_name: 'Maya', id: 'trainer-id', last_name: 'Dance' }

afterEach(cleanup)

function renderPage(role = 'admin') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile: { id: 'admin-id', role } }}>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthoritativeSchoolSettings.mockResolvedValue({
      school_name: 'Insane Dance Center',
      timezone: 'Europe/Bucharest',
    })
    listGroups.mockResolvedValue([group])
    listRooms.mockResolvedValue([room])
    listTrainers.mockResolvedValue([trainer])
    listScheduleEntries.mockResolvedValue([])
    createScheduleEntry.mockResolvedValue({ id: 'entry-id' })
    createWeeklyScheduleEntries.mockResolvedValue([{ id: 'entry-id' }])
  })

  it('creates a class using school-time conversion and selected resources', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add activity' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Evening class' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '19:00' } })
    fireEvent.change(screen.getByLabelText('Group', { selector: '#schedule-entry-group' }), { target: { value: group.id } })
    fireEvent.change(screen.getByLabelText('Responsible trainer'), { target: { value: trainer.id } })
    fireEvent.change(screen.getByLabelText('Room', { selector: '#schedule-entry-room' }), { target: { value: room.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))

    await waitFor(() => {
      expect(createScheduleEntry).toHaveBeenCalledWith(expect.objectContaining({
        created_by: 'admin-id',
        ends_at: '2026-10-05T16:00:00.000Z',
        group_id: group.id,
        room_id: room.id,
        starts_at: '2026-10-05T15:00:00.000Z',
        title: 'Evening class',
        trainer_id: trainer.id,
      }))
    })
  })

  it('uses a scrollable dialog body with a fixed action footer for long calendar forms', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add activity' }))

    const activityDialog = screen.getByRole('dialog', { name: 'Add activity' })
    expect(activityDialog).toHaveClass('dialog--scrollable')
    expect(activityDialog.querySelector('.dialog__body--scrollable form')).toHaveAttribute('id', 'calendar-entry-form')
    expect(activityDialog.querySelector('.dialog__footer')).toContainElement(
      screen.getByRole('button', { name: 'Save activity' }),
    )
    expect(activityDialog.querySelector('.dialog__footer')).toContainElement(
      screen.getByRole('button', { name: 'Cancel' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create weekly class' }))

    const weeklyDialog = screen.getByRole('dialog', { name: 'Create weekly class' })
    expect(weeklyDialog).toHaveClass('dialog--scrollable')
    expect(weeklyDialog.querySelector('.dialog__body--scrollable form')).toHaveAttribute('id', 'weekly-calendar-entry-form')
    expect(weeklyDialog.querySelector('.dialog__footer')).toContainElement(
      screen.getByRole('button', { name: 'Create weekly activities' }),
    )
  })

  it('uses the weekly RPC instead of issuing individual entry requests', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Create weekly class' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Weekly class' } })
    fireEvent.change(screen.getByLabelText('First date'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('Final date'), { target: { value: '2026-10-19' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '19:00' } })
    fireEvent.change(screen.getByLabelText('Group', { selector: '#weekly-entry-group' }), { target: { value: group.id } })
    fireEvent.change(screen.getByLabelText('Responsible trainer'), { target: { value: trainer.id } })
    fireEvent.change(screen.getByLabelText('Room', { selector: '#weekly-entry-room' }), { target: { value: room.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Create weekly activities' }))

    await waitFor(() => {
      expect(createWeeklyScheduleEntries.mock.calls[0][0]).toEqual(expect.objectContaining({
        first_date: '2026-10-05',
        last_date: '2026-10-19',
        target_group_id: group.id,
        target_room_id: room.id,
        target_trainer_id: trainer.id,
      }))
    })
    expect(createScheduleEntry).not.toHaveBeenCalled()
  })

  it('combines the selected group filter with a bounded calendar query', async () => {
    renderPage()

    await screen.findByLabelText('Group')
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: group.id } })

    await waitFor(() => {
      const latestCall = listScheduleEntries.mock.calls.at(-1)[0]
      expect(latestCall).toEqual(expect.objectContaining({
        groupId: group.id,
        rangeEnd: expect.any(String),
        rangeStart: expect.any(String),
      }))
    })
  })

  it('rejects overnight entry times before sending a direct schedule write', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add activity' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Late event' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '20:00' } })
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '19:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(await screen.findByText('End time must be after start time on the same date.')).toBeInTheDocument()
    expect(createScheduleEntry).not.toHaveBeenCalled()
  })

  it('keeps trainer calendar access read-only', async () => {
    listScheduleEntries.mockResolvedValue([{
      ends_at: '2026-10-05T16:00:00.000Z',
      entry_type: 'class',
      group: group,
      id: 'entry-id',
      is_extra: false,
      notes: null,
      room,
      starts_at: '2026-10-05T15:00:00.000Z',
      status: 'scheduled',
      title: 'Trainer class',
      trainer,
    }])
    renderPage('trainer')

    expect(await screen.findByText('Trainer class')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Trainer class/ }))
    expect(await screen.findByText('Schedule activity')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel activity' })).not.toBeInTheDocument()
  })
})
