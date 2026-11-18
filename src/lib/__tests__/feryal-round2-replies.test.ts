import { describe, expect, it, vi } from 'vitest'

const { budgetReadable } = vi.hoisted(() => ({ budgetReadable: vi.fn(async () => false) }))

vi.mock('@/lib/odoo/gl-statements-live', () => ({
  probeCrossoveredBudgetReadable: () => budgetReadable(),
}))

import { askFeryalOdooAgent } from '@/lib/feryal-odoo-agent'
import {
  createDialectDataSource,
  DIALECT_NOW_MS,
} from '@/lib/__tests__/phase-5/support/feryal-dialect-fixture'

async function ask(question: string) {
  return askFeryalOdooAgent({
    question,
    referenceNowMs: DIALECT_NOW_MS,
    dataSource: createDialectDataSource(),
  })
}

describe('Feryal dialect replies from the fixture', () => {
  it('answers a named greeting without a sales figure', async () => {
    const res = await ask('مرحبا فريال')
    expect(res.status).toBe('answered')
    expect(res.reply).toContain('وش تبي نشوف الحين')
    expect(res.reply).not.toContain('الساعة')
  })

  it('says exhibition booths are absent when the cube has no exhibitions cell', async () => {
    const res = await ask('شو وضع البوثات؟')
    expect(res.reply).toBe('بوثات المعارض غير ظاهرة في مكعب هذه الفترة.')
    expect(res.reply).not.toContain('لا أملك بيانات من Odoo')
  })

  it('does not call the budget unavailable when the probe can read it', async () => {
    budgetReadable.mockResolvedValueOnce(true)
    const res = await ask('ما الموازنة التقديرية؟')
    expect(res.reply).not.toContain('crossovered.budget')
  })
})
