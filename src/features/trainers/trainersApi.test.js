import { describe, expect, it, vi } from 'vitest'

import { updateTrainer } from './trainersApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('updateTrainer', () => {
  it('rejects a missing trainer id before issuing an update request', async () => {
    await expect(updateTrainer({
      id: undefined,
      values: { first_name: 'Maya' },
    })).rejects.toThrow('A valid trainer ID is required')

    expect(supabase.from).not.toHaveBeenCalled()
  })
})
