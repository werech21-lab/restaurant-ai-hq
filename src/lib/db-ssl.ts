export type SslMode = 'require' | 'verify' | 'disable'

export type SslOptions = false | true | { rejectUnauthorized: boolean; ca?: string }

/**
 * TLS settings for the Postgres connection.
 * - disable: no TLS (local development only).
 * - require: encrypted, the server certificate is not checked.
 * - verify: encrypted and the certificate is checked, against `ca` (a PEM text, for example Supabase's CA) when given,
 *   otherwise against the system's trusted authorities.
 * `ca` is a public certificate, not a secret. An escaped `\n` is accepted so it fits on one environment line.
 */
export function sslOptions(mode: SslMode, ca: string | undefined): SslOptions {
  if (mode === 'disable') return false
  if (mode === 'require') return { rejectUnauthorized: false }
  const pem = ca?.replace(/\\n/g, '\n').trim()
  return pem ? { rejectUnauthorized: true, ca: pem } : true
}