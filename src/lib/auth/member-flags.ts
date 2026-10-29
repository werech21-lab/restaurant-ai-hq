/** Member flags sit on top of the role. A flag that is exactly false removes that ability. A missing flag does not. */

export const flagKeys = [
  'can_approve_po',
  'can_post_journal',
  'can_manage_users',
  'can_execute_ai',
  'can_export_reports',
  'can_approve_invoice',
  'can_manage_inventory',
] as const

export type FlagKey = (typeof flagKeys)[number]
export type PermissionFlags = Record<FlagKey, boolean>

const off = (flags: Record<string, unknown>, key: FlagKey): boolean => flags[key] === false

export function applyPermissionFlags(granted: Set<string>, flags: Record<string, unknown> | null): void {
  const source = flags ?? {}
  if (off(source, 'can_post_journal')) granted.delete('finance.journal.post')
  if (off(source, 'can_approve_po')) {
    granted.delete('procurement.order.approve')
    granted.delete('procurement.request.approve')
  }
  if (off(source, 'can_approve_invoice')) granted.delete('finance.invoice.approve')
  if (off(source, 'can_execute_ai')) granted.delete('ai.action.approve')
  if (off(source, 'can_manage_users')) {
    for (const permission of [...granted]) if (permission.startsWith('iam.')) granted.delete(permission)
  }
  if (off(source, 'can_manage_inventory')) {
    for (const permission of [
      'inventory.stock.adjust',
      'inventory.item.create',
      'inventory.item.update',
      'inventory.warehouse.create',
      'inventory.warehouse.update',
    ]) granted.delete(permission)
  }
}

function blank(): PermissionFlags {
  return {
    can_approve_po: false,
    can_post_journal: false,
    can_manage_users: false,
    can_execute_ai: false,
    can_export_reports: false,
    can_approve_invoice: false,
    can_manage_inventory: false,
  }
}

/** The flags a newly assigned role starts with. The caller can still change each one. */
export function flagsForRole(role: string): PermissionFlags {
  if (role === 'owner' || role === 'admin') {
    return {
      can_approve_po: true,
      can_post_journal: true,
      can_manage_users: true,
      can_execute_ai: true,
      can_export_reports: true,
      can_approve_invoice: true,
      can_manage_inventory: true,
    }
  }
  const flags = blank()
  if (role === 'accountant') {
    flags.can_post_journal = true
    flags.can_export_reports = true
  } else if (role === 'manager') {
    flags.can_approve_po = true
    flags.can_approve_invoice = true
    flags.can_manage_inventory = true
    flags.can_export_reports = true
  } else if (role === 'operations') {
    flags.can_manage_inventory = true
  } else if (role === 'approver') {
    flags.can_approve_invoice = true
    flags.can_execute_ai = true
  }
  return flags
}
