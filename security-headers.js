// HTTP security headers for every response. Kept in plain CommonJS so next.config.js can load it and a test can read it.
//
// The CSP allows inline scripts and styles because Next.js emits inline bootstrap scripts and Tailwind/React set inline
// styles; a nonce-based policy needs per-request middleware and is a separate piece of work. Everything else is closed:
// no plugins, no framing, no foreign form targets, and network calls only to this origin and the configured Supabase project.

function originOf(value) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function buildContentSecurityPolicy({ supabaseUrl, isProduction }) {
  const supabase = originOf(supabaseUrl)
  const connect = ["'self'"]
  if (supabase) {
    connect.push(supabase)
    connect.push(supabase.replace(/^http/, 'ws'))
  }
  const directives = {
    'default-src': ["'self'"],
    'script-src': isProduction ? ["'self'", "'unsafe-inline'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
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

function buildSecurityHeaders({ supabaseUrl, isProduction }) {
  const headers = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy({ supabaseUrl, isProduction }) },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ]
  // HSTS only where the site is served over HTTPS. No includeSubDomains or preload: those cannot be undone quickly.
  if (isProduction) headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' })
  return headers
}

module.exports = { buildContentSecurityPolicy, buildSecurityHeaders }
