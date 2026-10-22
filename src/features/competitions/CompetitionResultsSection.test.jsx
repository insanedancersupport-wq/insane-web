import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompetitionResultsSection } from './CompetitionResultsSection'
import * as api from './competitionsApi'

vi.mock('./competitionsApi', () => ({
  deleteCompetitionResult: vi.fn(),
  getCompetitionResultMembers: vi.fn(),
  getCompetitionResults: vi.fn(),
  saveCompetitionResult: vi.fn(),
}))

afterEach(cleanup)

const participants = [
  { first_name: 'Maria', last_name: 'Popescu', student_id: 'student-1' },
  { first_name: 'Alex', last_name: 'Rhythm', student_id: 'student-2' },
  { first_name: 'Dana', last_name: 'Move', student_id: 'student-3' },
]

const results = [
  {
    award: 'Gold medal',
    category: 'Hip-Hop Crew',
    created_at: '2026-01-03T00:00:00Z',
    id: 'result-team',
    notes: '',
    placement: 2,
    result_type: 'team',
    team_name: 'Insane Crew',
  },
  {
    award: null,
    category: 'Hip-Hop Solo',
    created_at: '2026-01-02T00:00:00Z',
    id: 'result-solo',
    notes: 'Strong performance',
    placement: 1,
    result_type: 'individual',
    team_name: null,
  },
  {
    award: null,
    category: 'Street Dance',
    created_at: '2026-01-04T00:00:00Z',
    id: 'result-unranked',
    notes: null,
    placement: null,
    result_type: 'individual',
    team_name: null,
  },
]

const members = [
  { first_name: 'Maria', last_name: 'Popescu', result_id: 'result-solo', student_id: 'student-1' },
  { first_name: 'Maria', last_name: 'Popescu', result_id: 'result-team', student_id: 'student-1' },
  { first_name: 'Alex', last_name: 'Rhythm', result_id: 'result-team', student_id: 'student-2' },
  { first_name: 'Maria', last_name: 'Popescu', result_id: 'result-unranked', student_id: 'student-1' },
]

function renderSection(canManage = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CompetitionResultsSection canManage={canManage} competitionId="competition-id" participants={participants} />
    </QueryClientProvider>,
  )
}

describe('CompetitionResultsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.deleteCompetitionResult.mockResolvedValue()
    api.getCompetitionResultMembers.mockResolvedValue(members)
    api.getCompetitionResults.mockResolvedValue(results)
    api.saveCompetitionResult.mockResolvedValue('new-result')
  })

  it('displays individual and team results independently with their member names', async () => {
    renderSection()

    expect(await screen.findByText('Hip-Hop Solo')).toBeInTheDocument()
    expect(screen.getByText('Insane Crew')).toBeInTheDocument()
    expect(screen.getAllByText(/Maria Popescu/)).toHaveLength(5)
    expect(screen.getByText('Members: Maria Popescu, Alex Rhythm')).toBeInTheDocument()
    expect(screen.getByText('Participation')).toBeInTheDocument()
  })

  it('filters results by type and category', async () => {
    renderSection()
    await screen.findByText('Hip-Hop Solo')

    fireEvent.change(screen.getByLabelText('Result type'), { target: { value: 'team' } })
    expect(screen.getByText('Hip-Hop Crew')).toBeInTheDocument()
    expect(screen.queryByText('Hip-Hop Solo')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Result type'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Search categories'), { target: { value: 'street' } })
    expect(screen.getByText('Street Dance')).toBeInTheDocument()
    expect(screen.queryByText('Hip-Hop Crew')).not.toBeInTheDocument()
  })

  it('hides result mutations from unassigned trainers', async () => {
    renderSection(false)

    await screen.findByText('Hip-Hop Solo')
    expect(screen.queryByRole('button', { name: 'Add result' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit result' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete result' })).not.toBeInTheDocument()
  })

  it('distinguishes loading, query failure, and empty results', async () => {
    api.getCompetitionResults.mockImplementation(() => new Promise(() => {}))
    const { unmount } = renderSection()
    expect(screen.getByText('Loading competition results')).toBeInTheDocument()
    unmount()

    api.getCompetitionResults.mockRejectedValue(new Error('network failed'))
    renderSection()
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load competition results')
    cleanup()

    api.getCompetitionResults.mockResolvedValue([])
    renderSection()
    expect(await screen.findByRole('heading', { name: 'No results yet' })).toBeInTheDocument()
  })

  it('validates selected members and saves through the atomic RPC without creator metadata', async () => {
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: 'Add result' }))
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Jazz Solo' } })
    fireEvent.click(screen.getByLabelText('Maria Popescu'))
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }))

    await waitFor(() => expect(api.saveCompetitionResult).toHaveBeenCalled())
    expect(api.saveCompetitionResult.mock.calls[0][0]).toEqual({
      award: '',
      category: 'Jazz Solo',
      competitionId: 'competition-id',
      notes: '',
      placement: null,
      resultId: null,
      resultType: 'individual',
      studentIds: ['student-1'],
      teamName: '',
    })
  })

  it('requires two members for a team and asks for deletion confirmation', async () => {
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: 'Add result' }))
    fireEvent.change(screen.getAllByLabelText('Result type')[1], { target: { value: 'team' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Jazz Duo' } })
    fireEvent.click(screen.getByLabelText('Maria Popescu'))
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }))
    expect(await screen.findByText('Team results require at least two students.')).toBeInTheDocument()
    expect(api.saveCompetitionResult).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete result' })[0])
    expect(api.deleteCompetitionResult).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete result' }).at(-1))
    await waitFor(() => expect(api.deleteCompetitionResult).toHaveBeenCalled())
    expect(api.deleteCompetitionResult.mock.calls[0][0]).toBe('result-team')
  })
})
