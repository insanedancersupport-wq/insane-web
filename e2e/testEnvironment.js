const localHostnames = new Set(['127.0.0.1', '::1', 'localhost'])

function requiredEnvironment(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required for the mutating local E2E test.`)
  }

  return value
}

function localUrl(value, name) {
  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL for the mutating local E2E test.`)
  }

  if (!localHostnames.has(url.hostname)) {
    throw new Error(`${name} must point to a local isolated service; hosted Supabase URLs are not allowed.`)
  }

  return url
}

export function requireSafeMutationEnvironment() {
  if (process.env.E2E_ALLOW_MUTATIONS !== 'true') {
    throw new Error(
      'Mutating E2E tests are opt-in. Set E2E_ALLOW_MUTATIONS=true only with a local isolated Supabase stack.',
    )
  }

  const supabaseUrl = localUrl(requiredEnvironment('E2E_SUPABASE_URL'), 'E2E_SUPABASE_URL')
  localUrl(process.env.E2E_APP_URL ?? 'http://127.0.0.1:4173', 'E2E_APP_URL')
  requiredEnvironment('E2E_SUPABASE_PUBLISHABLE_KEY')
  requiredEnvironment('E2E_SUPABASE_SERVICE_ROLE_KEY')

  return { supabaseUrl }
}
