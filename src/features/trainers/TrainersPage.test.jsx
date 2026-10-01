import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrainersPage } from './TrainersPage'
import { createTrainer, listAvailableProfiles, listTrainers, updateTrainer } from './trainersApi'
import { AuthContext } from '../auth/AuthContext'

vi.mock('./trainersApi', () => ({
  createTrainer: vi.fn(),
  listAvailableProfiles: vi.fn(),
  listTrainers: vi.fn(),
  updateTrainer: vi.fn(),
}))

afterEach(cleanup)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile: { role: 'admin' } }}>
        <MemoryRouter>
          <TrainersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function enterTrainerDetails() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maya' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Dance' } })
}

describe('TrainersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createTrainer.mockResolvedValue({ id: 'new-trainer-id' })
    listAvailableProfiles.mockResolvedValue([])
  })

  it('submits Add trainer through the insert operation', async () => {
    listTrainers.mockResolvedValue([])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add trainer' }))
    enterTrainerDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Save trainer' }))

    await waitFor(() => {
      expect(createTrainer).toHaveBeenCalledWith(expect.objectContaining({
        first_name: 'Maya',
        last_name: 'Dance',
        profile_id: null,
      }))
    })
    expect(updateTrainer).not.toHaveBeenCalled()
  })

  it('submits Edit trainer through update with the existing trainer id', async () => {
    listTrainers.mockResolvedValue([{
      active: true,
      email: '',
      first_name: 'Maya',
      id: 'trainer-id',
      last_name: 'Dance',
      notes: '',
      phone: '',
      profile_id: null,
    }])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Mara' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save trainer' }))

    await waitFor(() => {
      expect(updateTrainer).toHaveBeenCalledWith({
        id: 'trainer-id',
        values: expect.objectContaining({
          first_name: 'Mara',
          last_name: 'Dance',
          profile_id: null,
        }),
      })
    })
    expect(createTrainer).not.toHaveBeenCalled()
  })

  it('allows an administrator profile to be linked and later unlinked', async () => {
    listTrainers.mockResolvedValue([])
    listAvailableProfiles.mockResolvedValue([
      { active: true, full_name: 'Alex Admin', id: 'admin-profile-id', role: 'admin' },
    ])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add trainer' }))
    enterTrainerDetails()
    fireEvent.change(screen.getByLabelText('Linked application profile'), {
      target: { value: 'admin-profile-id' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save trainer' }))

    await waitFor(() => {
      expect(createTrainer).toHaveBeenCalledWith(expect.objectContaining({
        profile_id: 'admin-profile-id',
      }))
    })

    cleanup()
    listTrainers.mockResolvedValue([{
      active: true,
      email: '',
      first_name: 'Maya',
      id: 'trainer-id',
      last_name: 'Dance',
      notes: '',
      phone: '',
      profile_id: 'admin-profile-id',
    }])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Linked application profile'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save trainer' }))

    await waitFor(() => {
      expect(updateTrainer).toHaveBeenCalledWith(expect.objectContaining({
        id: 'trainer-id',
        values: expect.objectContaining({ profile_id: null }),
      }))
    })
  })
})
