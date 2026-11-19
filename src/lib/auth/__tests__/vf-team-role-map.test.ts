import { afterEach, describe, expect, it } from 'vitest'
import { resolveAccessRole } from '@/lib/auth/role-source'
import { VF_TEAM } from '@/lib/venture-foods-team'
import type { ExecRole } from '@/lib/auth/exec-role-meta'

/**
 * Expected executive role for each seeded Venture Foods title.
 * PENDING FOUNDER CONFIRMATION — keep this table aligned with VF_TEAM_ROLE_EXEC_MAP.
 */
const EXPECTED_EXEC_ROLE: Record<string, ExecRole> = {
  ahmed: 'admin',
  choukrallah: 'ops',
  abdullah: 'admin',
  mohamed: 'cfo',
  samy: 'cfo',
  munir: 'supply',
  abdulrahman: 'marketing',
  sheyam: 'admin',
}

describe('VF team role map with AETHER_ADMIN_EMAILS unset', () => {
  afterEach(() => {
    delete process.env.AETHER_ADMIN_EMAILS
  })

  it.each(VF_TEAM.flatMap((member) => member.emails.map((email) => ({ member, email }))))(
    '$member.nameEn <$email> resolves to $member.key',
    ({ member, email }) => {
      delete process.env.AETHER_ADMIN_EMAILS
      const expected = EXPECTED_EXEC_ROLE[member.key]
      expect(expected, member.key).toBeDefined()
      expect(
        resolveAccessRole({
          email,
          roleName: member.roleEn,
          isAdmin: member.isAdmin,
          adminEmails: new Set(),
        }),
      ).toBe(expected)
      expect(
        resolveAccessRole({
          email,
          roleName: member.roleAr,
          isAdmin: member.isAdmin,
          adminEmails: new Set(),
        }),
      ).toBe(expected)
    },
  )

  it('keeps Role.isAdmin as admin even when the title maps to a narrower role', () => {
    expect(
      resolveAccessRole({
        email: 'mohameda@venturefoodskw.com',
        roleName: 'Financial Manager',
        isAdmin: true,
        adminEmails: new Set(),
      }),
    ).toBe('admin')
    expect(
      resolveAccessRole({
        email: 'mohameda@venturefoodskw.com',
        roleName: 'المدير المالي',
        isAdmin: true,
        adminEmails: new Set(),
      }),
    ).toBe('admin')
  })

  it('denies an unknown title when the account is not an admin', () => {
    expect(
      resolveAccessRole({
        email: 'clerk@venturefoodskw.com',
        roleName: 'Night Cashier',
        isAdmin: false,
        adminEmails: new Set(),
      }),
    ).toBeNull()
  })
})
