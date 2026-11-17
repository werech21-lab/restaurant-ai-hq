import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { MODULES } from '@/lib/modules'
import { VF_TEAM, type VfTeamMember } from '@/lib/venture-foods-team'

const FORBIDDEN_DEFAULT_PASSWORDS = new Set([
  ['123', '456'].join(''),
  'password',
  ['1234', '5678'].join(''),
])

export function isAllowedExplicitLeadershipPassword(raw: string | undefined): raw is string {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (trimmed.length < 8) return false
  return !FORBIDDEN_DEFAULT_PASSWORDS.has(trimmed.toLowerCase())
}

function permissionsFor(member: VfTeamMember) {
  return MODULES.map((module) => {
    if (member.isAdmin) {
      return { module: module.key, canView: true, canCreate: true, canEdit: true, canDelete: true }
    }
    const writeOn = member.writeModules.includes(module.key)
    const viewOn = writeOn || (member.viewOnlyModules ?? []).includes(module.key)
    return {
      module: module.key,
      canView: viewOn,
      canCreate: writeOn,
      canEdit: writeOn,
      canDelete: writeOn,
    }
  })
}

async function ensureRole(member: VfTeamMember) {
  const existing =
    (await prisma.role.findFirst({ where: { name: member.roleEn } })) ??
    (await prisma.role.findFirst({ where: { name: member.roleAr } }))

  if (existing) {
    await prisma.role.update({
      where: { id: existing.id },
      data: {
        name: member.roleEn,
        description: member.roleDescriptionEn,
        isAdmin: member.isAdmin,
      },
    })
    await prisma.permission.deleteMany({ where: { roleId: existing.id } })
    await prisma.permission.createMany({
      data: permissionsFor(member).map((row) => ({ ...row, roleId: existing.id })),
    })
    return existing.id
  }

  const created = await prisma.role.create({
    data: {
      name: member.roleEn,
      description: member.roleDescriptionEn,
      isAdmin: member.isAdmin,
      permissions: { create: permissionsFor(member) },
    },
  })
  return created.id
}

export interface ProvisionLeadershipAccountInput {
  email: string
  name: string
  roleId: string
  password?: string
  invite?: boolean
}

export type ProvisionLeadershipAccountResult =
  | { status: 'existing'; userId: string }
  | { status: 'created'; userId: string }
  | { status: 'invited'; userId: string; inviteToken: string }

/**
 * Provisions a missing leadership account ONLY when given an explicit non-default password
 * or `invite: true`. Existing user rows are NEVER touched (no password, role, or status change).
 */
export async function provisionLeadershipAccount(
  input: ProvisionLeadershipAccountInput,
): Promise<ProvisionLeadershipAccountResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    return { status: 'existing', userId: existing.id }
  }

  if (input.password !== undefined && input.password.trim() !== '') {
    if (!isAllowedExplicitLeadershipPassword(input.password)) {
      throw new Error(
        'New leadership accounts require an explicit password (never a default password) or an invite.',
      )
    }
    const passwordHash = await bcrypt.hash(input.password.trim(), 10)
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        roleId: input.roleId,
        isActive: true,
        passwordHash,
      },
    })
    return { status: 'created', userId: created.id }
  }

  if (input.invite === true) {
    const inviteToken = randomBytes(24).toString('hex')
    const lockedInviteMarker = `!INVITE_PENDING:${inviteToken}`
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        roleId: input.roleId,
        isActive: true,
        passwordHash: lockedInviteMarker,
      },
    })
    return { status: 'invited', userId: created.id, inviteToken }
  }

  throw new Error('Explicit password or invite is required to create a new leadership account.')
}

export interface EnsureVentureFoodsTeamOptions {
  passwordsByEmail?: Record<string, string>
  inviteMissing?: boolean
}

/**
 * Provisions leadership roles and only creates missing leadership accounts when an explicit
 * password or `inviteMissing: true` is supplied. Existing accounts are left completely untouched.
 */
export async function ensureVentureFoodsTeam(options?: EnsureVentureFoodsTeamOptions) {
  const roleIds = new Map<string, string>()
  for (const member of VF_TEAM) {
    roleIds.set(member.key, await ensureRole(member))
  }

  const skippedMissingCredential: string[] = []
  for (const member of VF_TEAM) {
    const roleId = roleIds.get(member.key)!
    for (const email of member.emails) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) continue
      const explicitPassword = options?.passwordsByEmail?.[email.toLowerCase()] ?? member.password
      const name =
        email.toLowerCase() === 'admin@aetherbi.com' ? 'Ahmed Al-Ebrahim (CEO)' : member.nameEn
      if (isAllowedExplicitLeadershipPassword(explicitPassword)) {
        await provisionLeadershipAccount({ email, name, roleId, password: explicitPassword })
      } else if (options?.inviteMissing === true) {
        await provisionLeadershipAccount({ email, name, roleId, invite: true })
      } else {
        skippedMissingCredential.push(email)
      }
    }
  }

  return {
    ok: true as const,
    users: VF_TEAM.length,
    skippedMissingCredential,
  }
}

/** @deprecated Prefer ensureVentureFoodsTeam — kept for login page compatibility. */
export async function ensureOfficialAdmin() {
  return ensureVentureFoodsTeam()
}
