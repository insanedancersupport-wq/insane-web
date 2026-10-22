import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompetitionDetailsPage } from './CompetitionDetailsPage'
import * as api from './competitionsApi'
import { AuthContext } from '../auth/AuthContext'

vi.mock('./competitionsApi', () => ({
  addCompetitionGroup: vi.fn(),
  addCompetitionParticipant: vi.fn(),
  addCompetitionTrainer: vi.fn(),
  deleteCompetition: vi.fn(),
  enrollCompetitionGroup: vi.fn(),
  getAvailableGroups: vi.fn(),
  getCompetitionById: vi.fn(),
  getCompetitionGroups: vi.fn(),
  getCompetitionParticipants: vi.fn(),
  getCompetitionTrainers: vi.fn(),
  getCurrentTrainerId: vi.fn(),
  getEligibleStudents: vi.fn(),
  getEligibleTrainers: vi.fn(),
  removeCompetitionGroup: vi.fn(),
  removeCompetitionParticipant: vi.fn(),
  removeCompetitionTrainer: vi.fn(),
  updateCompetition: vi.fn(),
}))

afterEach(cleanup)

const competition = {
  competition_date: '2026-11-10',
  created_at: '2026-01-01T00:00:00Z',
  created_by: 'admin-profile',
  description: 'Annual event',
  id: 'competition-id',
  location: 'Bucharest',
  name: 'Autumn Open',
  status: 'upcoming',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderPage(profile) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile }}>
        <MemoryRouter initialEntries={['/app/competitions/competition-id']}>
          <Routes>
            <Route path="/app/competitions/:competitionId" element={<CompetitionDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('CompetitionDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getCompetitionById.mockResolvedValue(competition)
    api.getCompetitionGroups.mockResolvedValue([{ group_id: 'group-id', name: 'Crew A' }])
    api.getCompetitionParticipants.mockResolvedValue([{
      enrolled_at: '2026-01-01T00:00:00Z',
      first_name: 'Visible',
      last_name: 'Student',
      participant_id: 'participant-id',
      student_id: 'student-id',
    }])
    api.getCompetitionTrainers.mockResolvedValue([{
      first_name: 'Maya',
      last_name: 'Dance',
      trainer_id: 'trainer-id',
    }])
    api.getCurrentTrainerId.mockResolvedValue(null)
    api.getAvailableGroups.mockResolvedValue([{ id: 'group-2', name: 'Crew B' }])
    api.getEligibleStudents.mockResolvedValue([])
    api.getEligibleTrainers.mockResolvedValue([])
    api.enrollCompetitionGroup.mockResolvedValue(2)
    api.updateCompetition.mockResolvedValue()
  })

  it('keeps an unassigned trainer in read-only mode', async () => {
    renderPage({ id: 'other-profile', role: 'trainer' })

    expect(await screen.findByText('Autumn Open')).toBeInTheDocument()
    expect(screen.getByText('Maya Dance')).toBeInTheDocument()
    expect(screen.getByText('Crew A')).toBeInTheDocument()
    expect(screen.getByText('Visible Student')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit competition' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add student' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enroll students from group' })).not.toBeInTheDocument()
  })

  it('uses the trainer profile relationship to allow a responsible trainer to enroll a group', async () => {
    api.getCurrentTrainerId.mockResolvedValue('trainer-id')
    renderPage({ id: 'responsible-profile', role: 'trainer' })

    expect(await screen.findByText('Visible Student')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Enroll students from group' }))

    await waitFor(() => expect(api.enrollCompetitionGroup).toHaveBeenCalled())
    expect(api.enrollCompetitionGroup.mock.calls[0][0]).toEqual({
      competitionId: 'competition-id',
      groupId: 'group-id',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('2 students enrolled successfully.')
  })

  it('sends only changed editable competition fields on admin edit', async () => {
    renderPage({ id: 'admin-profile', role: 'admin' })

    expect(await screen.findByText('Maya Dance')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit competition' }))
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Cluj-Napoca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.updateCompetition).toHaveBeenCalled())
    expect(api.updateCompetition.mock.calls[0][0]).toEqual({
      id: 'competition-id',
      values: { location: 'Cluj-Napoca' },
    })
  })

  it('reports a participant display query failure instead of treating it as missing data', async () => {
    api.getCompetitionParticipants.mockRejectedValue(new Error('display access failed'))
    renderPage({ id: 'other-profile', role: 'trainer' })

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load participants.')
    expect(screen.queryByText('No students enrolled yet.')).not.toBeInTheDocument()
  })
})
