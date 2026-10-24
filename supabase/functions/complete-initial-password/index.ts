import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function respond(status: number, body: Record<string, string | boolean>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function secretKey() {
  const configuredKeys = Deno.env.get('SUPABASE_SECRET_KEYS')

  if (configuredKeys) {
    try {
      const keys = JSON.parse(configuredKeys)
      if (typeof keys.default === 'string' && keys.default) {
        return keys.default
      }
    } catch {
      return null
    }
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null
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
    return respond(500, { error: 'Password setup is unavailable.' })
  }

  if (!authorization?.startsWith('Bearer ')) {
    return respond(401, { error: 'Authentication is required.' })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' })
  }

  const password = typeof payload.password === 'string' ? payload.password : ''
  if (password.length < 8) {
    return respond(400, { error: 'Password must be at least 8 characters long.' })
  }

  const adminClient = createClient(supabaseUrl, serverSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const accessToken = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    return respond(401, { error: 'Authentication is required.' })
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('active, onboarding_completed_at')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return respond(403, { error: 'Account setup is unavailable.' })
  }

  if (!profile.active) {
    return respond(403, { error: 'This account is inactive.' })
  }

  if (profile.onboarding_completed_at) {
    return respond(409, { error: 'Initial password setup is already complete.' })
  }

  const { data: targetUserData, error: targetUserError } = await adminClient.auth.admin.getUserById(userData.user.id)
  if (targetUserError || !targetUserData.user) {
    return respond(500, { error: 'Password setup is unavailable.' })
  }

  const { error: passwordUpdateError } = await adminClient.auth.admin.updateUserById(userData.user.id, { password })

  if (passwordUpdateError) {
    return respond(400, { error: 'Unable to set your password. Please try again.' })
  }

  const { error: markerUpdateError } = await adminClient.auth.admin.updateUserById(userData.user.id, {
    app_metadata: {
      ...targetUserData.user.app_metadata,
      initial_password_setup_nonce: crypto.randomUUID(),
    },
  })

  if (markerUpdateError) {
    return respond(500, { error: 'Your password was updated, but account setup could not be completed. Please try again.' })
  }

  return respond(200, { success: true })
})
