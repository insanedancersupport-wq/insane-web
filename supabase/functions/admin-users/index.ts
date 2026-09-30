import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function respond(status: number, body: Record<string, string | boolean>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function parseRole(role: unknown) {
  return role === 'admin' || role === 'trainer' ? role : null
}

function parseUserId(userId: unknown) {
  return typeof userId === 'string' && uuidPattern.test(userId) ? userId : null
}

function parseFullName(fullName: unknown) {
  if (typeof fullName !== 'string') {
    return null
  }

  const normalized = fullName.trim()
  return normalized.length > 0 && normalized.length <= 200 ? normalized : null
}

function secretKey() {
  const configuredKeys = Deno.env.get('SUPABASE_SECRET_KEYS')

  if (!configuredKeys) {
    return null
  }

  try {
    const keys = JSON.parse(configuredKeys)
    return typeof keys.default === 'string' && keys.default ? keys.default : null
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed.' })
  }

  const serverSecretKey = secretKey()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const authorization = request.headers.get('Authorization')

  if (!serverSecretKey || !supabaseUrl) {
    return respond(500, { error: 'User administration is unavailable.' })
  }

  if (!authorization?.startsWith('Bearer ')) {
    return respond(401, { error: 'Authentication is required.' })
  }

  const adminClient = createClient(supabaseUrl, serverSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const accessToken = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    return respond(401, { error: 'Authentication is required.' })
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('active, role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || !callerProfile || !callerProfile.active || callerProfile.role !== 'admin') {
    return respond(403, { error: 'Administrator access is required.' })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' })
  }

  if (!payload || Array.isArray(payload)) {
    return respond(400, { error: 'Request body must be an object.' })
  }

  const action = payload.action

  if (action === 'invite') {
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const fullName = parseFullName(payload.fullName)
    const role = parseRole(payload.role)

    if (!emailPattern.test(email) || !fullName || !role) {
      return respond(400, { error: 'A valid email address, name, and role are required.' })
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    })

    if (error || !data.user) {
      return respond(400, { error: 'Unable to invite this user.' })
    }

    if (role === 'admin') {
      const { error: roleError } = await adminClient
        .from('profiles')
        .update({ role })
        .eq('id', data.user.id)

      if (roleError) {
        return respond(500, { error: 'The invitation was created, but the role could not be assigned.' })
      }
    }

    return respond(201, { success: true })
  }

  const targetUserId = parseUserId(payload.userId)
  if (!targetUserId) {
    return respond(400, { error: 'A valid user identifier is required.' })
  }

  if (targetUserId === userData.user.id) {
    return respond(400, { error: 'Administrators cannot modify their own access through this tool.' })
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', targetUserId)
    .maybeSingle()

  if (targetProfileError) {
    return respond(500, { error: 'Unable to verify the target user.' })
  }

  if (!targetProfile) {
    return respond(404, { error: 'The target user was not found.' })
  }

  if (action === 'update') {
    const fullName = payload.fullName === undefined ? undefined : parseFullName(payload.fullName)
    const role = payload.role === undefined ? undefined : parseRole(payload.role)

    if ((payload.fullName !== undefined && !fullName) || (payload.role !== undefined && !role)) {
      return respond(400, { error: 'Provide a valid name or role update.' })
    }

    if (!fullName && !role) {
      return respond(400, { error: 'Provide at least one user change.' })
    }

    if (fullName) {
      const { data: updatedProfile, error } = await adminClient
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', targetUserId)
        .select('id')
        .maybeSingle()

      if (error || !updatedProfile) {
        return respond(404, { error: 'The target user was not found.' })
      }

      const { error: metadataError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: { full_name: fullName },
      })

      if (metadataError) {
        return respond(500, { error: 'The profile was updated, but account metadata could not be synchronized.' })
      }
    }

    if (role) {
      const { data: updatedProfile, error } = await adminClient
        .from('profiles')
        .update({ role })
        .eq('id', targetUserId)
        .select('id')
        .maybeSingle()

      if (error || !updatedProfile) {
        return respond(404, { error: 'The target user was not found.' })
      }
    }

    return respond(200, { success: true })
  }

  if (action === 'set-active') {
    if (typeof payload.active !== 'boolean') {
      return respond(400, { error: 'An active status is required.' })
    }

    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ active: payload.active })
      .eq('id', targetUserId)
      .select('id')
      .maybeSingle()

    if (profileUpdateError || !updatedProfile) {
      return respond(404, { error: 'The target user was not found.' })
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: payload.active ? 'none' : '876000h',
    })

    if (authUpdateError) {
      return respond(500, { error: 'The profile was updated, but the account status could not be synchronized.' })
    }

    return respond(200, { success: true })
  }

  if (action === 'delete') {
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId)

    if (error) {
      return respond(400, { error: 'Unable to delete this user.' })
    }

    return respond(200, { success: true })
  }

  return respond(400, { error: 'Unsupported user administration action.' })
})
