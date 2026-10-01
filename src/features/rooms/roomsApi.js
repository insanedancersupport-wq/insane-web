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

function requireRoomId(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('A valid room ID is required to update a room.')
  }
}

const roomFields = 'id, name, description, active, created_at, updated_at'

export async function listRooms() {
  const { data, error } = await client().from('rooms').select(roomFields).order('name')
  throwOnError(error, 'Unable to load rooms.')
  return data
}

export async function createRoom(values) {
  const { data, error } = await client().from('rooms').insert(values).select('id').single()
  throwOnError(error, 'Unable to create the room. Room names must be unique.')
  return data
}

export async function updateRoom({ id, values }) {
  requireRoomId(id)
  const { error } = await client().from('rooms').update(values).eq('id', id)
  throwOnError(error, 'Unable to update the room. Room names must be unique.')
}
