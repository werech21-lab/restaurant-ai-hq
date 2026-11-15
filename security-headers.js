// HTTP security headers for every response. Kept in plain CommonJS so next.config.js can load it and Vitest can verify it.
//
// Production script-src strictly forbids 'unsafe-inline' and 'unsafe-eval', relying on a per-request cryptographic nonce
// generated in src/middleware.ts and forwarded to Next.js Server Components via x-nonce + Content-Security-Policy request headers.

const PERMISSIONS_POLICY_VALUE = 'camera=(self), microphone=(self), geolocation=()'
const HSTS_VALUE = 'max-age=31536000; includeSubDomains'

function originOf(value) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function sanitizeNonce(nonce) {
  if (typeof nonce !== 'string') return ''
  const trimmed = nonce.trim()
  return /^[A-Za-z0-9+/=_-]{8,128}$/.test(trimmed) ? trimmed : ''
}

function buildContentSecurityPolicy({ supabaseUrl, isProduction, nonce } = {}) {
  const supabase = originOf(supabaseUrl)
  const cleanNonce = sanitizeNonce(nonce)
  const connect = [
    "'self'",
    'https://generativelanguage.googleapis.com',
    'https://*.googleapis.com',
    'https://api.x.ai',
    'https://*.x.ai',
    'https://api.openai.com',
    'https://translate.google.com',
    'https://*.openai.com',
  ]
  if (supabase) {
    connect.push(supabase)
    connect.push(supabase.replace(/^http/, 'ws'))
  }
  const scriptSrc = isProduction
    ? cleanNonce
      ? ["'self'", `'nonce-${cleanNonce}'`]
      : ["'self'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]

  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'media-src': ["'self'", 'blob:', 'data:', 'https://api.openai.com', 'https://translate.google.com'],
    'connect-src': connect,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
  if (isProduction) parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}

function buildSecurityHeaders({ supabaseUrl, isProduction, nonce, omitCsp } = {}) {
  const headers = []
  if (!omitCsp) {
    headers.push({
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({ supabaseUrl, isProduction, nonce }),
    })
  }
  headers.push(
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY_VALUE },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  )
  if (isProduction) {
    headers.push({ key: 'Strict-Transport-Security', value: HSTS_VALUE })
  }
  return headers
}

module.exports = {
  PERMISSIONS_POLICY_VALUE,
  HSTS_VALUE,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
}
