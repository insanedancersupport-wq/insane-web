import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RoomsPage } from './RoomsPage'
import { createRoom, listRooms, updateRoom } from './roomsApi'
import { AuthContext } from '../auth/AuthContext'

vi.mock('./roomsApi', () => ({
  createRoom: vi.fn(),
  listRooms: vi.fn(),
  updateRoom: vi.fn(),
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
          <RoomsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('RoomsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createRoom.mockResolvedValue({ id: 'room-id' })
    updateRoom.mockResolvedValue()
  })

  it('creates, edits, and deactivates a room', async () => {
    listRooms.mockResolvedValue([{
      active: true,
      description: '',
      id: 'room-id',
      name: 'Studio A',
    }])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add room' }))
    fireEvent.change(screen.getByLabelText('Room name'), { target: { value: 'Studio B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save room' }))

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith({ description: '', name: 'Studio B' })
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Room name'), { target: { value: 'Studio A+' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save room' }))
    await waitFor(() => {
      expect(updateRoom).toHaveBeenCalledWith({
        id: 'room-id',
        values: { description: '', name: 'Studio A+' },
      })
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    await waitFor(() => {
      expect(updateRoom).toHaveBeenCalledWith({
        id: 'room-id',
        values: { active: false },
      })
    })
  })
})
