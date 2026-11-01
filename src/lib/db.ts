import { copyFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

function prepareDatabaseUrl() {
  const source = path.join(process.cwd(), 'prisma', 'dev.db')
  if (process.env.VERCEL) {
    const targetDir = '/tmp'
    const target = path.join(targetDir, 'aetherbi-erp.db')
    try {
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
      if (existsSync(source)) copyFileSync(source, target)
      process.env.DATABASE_URL = `file:${target}`
      return process.env.DATABASE_URL
    } catch {
      // fall through to source path
    }
  }
  const absolute = `file:${source.replace(/\\/g, '/')}`
  process.env.DATABASE_URL = absolute
  return absolute
}

prepareDatabaseUrl()

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
