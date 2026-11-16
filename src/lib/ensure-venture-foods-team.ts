import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { MODULES } from '@/lib/modules'
import {
  AETHER_ADMIN_PASSWORD,
  VF_TEAM,
  type VfTeamMember,
} from '@/lib/venture-foods-team'

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

async function upsertUser(email: string, name: string, roleId: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing.id
  const passwordHash = await bcrypt.hash(password, 10)
  const created = await prisma.user.create({
    data: { name, email, roleId, isActive: true, passwordHash },
  })
  return created.id
}

/**
 * Provisions a missing leadership account.
 * An existing user is left untouched: no password hash, no rename, no deactivation.
 * Not called from page renders.
 */
export async function ensureVentureFoodsTeam() {
  const roleIds = new Map<string, string>()
  for (const member of VF_TEAM) {
    roleIds.set(member.key, await ensureRole(member))
  }

  for (const member of VF_TEAM) {
    const roleId = roleIds.get(member.key)!
    for (const email of member.emails) {
      const password =
        email.toLowerCase() === 'admin@aetherbi.com'
          ? AETHER_ADMIN_PASSWORD
          : member.password || '123456'
      const name =
        email.toLowerCase() === 'admin@aetherbi.com' ? 'Ahmed Al-Ebrahim (CEO)' : member.nameEn
      await upsertUser(email, name, roleId, password)
    }
  }

  return { ok: true as const, users: VF_TEAM.length }
}

/** @deprecated Prefer ensureVentureFoodsTeam — kept for login page compatibility. */
export async function ensureOfficialAdmin() {
  return ensureVentureFoodsTeam()
}
