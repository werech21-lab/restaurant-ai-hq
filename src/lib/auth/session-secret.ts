import { logger } from '@/lib/logger'

/**
 * Production refuses the built-in fallback key. Set one of
 * AETHER_SESSION_SECRET, SESSION_SECRET, or AUTH_SECRET (16+ characters).
 * Verification returns null and signing throws; public pages must catch this
 * and keep rendering the login screen.
 */
export class SessionSecretMissingError extends Error {
  readonly code = 'session_secret_missing'

  constructor() {
    super('session_secret_missing')
    this.name = 'SessionSecretMissingError'
  }
}

export class ExecRoleDeniedError extends Error {
  readonly code = 'exec_role_denied'

  constructor() {
    super('exec_role_denied')
    this.name = 'ExecRoleDeniedError'
  }
}

let missingSecretLogged = false

export function resetSessionSecretLogForTests(): void {
  missingSecretLogged = false
}

export function configuredSessionSecret(): string | null {
  const fromEnv =
    process.env.AETHER_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    ''
  return fromEnv.length >= 16 ? fromEnv : null
}

function noteMissingSessionSecret(): void {
  if (missingSecretLogged) return
  missingSecretLogged = true
  logger.error('session_secret_missing', {
    message:
      'Refusing to sign or verify sessions because NODE_ENV=production and AETHER_SESSION_SECRET, SESSION_SECRET, and AUTH_SECRET are unset or shorter than 16 characters. The built-in fallback key is disabled.',
  })
}

/** Env secret, or the dev/test fallback. Production without a real secret throws. */
export function resolveSessionSecret(fallback: string): string {
  const configured = configuredSessionSecret()
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') {
    noteMissingSessionSecret()
    throw new SessionSecretMissingError()
  }
  return fallback
}
