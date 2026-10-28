import { describe, expect, it } from 'vitest'
import {
  TOKEN_PATTERN,
  checkGrant,
  effectiveInvitationStatus,
  invitationExpiry,
  isAdministrativeRole,
  mayManageCurrentRole,
  normalizeEmail,
  permissionsBeyond,
} from '@/lib/iam/domain'
import { createInvitationSchema, createRoleSchema, acceptInvitationSchema } from '@/lib/iam/schemas'
import { generateInvitationToken, hashInvitationToken } from '@/lib/iam/tokens'

const set = (...values: string[]) => new Set(values)

describe('administrative roles', () => {
  it('are the ones holding any iam.* permission', () => {
    expect(isAdministrativeRole({ permissions: ['finance.invoice.read', 'iam.member.read'] })).toBe(true)
    expect(isAdministrativeRole({ permissions: ['finance.invoice.read'] })).toBe(false)
    expect(isAdministrativeRole({ permissions: [] })).toBe(false)
  })
})

describe('checkGrant', () => {
  it('allows a role inside the actor\'s own permissions', () => {
    expect(checkGrant(set('a', 'b'), { permissions: ['a'] })).toEqual({ ok: true })
    expect(checkGrant(set('a'), { permissions: [] })).toEqual({ ok: true })
  })

  it('refuses a role with anything the actor does not hold, and names it', () => {
    expect(checkGrant(set('a'), { permissions: ['a', 'b', 'c'] })).toEqual({ ok: false, code: 'grant_exceeds_permissions', missing: ['b', 'c'] })
  })

  it('refuses an administrative role without iam.role.manage even when every permission is held', () => {
    const actor = set('iam.member.invite', 'iam.member.read')
    expect(checkGrant(actor, { permissions: ['iam.member.read'] })).toEqual({ ok: false, code: 'admin_role_requires_role_manage', missing: [] })
  })

  it('allows an administrative role to someone with iam.role.manage who holds all of it', () => {
    const actor = set('iam.role.manage', 'iam.member.read')
    expect(checkGrant(actor, { permissions: ['iam.member.read'] })).toEqual({ ok: true })
  })

  it('never lets an empty actor grant anything but an empty role', () => {
    expect(checkGrant(set(), { permissions: ['a'] }).ok).toBe(false)
    expect(checkGrant(set(), { permissions: [] }).ok).toBe(true)
  })
})

describe('permissionsBeyond and mayManageCurrentRole', () => {
  it('lists the difference in the role\'s order', () => {
    expect(permissionsBeyond(set('a'), { permissions: ['c', 'a', 'b'] })).toEqual(['c', 'b'])
  })

  it('lets only role managers touch members who hold an administrative role', () => {
    expect(mayManageCurrentRole(set('iam.member.update'), { permissions: ['iam.member.read'] })).toBe(false)
    expect(mayManageCurrentRole(set('iam.role.manage'), { permissions: ['iam.member.read'] })).toBe(true)
    expect(mayManageCurrentRole(set('iam.member.update'), { permissions: ['finance.invoice.read'] })).toBe(true)
  })
})

describe('invitation status and expiry', () => {
  const now = new Date('2026-01-10T00:00:00Z')

  it('reads a pending invitation as expired exactly at its expiry, and leaves final statuses alone', () => {
    expect(effectiveInvitationStatus('pending', new Date('2026-01-10T00:00:01Z'), now)).toBe('pending')
    expect(effectiveInvitationStatus('pending', new Date('2026-01-10T00:00:00Z'), now)).toBe('expired')
    expect(effectiveInvitationStatus('accepted', new Date('2025-01-01T00:00:00Z'), now)).toBe('accepted')
    expect(effectiveInvitationStatus('revoked', new Date('2025-01-01T00:00:00Z'), now)).toBe('revoked')
  })

  it('adds whole days', () => {
    expect(invitationExpiry(now, 7).toISOString()).toBe('2026-01-17T00:00:00.000Z')
  })

  it('normalizes emails', () => {
    expect(normalizeEmail('  Ali@Example.COM ')).toBe('ali@example.com')
  })
})

describe('tokens', () => {
  it('are 256 random bits in the shape the accept route expects, and differ every time', () => {
    const first = generateInvitationToken()
    expect(first).toMatch(TOKEN_PATTERN)
    expect(generateInvitationToken()).not.toBe(first)
  })

  it('hash to a stable 64-character hex digest that does not contain the token', () => {
    const token = generateInvitationToken()
    const hash = hashInvitationToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashInvitationToken(token))
    expect(hash).not.toContain(token)
  })
})

describe('input schemas', () => {
  const roleId = '11111111-1111-4111-8111-111111111111'

  it('require an explicit role: an invitation has no default', () => {
    expect(createInvitationSchema.safeParse({ email: 'a@b.co' }).success).toBe(false)
    expect(createInvitationSchema.safeParse({ email: 'a@b.co', roleId }).success).toBe(true)
  })

  it('normalize the email and bound the lifetime', () => {
    expect(createInvitationSchema.parse({ email: ' A@B.co ', roleId }).email).toBe('a@b.co')
    expect(createInvitationSchema.safeParse({ email: 'a@b.co', roleId, expiresInDays: 0 }).success).toBe(false)
    expect(createInvitationSchema.safeParse({ email: 'a@b.co', roleId, expiresInDays: 31 }).success).toBe(false)
    expect(createInvitationSchema.safeParse({ email: 'not-an-email', roleId }).success).toBe(false)
  })

  it('reject a token that is not the generated shape', () => {
    expect(acceptInvitationSchema.safeParse({ token: 'short' }).success).toBe(false)
    expect(acceptInvitationSchema.safeParse({ token: generateInvitationToken() }).success).toBe(true)
  })

  it('reject unknown permissions in a role and dedupe and sort the rest', () => {
    expect(createRoleSchema.safeParse({ name: 'x', permissions: ['made.up.permission'] }).success).toBe(false)
    expect(createRoleSchema.parse({ name: 'x', permissions: ['finance.invoice.read', 'crm.customer.read', 'finance.invoice.read'] }).permissions).toEqual([
      'crm.customer.read',
      'finance.invoice.read',
    ])
  })
})
