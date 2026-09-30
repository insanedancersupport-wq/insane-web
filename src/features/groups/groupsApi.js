import { supabase } from '../../services/supabaseClient'

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function throwOnError(error, message) {
  if (error) {
    throw new Error(message)
  }
}

const groupFields = 'id, name, category, level, default_room_id, description, active, created_at, updated_at'

export async function listGroups() {
  const { data, error } = await client().from('groups').select(groupFields).order('name')
  throwOnError(error, 'Unable to load groups.')
  return data
}

export async function getGroup(groupId) {
  const { data, error } = await client().from('groups').select(groupFields).eq('id', groupId).single()
  throwOnError(error, 'Unable to load this group.')
  return data
}

export async function createGroup(values) {
  const { data, error } = await client().from('groups').insert(values).select('id').single()
  throwOnError(error, 'Unable to create the group. Group names must be unique.')
  return data
}

export async function updateGroup({ id, values }) {
  const { error } = await client().from('groups').update(values).eq('id', id)
  throwOnError(error, 'Unable to update the group. Group names must be unique.')
}

export async function listGroupTrainers(groupId) {
  const { data, error } = await client().from('group_trainers')
    .select('trainer_id, is_primary').eq('group_id', groupId)
  throwOnError(error, 'Unable to load group trainers.')
  return data
}

export async function reconcileGroupTrainers({ groupId, primaryTrainerId, trainerIds }) {
  const { error } = await client().rpc('reconcile_group_trainers', {
    primary_trainer_id: primaryTrainerId || null,
    selected_trainer_ids: trainerIds,
    target_group_id: groupId,
  })
  throwOnError(error, 'Unable to update trainer assignments.')
}
