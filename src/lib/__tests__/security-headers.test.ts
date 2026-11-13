import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type Header = { key: string; value: string }
type Builders = {
  buildContentSecurityPolicy: (options: { supabaseUrl: string | undefined; isProduction: boolean }) => string
  buildSecurityHeaders: (options: { supabaseUrl: string | undefined; isProduction: boolean }) => Header[]
}

const APPROVED_AI_CONNECT_ORIGINS = [
  'https://generativelanguage.googleapis.com',
  'https://*.googleapis.com',
  'https://api.x.ai',
  'https://*.x.ai',
  'https://api.openai.com',
  'https://translate.google.com',
  'https://*.openai.com',
]

function load(): Builders {
  const require = createRequire(path.join(process.cwd(), 'package.json'))
  const loaded: unknown = require('./security-headers.js')
  if (typeof loaded !== 'object' || loaded === null) throw new Error('security-headers.js did not export an object')
  const candidate = loaded as Partial<Builders>
  if (typeof candidate.buildContentSecurityPolicy !== 'function' || typeof candidate.buildSecurityHeaders !== 'function') {
    throw new Error('security-headers.js is missing its builders')
  }
  return candidate as Builders
}

const { buildContentSecurityPolicy, buildSecurityHeaders } = load()
const SUPABASE = 'https://abcdefgh.supabase.co'

function directive(policy: string, name: string): string[] {
  const found = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `))
  return found ? found.slice(name.length + 1).split(' ') : []
}

describe('content security policy', () => {
  const production = buildContentSecurityPolicy({ supabaseUrl: SUPABASE, isProduction: true })

  it('forbids framing, plugins and foreign base or form targets', () => {
    expect(directive(production, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(production, 'object-src')).toEqual(["'none'"])
    expect(directive(production, 'base-uri')).toEqual(["'self'"])
    expect(directive(production, 'form-action')).toEqual(["'self'"])
    expect(directive(production, 'default-src')).toEqual(["'self'"])
  })

  it('lets the browser call only this origin, approved AI HTTPS endpoints and the configured Supabase project', () => {
    expect(directive(production, 'connect-src')).toEqual([
      "'self'",
      ...APPROVED_AI_CONNECT_ORIGINS,
      SUPABASE,
      'wss://abcdefgh.supabase.co',
    ])
    expect(directive(production, 'connect-src')).not.toContain('*')
  })

  it('allows no wildcard source anywhere and no eval in production', () => {
    expect(production).not.toMatch(/(^|[ ;])\*([ ;]|$)/)
    expect(directive(production, 'media-src')).not.toContain('*')
    expect(directive(production, 'script-src')).not.toContain("'unsafe-eval'")
    expect(production).toContain('upgrade-insecure-requests')
  })

  it('allows eval only outside production, for the development server', () => {
    const development = buildContentSecurityPolicy({ supabaseUrl: SUPABASE, isProduction: false })
    expect(directive(development, 'script-src')).toContain("'unsafe-eval'")
    expect(development).not.toContain('upgrade-insecure-requests')
  })

  it('omits Supabase origins when Supabase is not configured or the URL is malformed', () => {
    for (const supabaseUrl of [undefined, '', 'not a url']) {
      expect(directive(buildContentSecurityPolicy({ supabaseUrl, isProduction: true }), 'connect-src')).toEqual([
        "'self'",
        ...APPROVED_AI_CONNECT_ORIGINS,
      ])
    }
  })

  it('does not let a crafted Supabase URL inject another directive', () => {
    const policy = buildContentSecurityPolicy({ supabaseUrl: 'https://abcdefgh.supabase.co; script-src *', isProduction: true })
    expect(directive(policy, 'script-src')).not.toContain('*')
    expect(directive(policy, 'connect-src').join(' ')).not.toContain(';')
  })
})

describe('security headers', () => {
  const production = new Map(buildSecurityHeaders({ supabaseUrl: SUPABASE, isProduction: true }).map((header) => [header.key, header.value]))

  it('sets the standard protections and scopes camera and microphone strictly to self', () => {
    expect(production.get('X-Frame-Options')).toBe('DENY')
    expect(production.get('X-Content-Type-Options')).toBe('nosniff')
    expect(production.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(production.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(production.get('Permissions-Policy')).toBe(
      'camera=(self), microphone=(self), geolocation=(), browsing-topics=()',
    )
    expect(production.get('Content-Security-Policy')).toBeTruthy()
  })

  it('sends HSTS in production without includeSubDomains or preload, and not in development', () => {
    expect(production.get('Strict-Transport-Security')).toBe('max-age=31536000')
    const development = buildSecurityHeaders({ supabaseUrl: SUPABASE, isProduction: false })
    expect(development.some((header) => header.key === 'Strict-Transport-Security')).toBe(false)
  })
})
