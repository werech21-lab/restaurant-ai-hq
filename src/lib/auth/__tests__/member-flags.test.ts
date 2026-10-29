import { describe, expect, it } from 'vitest'
import { applyPermissionFlags, flagsForRole } from '@/lib/auth/member-flags'

describe('member permission flags', () => {
  it('removes only the abilities a flag explicitly turns off', () => {
    const granted = new Set(['finance.journal.post', 'finance.invoice.approve', 'iam.member.read', 'inventory.stock.adjust'])
    applyPermissionFlags(granted, {})
    expect(granted.has('finance.journal.post')).toBe(true)
    applyPermissionFlags(granted, { can_post_journal: false, can_manage_users: false, can_manage_inventory: false })
    expect([...granted]).toEqual(['finance.invoice.approve'])
  })

  it('starts an accountant with posting and export, and a viewer with none', () => {
    expect(flagsForRole('accountant').can_post_journal).toBe(true)
    expect(flagsForRole('accountant').can_manage_users).toBe(false)
    expect(Object.values(flagsForRole('viewer')).every((flag) => flag === false)).toBe(true)
    expect(flagsForRole('owner').can_execute_ai).toBe(true)
  })
})
