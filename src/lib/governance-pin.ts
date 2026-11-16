/** Keep a previously stored governance hash. A settings save never takes a client hash. */
export function keepStoredPinHash(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && (raw.startsWith('vfh1_') || raw.startsWith('vfsha256_'))) return raw
  return fallback
}

/** A hash already stored for this install. Anything else is not a PIN we may write. */
export function readStoredPinHash(raw: unknown): string | null {
  if (typeof raw === 'string' && (raw.startsWith('vfh1_') || raw.startsWith('vfsha256_'))) return raw
  return null
}

export function pinHashForSettingsSave(storedPinHash: string): string {
  return storedPinHash
}

export type GovernanceWritePlan = 'refuse' | 'payload-only' | 'change-pin'

export type PinCheckPlan = 'deny' | 'stored' | 'initial'

export function postgresGovernanceConfigured(databaseUrl: string | undefined): boolean {
  const url = (databaseUrl ?? '').trim()
  return url.startsWith('postgres://') || url.startsWith('postgresql://')
}

/**
 * A failed or unavailable database read never checks a PIN.
 * A stored hash, including one that still equals the install default, is checked.
 * The route tries `AETHER_MANAGER_PIN` before it refuses that default hash, and it does not write a new hash.
 * `initial` is only a local install that has not stored a hash yet.
 */
export function planPinCheck(input: {
  loadFailed: boolean
  postgresConfigured: boolean
  poolAvailable: boolean
  pinHash: string
  initialEmpty: boolean
}): PinCheckPlan {
  if (input.loadFailed || (input.postgresConfigured && !input.poolAvailable)) return 'deny'
  const stored = readStoredPinHash(input.pinHash)
  if (stored) return 'stored'
  if (input.postgresConfigured) return 'deny'
  if (input.initialEmpty) return 'initial'
  return 'deny'
}

/** A recovered pool must not write a PIN that was checked while the read had failed. */
export function planPinWrite(input: {
  loadFailed: boolean
  postgresConfigured: boolean
  poolAvailable: boolean
  purpose: 'settings' | 'change-pin'
}): GovernanceWritePlan {
  if (input.loadFailed || (input.postgresConfigured && !input.poolAvailable)) return 'refuse'
  if (input.purpose === 'change-pin') return 'change-pin'
  return 'payload-only'
}

/**
 * A failed database read never writes a PIN.
 * Settings and other store saves update the payload only.
 * The dedicated PIN change is the only plan that may write pin_hash, and only after the load succeeded.
 */
export function planGovernanceWrite(input: {
  loadFailed: boolean
  purpose: 'settings' | 'change-pin'
}): GovernanceWritePlan {
  if (input.loadFailed) return 'refuse'
  if (input.purpose === 'change-pin') return 'change-pin'
  return 'payload-only'
}
