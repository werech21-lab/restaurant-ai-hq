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
