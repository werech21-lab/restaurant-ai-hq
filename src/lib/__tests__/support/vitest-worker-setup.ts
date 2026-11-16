import { afterAll } from 'vitest'

afterAll(async () => {
  const g = globalThis as { prisma?: { $disconnect?: () => Promise<void> } }
  try {
    await g.prisma?.$disconnect?.()
  } catch {
    // Ignore disconnect errors when Prisma was not used in this test file.
  }
})
