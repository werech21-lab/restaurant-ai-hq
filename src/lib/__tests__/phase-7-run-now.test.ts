import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listBriefs = vi.fn()
const acquire = vi.fn(async () => 'acquired' as const)
const release = vi.fn(async () => undefined)
const run = vi.fn()

vi.mock('@/lib/auth/api-guard', () => ({
  ENTERPRISE_API_SECURITY_HEADERS: { 'x-test': '1' },
  requireExecApiSession: vi.fn(async () => ({ ok: true, session: { sub: 'user-1', role: 'admin' } })),
}))

vi.mock('@/server/ai/persist', () => ({
  safeListDailyBriefs: () => listBriefs(),
  tryAcquireManualRunLock: () => acquire(),
  releaseManualRunLock: () => release(),
}))

vi.mock('@/server/ai/brief', () => ({
  runBackgroundAnalysis: () => run(),
}))

import { POST } from '@/app/api/erp/ai-brief/run/route'

const manualReply = JSON.stringify({
  configuration: 'not_configured',
  odoo: 'not_linked',
  trigger: 'manual',
  generatedAt: '2026-11-16T03:00:00.000Z',
  periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
  models: [],
  sections: [],
  findings: [],
  recommendations: [],
  disputed: [],
  dropped: [],
  unadoptedFindings: [],
  advisory: [],
  proposals: [],
  facts: [],
})

describe('phase 7 manual run cooldown', () => {
  beforeEach(() => {
    listBriefs.mockReset()
    acquire.mockClear()
    release.mockClear()
    run.mockReset()
  })

  it('checks the cooldown again after the lock is taken', async () => {
    listBriefs
      .mockResolvedValueOnce({ error: null, briefs: [] })
      .mockResolvedValueOnce({
        error: null,
        briefs: [{ createdAt: new Date(), reply: manualReply }],
      })
    const response = await POST(new NextRequest('http://localhost/api/erp/ai-brief/run', { method: 'POST' }))
    expect(response.status).toBe(429)
    expect(acquire).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
    expect(run).not.toHaveBeenCalled()
    expect(listBriefs).toHaveBeenCalledTimes(2)
  })
})
