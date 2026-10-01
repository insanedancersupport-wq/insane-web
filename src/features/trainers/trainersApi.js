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

function requireTrainerId(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('A valid trainer ID is required to update a trainer.')
  }
}

const trainerFields = 'id, profile_id, first_name, last_name, phone, email, notes, active, created_at, updated_at'

export async function listTrainers() {
  const { data, error } = await client().from('trainers').select(trainerFields)
    .order('last_name').order('first_name')
  throwOnError(error, 'Unable to load trainers.')
  return data
}

export async function getTrainer(trainerId) {
  const { data, error } = await client().from('trainers').select(trainerFields).eq('id', trainerId).single()
  throwOnError(error, 'Unable to load this trainer.')
  return data
}

export async function listAvailableProfiles() {
  const { data, error } = await client().from('profiles').select('id, full_name, role, active')
    .order('full_name')
  throwOnError(error, 'Unable to load trainer profiles.')
  return data
}

export async function createTrainer(values) {
  const { data, error } = await client().from('trainers').insert(values).select('id').single()
  throwOnError(error, 'Unable to create the trainer.')
  return data
}

export async function updateTrainer({ id, values }) {
  requireTrainerId(id)
  const { error } = await client().from('trainers').update(values).eq('id', id)
  throwOnError(error, 'Unable to update the trainer.')
}
