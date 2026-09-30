import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reconcileGroupTrainers } from './groupsApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('reconcileGroupTrainers', () => {
  beforeEach(() => {
    supabase.rpc.mockResolvedValue({ error: null })
  })

  it('uses the atomic reconciliation RPC with the selected trainers and primary trainer', async () => {
    await reconcileGroupTrainers({
      groupId: 'group-id',
      primaryTrainerId: 'trainer-a',
      trainerIds: ['trainer-a', 'trainer-b'],
    })

    expect(supabase.rpc).toHaveBeenCalledWith('reconcile_group_trainers', {
      primary_trainer_id: 'trainer-a',
      selected_trainer_ids: ['trainer-a', 'trainer-b'],
      target_group_id: 'group-id',
    })
  })
})
