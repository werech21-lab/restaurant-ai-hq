import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

/** Delete one vitest SQLite copy and its journals. The source database is never removed. */
export function removeVitestSqliteCopy(target: string): void {
  if (!target.includes('aetherbi-vitest-')) return
  const normalized = target.replace(/\\/g, '/')
  if (normalized.includes('/prisma/') || normalized.endsWith('/dev.db')) return
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = `${target}${suffix}`
    try {
      if (existsSync(file)) unlinkSync(file)
    } catch {
      // Ignore if already removed or handle closed during teardown sweep.
    }
  }
}

/** Sweep a temporary directory for any leftover `aetherbi-vitest-*` SQLite copies or temp folders. */
export function sweepVitestSqliteCopies(dirPath = '/tmp'): void {
  try {
    if (!existsSync(dirPath)) return
    const normalizedDir = dirPath.replace(/\\/g, '/')
    if (normalizedDir.includes('/prisma')) return
    for (const name of readdirSync(dirPath)) {
      if (!name.startsWith('aetherbi-vitest-')) continue
      const full = path.join(dirPath, name)
      try {
        const st = statSync(full)
        if (st.isDirectory()) {
          rmSync(full, { recursive: true, force: true })
        } else {
          unlinkSync(full)
        }
      } catch {
        // Ignore racing removal.
      }
    }
  } catch {
    // Ignore missing /tmp directory.
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  __aetherbiVitestExitHooked?: boolean
}

/**
 * Prisma erp-pro SQLite must NEVER overwrite process.env.DATABASE_URL.
 * That variable belongs to the Postgres pool (Odoo / Venture Foods company data).
 */
function resolveSqliteUrl() {
  const source = path.join(process.cwd(), 'prisma', 'dev.db')
  const testing = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
  if (testing && existsSync(source)) {
    const targetDir = '/tmp'
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
    const target = path.join(targetDir, `aetherbi-vitest-${process.pid}.db`)
    copyFileSync(source, target)
    if (!globalForPrisma.__aetherbiVitestExitHooked) {
      globalForPrisma.__aetherbiVitestExitHooked = true
      let beforeExitCleaned = false
      process.once('beforeExit', async () => {
        if (beforeExitCleaned) return
        beforeExitCleaned = true
        try {
          await globalForPrisma.prisma?.$disconnect()
        } catch {
          // Ignore disconnect errors at shutdown.
        }
        removeVitestSqliteCopy(target)
      })
      process.once('exit', () => {
        removeVitestSqliteCopy(target)
      })
    }
    const url = `file:${target.replace(/\\/g, '/')}`
    process.env.SQLITE_URL = url
    return url
  }
  if (process.env.VERCEL) {
    const targetDir = '/tmp'
    const target = path.join(targetDir, 'aetherbi-erp.db')
    try {
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
      if (existsSync(source)) copyFileSync(source, target)
      const url = `file:${target.replace(/\\/g, '/')}`
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.SQLITE_URL } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
