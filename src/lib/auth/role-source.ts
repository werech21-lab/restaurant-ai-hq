import {
  normalizeExecSessionRole,
  type ExecRole,
} from '@/lib/auth/exec-role-meta'
import { inferExecRoleFromEmail } from '@/lib/auth/exec-session'

/** Query flag for a signed-in identity that is not on the allowlist or role table. */
export const NO_ACCESS_REASON = 'no_access'

/**
 * PENDING FOUNDER CONFIRMATION.
 * One place to edit how Venture Foods team titles become executive roles.
 * Keys are the English and Arabic role names stored for VF_TEAM. Unknown titles are not listed and stay denied.
 */
export const VF_TEAM_ROLE_EXEC_MAP: Readonly<Record<string, ExecRole>> = {
  'HR & Admin Manager': 'admin',
  'مدير الموارد البشرية والإدارية': 'admin',
  'Executive Secretary': 'admin',
  'السكرتير التنفيذي': 'admin',
  'Financial Manager': 'cfo',
  'المدير المالي': 'cfo',
  'Senior Accountant': 'cfo',
  'محاسب أول': 'cfo',
  'Warehouse Manager': 'supply',
  'مدير المستودع': 'supply',
  'Marketing Coordinator': 'marketing',
  'منسق التسويق': 'marketing',
  'Operations Manager': 'ops',
  'مدير العمليات': 'ops',
}

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at <= 0) return '***'
  return `${trimmed.slice(0, 1)}***@${trimmed.slice(at + 1)}`
}

function execRoleFromVfTeamTitle(roleName: string | null | undefined): ExecRole | null {
  const raw = String(roleName ?? '').trim()
  if (!raw) return null
  const direct = VF_TEAM_ROLE_EXEC_MAP[raw]
  if (direct) return direct
  const folded = raw.toLowerCase()
  for (const [title, role] of Object.entries(VF_TEAM_ROLE_EXEC_MAP)) {
    if (title.toLowerCase() === folded) return role
  }
  return null
}

/**
 * Extra admin emails. Unset or empty means nobody extra is an admin.
 * Named executive accounts in exec-session stay the code allowlist.
 * Prisma `Role` (`isAdmin` or a name that is an exec role) is the role table.
 */
export function parseAdminEmailAllowlist(raw: string | undefined | null): ReadonlySet<string> {
  if (!raw) return new Set()
  const out = new Set<string>()
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase()
    if (!email.includes('@') || email.length > 160) continue
    out.add(email)
  }
  return out
}

export function adminEmailsFromEnv(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  return parseAdminEmailAllowlist(env.AETHER_ADMIN_EMAILS)
}

/**
 * Resolves an executive role from the role table, then the named-account
 * allowlist, then AETHER_ADMIN_EMAILS. Unknown identities get null (deny).
 * A mapped role name wins so an allowlist entry cannot upgrade an auditor.
 */
export function resolveAccessRole(input: {
  email?: string | null
  roleName?: string | null
  isAdmin?: boolean | null
  adminEmails?: ReadonlySet<string>
}): ExecRole | null {
  const fromRoleName = normalizeExecSessionRole(input.roleName)
  if (fromRoleName) return fromRoleName
  const fromTeamTitle = execRoleFromVfTeamTitle(input.roleName)
  if (fromTeamTitle) return fromTeamTitle
  if (input.isAdmin === true) return 'admin'

  const email = String(input.email ?? '').trim().toLowerCase()
  if (!email) return null

  const named = inferExecRoleFromEmail(email)
  if (named) return named

  const adminEmails = input.adminEmails ?? adminEmailsFromEnv()
  if (adminEmails.has(email)) return 'admin'
  return null
}
