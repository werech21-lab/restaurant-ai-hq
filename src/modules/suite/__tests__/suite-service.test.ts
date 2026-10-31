import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

const { createRecord, getBoard } = await import('@/modules/suite/services/suite-service')

let auth: AuthContext

beforeAll(async () => {
  await startDatabase()
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant('Suite Co', `suite-${randomUUID().slice(0, 8)}`, userId)
  auth = { userId, tenantId, permissions: new Set(['suite.board.read', 'suite.board.manage']) }
}, 180_000)

afterAll(stopDatabase)

describe('suite boards', () => {
  it('creates and lists Venture Foods rows without DEMO titles', async () => {
    const created = await createRecord(auth, 'pos_sessions', {
      title: 'POS Sharq HQ open',
      stage: 'opening',
      brandName: 'Farm Brown',
      branchName: 'Sharq HQ',
      department: 'Front of house',
      assignee: 'Cashier',
      amountMinor: 125000,
      startsOn: '2026-10-31',
      endsOn: '2026-10-31',
    })
    expect(created.data.brandName).toBe('Farm Brown')
    const board = await getBoard(auth, 'pos_sessions')
    expect(board.data.records.length).toBeGreaterThan(0)
    expect(board.data.records.some((row) => /demo/i.test(row.title))).toBe(false)
    expect(board.data.facets.brand.some((facet) => facet.label === 'Farm Brown')).toBe(true)
  })
})
