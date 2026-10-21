import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTask, deleteTask, updateTask } from './tasksApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('tasksApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates tasks with profile assignees and never sends creator metadata', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'task-id' }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    supabase.from.mockReturnValue({ insert })

    await createTask({
      assigned_to: 'profile-id',
      created_by: 'spoofed-profile-id',
      description: '',
      due_date: '',
      priority: 'high',
      status: 'todo',
      title: 'Prepare studio',
    })

    expect(insert).toHaveBeenCalledWith({
      assigned_to: 'profile-id',
      description: null,
      due_date: null,
      priority: 'high',
      status: 'todo',
      title: 'Prepare studio',
    })
  })

  it('updates only explicitly allowed fields', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'task-id' }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ update })

    await updateTask({
      id: 'task-id',
      values: { created_by: 'spoofed-profile-id', status: 'done', title: 'Updated task' },
    })

    expect(update).toHaveBeenCalledWith({ status: 'done', title: 'Updated task' })
  })

  it('rejects zero-row deletes rather than reporting success', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ select })
    const deleteRows = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ delete: deleteRows })

    await expect(deleteTask('task-id')).rejects.toThrow('could not be deleted')
    expect(select).toHaveBeenCalledWith('id')
  })
})
