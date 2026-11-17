/**
 * Sync Venture Foods leadership roles into the bundled SQLite DB (prisma/dev.db).
 * Existing user rows are NEVER modified. Missing users require an explicit non-default
 * password via VF_INITIAL_PASSWORD_<KEY> or --invite.
 * Run: npx tsx scripts/sync-vf-users.ts [--invite]
 */
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { MODULES } from '../src/lib/modules'
import { VF_TEAM, type VfTeamMember } from '../src/lib/venture-foods-team'

const sqliteUrl = `file:${path.join(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/')}`
const prisma = new PrismaClient({ datasources: { db: { url: sqliteUrl } } })
const inviteFlag = process.argv.includes('--invite')

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

async function main() {
  for (const member of VF_TEAM) {
    const roleId = await ensureRole(member)
    const envKey = `VF_INITIAL_PASSWORD_${member.key.toUpperCase()}`
    const explicitPassword = (process.env[envKey] ?? '').trim()
    for (const email of member.emails) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        console.log('kept existing user untouched:', email)
        continue
      }
      if (explicitPassword.length >= 8 && !['password', '12345678'].includes(explicitPassword.toLowerCase())) {
        const passwordHash = await bcrypt.hash(explicitPassword, 10)
        await prisma.user.create({
          data: { name: member.nameEn, email, roleId, isActive: true, passwordHash },
        })
        console.log('created missing user with explicit password:', email)
      } else if (inviteFlag) {
        const inviteMarker = `!INVITE_PENDING:${randomBytes(24).toString('hex')}`
        await prisma.user.create({
          data: { name: member.nameEn, email, roleId, isActive: true, passwordHash: inviteMarker },
        })
        console.log('created missing user with pending invite:', email)
      } else {
        console.log(`skipped missing user ${email}: provide ${envKey} (>=8 chars) or pass --invite`)
      }
    }
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
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
