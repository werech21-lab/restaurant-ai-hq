import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

/** Delete one vitest SQLite copy and its journals. The source database is never removed. */
export function removeVitestSqliteCopy(target: string): void {
  if (!target.includes('aetherbi-vitest-')) return
  if (target.includes(`${path.sep}prisma${path.sep}`) || target.endsWith(`${path.sep}dev.db`)) return
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = `${target}${suffix}`
    try {
      if (existsSync(file)) unlinkSync(file)
    } catch {
      // The name can already be gone. Linux removes the directory entry while a handle is open.
    }
  }
}

/**
 * Prisma erp-pro SQLite must NEVER overwrite process.env.DATABASE_URL.
 * That variable belongs to the Postgres pool (Odoo / Venture Foods company data).
 */
function resolveSqliteUrl() {
  const source = path.join(process.cwd(), 'prisma', 'dev.db')
  const testing = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
  if (testing && existsSync(source)) {
    const target = path.join('/tmp', `aetherbi-vitest-${process.pid}.db`)
    copyFileSync(source, target)
    process.once('exit', () => {
      removeVitestSqliteCopy(target)
    })
    const url = `file:${target}`
    process.env.SQLITE_URL = url
    return url
  }
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
