/**
 * Sync Venture Foods leadership into the bundled SQLite DB (prisma/dev.db).
 * Run: npx tsx scripts/sync-vf-users.ts
 */
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { MODULES } from '../src/lib/modules'
import {
  AETHER_ADMIN_PASSWORD,
  VF_TEAM,
  isLegacyDemoEmail,
  type VfTeamMember,
} from '../src/lib/venture-foods-team'

const sqliteUrl = `file:${path.join(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/')}`
const prisma = new PrismaClient({ datasources: { db: { url: sqliteUrl } } })

function permissionsFor(member: VfTeamMember) {
  return MODULES.map((module) => {
    if (member.isAdmin) {
      return { module: module.key, canView: true, canCreate: true, canEdit: true, canDelete: true }
    }
    const writeOn = member.writeModules.includes(module.key)
    const viewOn = writeOn || (member.viewOnlyModules ?? []).includes(module.key)
    return { module: module.key, canView: viewOn, canCreate: writeOn, canEdit: writeOn, canDelete: writeOn }
  })
}

async function ensureRole(member: VfTeamMember) {
  const existing =
    (await prisma.role.findFirst({ where: { name: member.roleEn } })) ??
    (await prisma.role.findFirst({ where: { name: member.roleAr } }))
  if (existing) {
    await prisma.role.update({
      where: { id: existing.id },
      data: { name: member.roleEn, description: member.roleDescriptionEn, isAdmin: member.isAdmin },
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
    return
  }
  await prisma.user.create({
    data: { name, email, roleId, isActive: true, passwordHash },
  })
}

async function main() {
  for (const member of VF_TEAM) {
    const roleId = await ensureRole(member)
    for (const email of member.emails) {
      const password =
        email.toLowerCase() === 'admin@aetherbi.com' ? AETHER_ADMIN_PASSWORD : member.password || '123456'
      await upsertUser(email, member.nameEn, roleId, password)
      console.log('upsert', email, '→', member.nameEn, '/', member.roleEn)
    }
  }

  const legacy = await prisma.user.findMany({
    where: { email: { in: ['accountant@erp.com', 'store@erp.com', 'sales@erp.com'] } },
  })
  for (const user of legacy) {
    if (!isLegacyDemoEmail(user.email)) continue
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, name: `[retired] ${user.name}` },
    })
    console.log('retired', user.email)
  }

  const arabicRoles = ['مدير النظام', 'محاسب', 'أمين مخزن', 'مندوب مبيعات']
  for (const name of arabicRoles) {
    const role = await prisma.role.findFirst({
      where: { name },
      include: { _count: { select: { users: true } } },
    })
    if (role && role._count.users === 0) {
      await prisma.permission.deleteMany({ where: { roleId: role.id } })
      await prisma.role.delete({ where: { id: role.id } })
      console.log('removed unused role', name)
    }
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { role: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log('\nActive users:')
  for (const u of users) console.log(` - ${u.name} <${u.email}> [${u.role.name}]`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
