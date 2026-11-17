import { afterEach, describe, expect, it } from 'vitest'
import {
  authenticateExecutiveCredentials,
  isRotatedPasswordEnforcementOn,
} from '@/lib/auth/exec-session'

// Phase 5 · Item 10 — once passwords are rotated, AETHER_ENFORCE_ROTATED_PASSWORDS=true revokes the
// built-in default executive passwords so only the env-var password can log in.
const KEYS = ['AETHER_ENFORCE_ROTATED_PASSWORDS', 'AETHER_OPS_PASSWORD'] as const
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('rotated executive password enforcement', () => {
  it('is off unless explicitly set to "true"', () => {
    delete process.env.AETHER_ENFORCE_ROTATED_PASSWORDS
    expect(isRotatedPasswordEnforcementOn()).toBe(false)
    process.env.AETHER_ENFORCE_ROTATED_PASSWORDS = 'yes'
    expect(isRotatedPasswordEnforcementOn()).toBe(false)
    process.env.AETHER_ENFORCE_ROTATED_PASSWORDS = ' TRUE '
    expect(isRotatedPasswordEnforcementOn()).toBe(true)
  })

  it('accepts the rotated env-var password while enforcement is on', async () => {
    process.env.AETHER_ENFORCE_ROTATED_PASSWORDS = 'true'
    process.env.AETHER_OPS_PASSWORD = 'rotated-ops-pass-for-test'
    const ok = await authenticateExecutiveCredentials('operations@venturefoodskw.com', 'rotated-ops-pass-for-test')
    expect(ok.valid).toBe(true)
    const wrong = await authenticateExecutiveCredentials('operations@venturefoodskw.com', 'not-the-password')
    expect(wrong.valid).toBe(false)
  })

  it('fails closed for an account with no rotated password while enforcement is on', async () => {
    process.env.AETHER_ENFORCE_ROTATED_PASSWORDS = 'true'
    delete process.env.AETHER_OPS_PASSWORD
    const res = await authenticateExecutiveCredentials('operations@venturefoodskw.com', 'anything-at-all')
    expect(res.valid).toBe(false)
  })
})
