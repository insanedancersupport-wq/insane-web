import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GroupsPage } from './GroupsPage'
import {
  createGroup,
  listGroupTrainers,
  listGroupsWithDetails,
  reconcileGroupTrainers,
  updateGroup,
} from './groupsApi'
import { AuthContext } from '../auth/AuthContext'
import { listRooms } from '../rooms/roomsApi'
import { listTrainers } from '../trainers/trainersApi'

vi.mock('./groupsApi', () => ({
  createGroup: vi.fn(),
  listGroupTrainers: vi.fn(),
  listGroupsWithDetails: vi.fn(),
  reconcileGroupTrainers: vi.fn(),
  updateGroup: vi.fn(),
}))

vi.mock('../rooms/roomsApi', () => ({
  listRooms: vi.fn(),
}))

vi.mock('../trainers/trainersApi', () => ({
  listTrainers: vi.fn(),
}))

const trainers = [
  { active: true, first_name: 'Maya', id: 'trainer-a', last_name: 'Dance' },
  { active: true, first_name: 'Alex', id: 'trainer-b', last_name: 'Rhythm' },
]

afterEach(cleanup)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile: { role: 'admin' } }}>
        <MemoryRouter>
          <GroupsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function enterGroupName() {
  fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Junior Crew' } })
}

describe('GroupsPage trainer assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createGroup.mockResolvedValue({ id: 'new-group-id' })
    listGroupTrainers.mockResolvedValue([])
    listRooms.mockResolvedValue([])
    listTrainers.mockResolvedValue(trainers)
    reconcileGroupTrainers.mockResolvedValue()
    updateGroup.mockResolvedValue()
  })

  it('creates a group and reconciles its initial trainer assignments', async () => {
    listGroupsWithDetails.mockResolvedValue([])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add group' }))
    enterGroupName()
    fireEvent.click(screen.getByLabelText('Maya Dance'))
    fireEvent.change(screen.getByLabelText('Primary trainer'), { target: { value: 'trainer-a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }))

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: 'Junior Crew' }))
      expect(reconcileGroupTrainers).toHaveBeenCalledWith({
        groupId: 'new-group-id',
        primaryTrainerId: 'trainer-a',
        trainerIds: ['trainer-a'],
      })
    })
  })

  it('loads existing assignments and reconciles changed trainers and primary trainer on edit', async () => {
    listGroupsWithDetails.mockResolvedValue([{
      active: true,
      category: '',
      default_room_id: null,
      description: '',
      id: 'group-id',
      level: '',
      name: 'Junior Crew',
      default_room: { name: 'Studio A' },
      group_trainers: [{ is_primary: true, trainer: trainers[0] }],
      student_groups: [{ student: { status: 'active' } }],
    }])
    listGroupTrainers.mockResolvedValue([{ is_primary: true, trainer_id: 'trainer-a' }])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(await screen.findByLabelText('Maya Dance')).toBeChecked()
    expect(screen.getByLabelText('Primary trainer')).toHaveValue('trainer-a')

    fireEvent.click(screen.getByLabelText('Alex Rhythm'))
    fireEvent.change(screen.getByLabelText('Primary trainer'), { target: { value: 'trainer-b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }))

    await waitFor(() => {
      expect(updateGroup).toHaveBeenCalledWith({
        id: 'group-id',
        values: expect.objectContaining({ name: 'Junior Crew' }),
      })
      expect(reconcileGroupTrainers).toHaveBeenCalledWith({
        groupId: 'group-id',
        primaryTrainerId: 'trainer-b',
        trainerIds: ['trainer-a', 'trainer-b'],
      })
    })
  })

  it('only allows an assigned trainer to be selected as primary', async () => {
    listGroupsWithDetails.mockResolvedValue([])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add group' }))

    const primaryTrainer = screen.getByLabelText('Primary trainer')
    expect(screen.queryByRole('option', { name: 'Maya Dance' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Maya Dance'))
    fireEvent.change(primaryTrainer, { target: { value: 'trainer-a' } })
    expect(primaryTrainer).toHaveValue('trainer-a')

    fireEvent.click(screen.getByLabelText('Maya Dance'))
    expect(primaryTrainer).toHaveValue('')
    expect(screen.queryByRole('option', { name: 'Maya Dance' })).not.toBeInTheDocument()
  })

  it('displays trainers, default room, and a derived active student count', async () => {
    listGroupsWithDetails.mockResolvedValue([{
      active: true,
      category: 'Ballet',
      default_room: { name: 'Studio A' },
      group_trainers: [
        { is_primary: true, trainer: trainers[0] },
        { is_primary: false, trainer: trainers[1] },
      ],
      id: 'group-id',
      level: 'Intermediate',
      name: 'Junior Crew',
      student_groups: [
        { student: { status: 'active' } },
        { student: { status: 'active' } },
        { student: { status: 'trial' } },
      ],
    }])
    renderPage()

    expect(await screen.findByText('Trainers: Maya Dance (Primary), Alex Rhythm')).toBeInTheDocument()
    expect(screen.getByText('Default room: Studio A')).toBeInTheDocument()
    expect(screen.getByText('Active students: 2')).toBeInTheDocument()
  })

  it('explains how to recover when assignments fail after saving group details', async () => {
    listGroupsWithDetails.mockResolvedValue([])
    reconcileGroupTrainers.mockRejectedValueOnce(new Error('RPC failed'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add group' }))
    enterGroupName()
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Group details were saved, but trainer assignments could not be saved',
    )
  })
})
