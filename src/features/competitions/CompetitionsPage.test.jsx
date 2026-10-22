import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompetitionsPage } from './CompetitionsPage'
import { createCompetition, getCompetitions } from './competitionsApi'
import { AuthContext } from '../auth/AuthContext'

vi.mock('./competitionsApi', () => ({
  createCompetition: vi.fn(),
  getCompetitions: vi.fn(),
}))

afterEach(cleanup)

const competitions = [
  {
    competition_date: '2026-11-10',
    competition_groups: [{ group_id: 'group-1' }],
    competition_participants: [{ id: 'participant-1' }],
    competition_trainers: [{ trainer_id: 'trainer-1' }],
    id: 'upcoming-id',
    location: 'Bucharest',
    name: 'Autumn Open',
    status: 'upcoming',
  },
  {
    competition_date: '2026-01-10',
    competition_groups: [],
    competition_participants: [],
    competition_trainers: [],
    id: 'completed-id',
    location: null,
    name: 'Winter Finals',
    status: 'completed',
  },
  {
    competition_date: '2026-12-10',
    competition_groups: [],
    competition_participants: [],
    competition_trainers: [],
    id: 'cancelled-id',
    location: null,
    name: 'Cancelled Cup',
    status: 'cancelled',
  },
]

function renderPage(role = 'admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile: { id: 'profile-id', role } }}>
        <MemoryRouter><CompetitionsPage /></MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('CompetitionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCompetitions.mockResolvedValue(competitions)
    createCompetition.mockResolvedValue({ id: 'created-id' })
  })

  it('shows creation controls to admins but not trainers', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'New competition' })).toBeInTheDocument()
    cleanup()

    renderPage('trainer')
    await screen.findByText('Autumn Open')
    expect(screen.queryByRole('button', { name: 'New competition' })).not.toBeInTheDocument()
  })

  it('filters competitions by status and name', async () => {
    renderPage()
    await screen.findByText('Autumn Open')

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } })
    expect(screen.getByText('Winter Finals')).toBeInTheDocument()
    expect(screen.queryByText('Autumn Open')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Search competitions'), { target: { value: 'cup' } })
    expect(screen.getByText('Cancelled Cup')).toBeInTheDocument()
    expect(screen.queryByText('Winter Finals')).not.toBeInTheDocument()
  })

  it('creates a competition without creator metadata', async () => {
    getCompetitions.mockResolvedValue([])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'New competition' }))
    fireEvent.change(screen.getByLabelText('Competition name'), { target: { value: 'Spring Open' } })
    fireEvent.change(screen.getByLabelText('Competition date'), { target: { value: '2026-04-18' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create competition' }))

    await waitFor(() => expect(createCompetition).toHaveBeenCalled())
    expect(createCompetition.mock.calls[0][0]).toEqual({
      competition_date: '2026-04-18',
      description: null,
      location: null,
      name: 'Spring Open',
      status: 'upcoming',
    })
  })

  it('shows loading, error, and empty states', async () => {
    getCompetitions.mockImplementation(() => new Promise(() => {}))
    const { unmount } = renderPage()
    expect(screen.getByText('Loading competitions')).toBeInTheDocument()
    unmount()

    getCompetitions.mockRejectedValue(new Error('failed'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load competitions')
    cleanup()

    getCompetitions.mockResolvedValue([])
    renderPage()
    expect(await screen.findByRole('heading', { name: 'No competitions yet' })).toBeInTheDocument()
  })
})
