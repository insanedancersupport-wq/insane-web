import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteCompetition,
  deleteCompetitionResult,
  enrollCompetitionGroup,
  getCompetitionParticipants,
  getCompetitionResultMembers,
  removeCompetitionParticipant,
  saveCompetitionResult,
} from './competitionsApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('competitionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls group enrollment with the migration-defined RPC argument names', async () => {
    supabase.rpc.mockResolvedValue({ data: 3, error: null })

    await expect(enrollCompetitionGroup({ competitionId: 'competition-id', groupId: 'group-id' })).resolves.toBe(3)
    expect(supabase.rpc).toHaveBeenCalledWith('enroll_competition_group', {
      target_competition_id: 'competition-id',
      target_group_id: 'group-id',
    })
  })

  it('loads participant display data through the narrow competition-scoped RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })

    await expect(getCompetitionParticipants('competition-id')).resolves.toEqual([])
    expect(supabase.rpc).toHaveBeenCalledWith('get_competition_participant_display', {
      target_competition_id: 'competition-id',
    })
  })

  it('uses the result member display RPC instead of an embedded student query', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })

    await expect(getCompetitionResultMembers('competition-id')).resolves.toEqual([])
    expect(supabase.rpc).toHaveBeenCalledWith('get_competition_result_member_display', {
      target_competition_id: 'competition-id',
    })
  })

  it('saves complete result data through the atomic RPC without creator metadata', async () => {
    supabase.rpc.mockResolvedValue({ data: 'result-id', error: null })

    await expect(saveCompetitionResult({
      award: 'Gold',
      category: 'Solo',
      competitionId: 'competition-id',
      notes: '',
      placement: 1,
      resultType: 'individual',
      studentIds: ['student-id'],
      teamName: '',
    })).resolves.toBe('result-id')
    expect(supabase.rpc).toHaveBeenCalledWith('save_competition_result', {
      target_award: 'Gold',
      target_category: 'Solo',
      target_competition_id: 'competition-id',
      target_notes: null,
      target_placement: 1,
      target_result_id: null,
      target_result_type: 'individual',
      target_student_ids: ['student-id'],
      target_team_name: null,
    })
  })

  it('deletes results through the protected RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })

    await expect(deleteCompetitionResult('result-id')).resolves.toBeUndefined()
    expect(supabase.rpc).toHaveBeenCalledWith('delete_competition_result', {
      target_result_id: 'result-id',
    })
  })

  it('explains the result-reference foreign-key violation when removing a participant', async () => {
    const select = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23503',
        constraint: 'competition_result_members_competition_id_student_id_fkey',
      },
    })
    const participantId = vi.fn(() => ({ select }))
    const competitionId = vi.fn(() => ({ eq: participantId }))
    const remove = vi.fn(() => ({ eq: competitionId }))
    supabase.from.mockReturnValue({ delete: remove })

    await expect(removeCompetitionParticipant({
      competitionId: 'competition-id',
      participantId: 'participant-id',
    })).rejects.toThrow('referenced by competition results')
  })

  it('rejects zero-row competition deletes instead of reporting success', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn(() => ({ select }))
    const remove = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ delete: remove })

    await expect(deleteCompetition('competition-id')).rejects.toThrow('was not deleted')
  })
})
