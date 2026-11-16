import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import os from 'os'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  __aetherbiVitestExitHooked?: boolean
  __aetherbiCreatedVitestDbPaths?: Set<string>
}

const createdVitestDbPaths =
  globalForPrisma.__aetherbiCreatedVitestDbPaths ?? new Set<string>()
globalForPrisma.__aetherbiCreatedVitestDbPaths = createdVitestDbPaths

function isProtectedSqlitePath(candidate: string): boolean {
  const normalized = candidate.replace(/\\/g, '/')
  return (
    normalized.includes('/prisma') ||
    normalized.endsWith('/dev.db') ||
    normalized === 'dev.db' ||
    normalized.endsWith('aetherbi-erp.db')
  )
}

function vitestRunManifestPath(runId: string): string {
  const safeRunId = runId.trim().replace(/[\\/]/g, '_')
  return path.join(os.tmpdir(), `vf-vitest-run-${safeRunId}.manifest`)
}

/** Record a vitest SQLite copy in the per-run manifest so global teardown sweeps only this run's files. */
export function recordVitestSqliteCopyForRun(target: string, runId: string): void {
  const trimmed = runId.trim()
  if (!trimmed) return
  if (!target.includes('aetherbi-vitest-') || isProtectedSqlitePath(target)) return
  try {
    const tmp = os.tmpdir()
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
    appendFileSync(vitestRunManifestPath(trimmed), `${target}\n`, 'utf8')
  } catch {
    // Ignore manifest write errors.
  }
}

/** Delete one vitest SQLite copy and its journals. The source database is never removed. */
export function removeVitestSqliteCopy(target: string): void {
  if (!target.includes('aetherbi-vitest-')) return
  if (isProtectedSqlitePath(target)) return
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = `${target}${suffix}`
    try {
      if (existsSync(file)) unlinkSync(file)
    } catch {
      // Ignore if already removed or handle closed during teardown sweep.
    }
  }
}

/** Sweep leftover `aetherbi-vitest-*` SQLite copies recorded by this process or run manifest. */
export function sweepVitestSqliteCopies(
  dirPath = '/tmp',
  runId = process.env.AETHERBI_VITEST_RUN_ID,
): void {
  try {
    if (isProtectedSqlitePath(dirPath)) return
    for (const p of createdVitestDbPaths) {
      removeVitestSqliteCopy(p)
    }
    const trimmedRunId = runId?.trim() ?? ''
    if (trimmedRunId.length > 0) {
      const manifestPath = vitestRunManifestPath(trimmedRunId)
      if (existsSync(manifestPath)) {
        const content = readFileSync(manifestPath, 'utf8')
        for (const rawLine of content.split(/\r?\n/)) {
          const line = rawLine.trim()
          if (line.length > 0) {
            removeVitestSqliteCopy(line)
          }
        }
        try {
          unlinkSync(manifestPath)
        } catch {
          // Ignore racing manifest removal.
        }
      }
    }
  } catch {
    // Ignore missing temporary directory or manifest race.
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
    const targetDir = '/tmp'
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
    const target = path.join(targetDir, `aetherbi-vitest-${process.pid}.db`)
    copyFileSync(source, target)
    createdVitestDbPaths.add(target)
    const runId = process.env.AETHERBI_VITEST_RUN_ID?.trim() || ''
    if (runId) {
      recordVitestSqliteCopyForRun(target, runId)
    }
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
        for (const p of createdVitestDbPaths) {
          removeVitestSqliteCopy(p)
        }
      })
      process.once('exit', () => {
        for (const p of createdVitestDbPaths) {
          removeVitestSqliteCopy(p)
        }
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
