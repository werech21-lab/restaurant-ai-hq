import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { MODULES } from '@/lib/modules'

const OFFICIAL_EMAIL = 'admin@aetherbi.com'
const OFFICIAL_PASSWORD = 'AetherAdmin#2026!'
const OFFICIAL_NAME = 'Aether Super Admin'

/**
 * Idempotent upsert of the official Venture Foods / AetherBI admin.
 * Never deletes existing users (including admin@erp.com).
 */
export async function ensureOfficialAdmin() {
  const adminRole =
    (await prisma.role.findFirst({ where: { isAdmin: true } })) ??
    (await prisma.role.create({
      data: {
        name: 'SUPER_ADMIN',
        description: 'Official AetherBI full access · ALL_BRANDS',
        isAdmin: true,
        permissions: {
          create: MODULES.map((module) => ({
            module: module.key,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
          })),
        },
      },
    }))

  const passwordHash = await bcrypt.hash(OFFICIAL_PASSWORD, 10)
  const existing = await prisma.user.findUnique({ where: { email: OFFICIAL_EMAIL } })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: OFFICIAL_NAME,
        passwordHash,
        isActive: true,
        roleId: adminRole.id,
      },
    })
    return { email: OFFICIAL_EMAIL, created: false }
  }

  await prisma.user.create({
    data: {
      name: OFFICIAL_NAME,
      email: OFFICIAL_EMAIL,
      passwordHash,
      isActive: true,
      roleId: adminRole.id,
    },
  })
  return { email: OFFICIAL_EMAIL, created: true }
}
