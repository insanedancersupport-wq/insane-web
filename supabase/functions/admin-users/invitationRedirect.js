export function invitationRedirectUrl(appUrl) {
  if (typeof appUrl !== 'string' || !appUrl.trim()) {
    throw new Error('APP_URL is required.')
  }

  let url
  try {
    url = new URL(appUrl)
  } catch {
    throw new Error('APP_URL must be a valid application origin.')
  }

  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw new Error('APP_URL must be an HTTP(S) application origin without a path, query, or fragment.')
  }

  return new URL('/set-password', url.origin).toString()
}
