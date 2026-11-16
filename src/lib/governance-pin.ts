/** Keep a previously stored governance hash. A settings save never takes a client hash. */
export function keepStoredPinHash(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && (raw.startsWith('vfh1_') || raw.startsWith('vfsha256_'))) return raw
  return fallback
}

export function pinHashForSettingsSave(storedPinHash: string): string {
  return storedPinHash
}
