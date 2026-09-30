import { supabase } from '../../services/supabaseClient'

function configuredClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

export async function listUsers() {
  const { data, error } = await configuredClient()
    .from('profiles')
    .select('id, full_name, role, active')
    .order('full_name')

  if (error) {
    throw new Error('Unable to load application users.')
  }

  return data
}

export async function manageUser(payload) {
  const { error } = await configuredClient().functions.invoke('admin-users', {
    body: payload,
  })

  if (error) {
    throw new Error('Unable to complete the user administration request.')
  }
}
