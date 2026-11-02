import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { MODULES } from '@/lib/modules'
import {
  AETHER_ADMIN_PASSWORD,
  VF_TEAM,
  isLegacyDemoEmail,
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
  const passwordHash = await bcrypt.hash(password, 10)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, roleId, isActive: true, passwordHash },
    })
    return existing.id
  }
  const created = await prisma.user.create({
    data: { name, email, roleId, isActive: true, passwordHash },
  })
  return created.id
}

/**
 * Idempotent: replaces legacy Arabic demo accounts with the real Venture Foods leadership team.
 * Safe to call on /login and /users — never wipes unrelated custom users.
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

  // Retire classic Arabic demo emails if they still linger.
  const legacy = await prisma.user.findMany({
    where: { email: { in: ['accountant@erp.com', 'store@erp.com', 'sales@erp.com'] } },
  })
  for (const user of legacy) {
    if (!isLegacyDemoEmail(user.email)) continue
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, name: `[retired] ${user.name}` },
    })
  }

  // Rename any leftover Arabic placeholder names still pointing at active users.
  const arabicPlaceholders = ['أحمد المدير', 'سارة المحاسبة', 'خالد أمين المخزن', 'ليلى المبيعات']
  const leftovers = await prisma.user.findMany({
    where: { name: { in: arabicPlaceholders }, isActive: true },
  })
  for (const user of leftovers) {
    // Prefer mapping by known legacy emails; otherwise deactivate.
    if (user.email.toLowerCase() === 'admin@erp.com') {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: 'Ahmed Al-Ebrahim (CEO)' },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false, name: `[retired] ${user.name}` },
      })
    }
  }

  return { ok: true as const, users: VF_TEAM.length }
}

/** @deprecated Prefer ensureVentureFoodsTeam — kept for login page compatibility. */
export async function ensureOfficialAdmin() {
  return ensureVentureFoodsTeam()
}
