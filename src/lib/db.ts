import { copyFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma erp-pro SQLite must NEVER overwrite process.env.DATABASE_URL.
 * That variable belongs to the Postgres pool (Odoo / Venture Foods company data).
 */
function resolveSqliteUrl() {
  const source = path.join(process.cwd(), 'prisma', 'dev.db')
  if (process.env.VERCEL) {
    const targetDir = '/tmp'
    const target = path.join(targetDir, 'aetherbi-erp.db')
    try {
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
      if (existsSync(source)) copyFileSync(source, target)
      const url = `file:${target}`
      process.env.SQLITE_URL = url
      return url
    } catch {
      // fall through
    }
  }
  const absolute = `file:${source.replace(/\\/g, '/')}`
  process.env.SQLITE_URL = absolute
  return absolute
}

resolveSqliteUrl()

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.SQLITE_URL } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
