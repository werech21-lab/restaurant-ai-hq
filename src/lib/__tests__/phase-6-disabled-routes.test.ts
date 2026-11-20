import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/api-guard', () => ({
  ENTERPRISE_API_SECURITY_HEADERS: { 'x-test': '1' },
  requireExecApiSession: vi.fn(async () => ({ ok: true, session: { sub: 'user-1', role: 'admin' } })),
}))

import { POST as claude } from '@/app/api/ai/claude/route'
import { POST as gemini } from '@/app/api/ai/gemini/route'
import { POST as forecast } from '@/app/api/erp/planning/forecast/route'

const routes = [
  ['claude', claude],
  ['gemini', gemini],
  ['forecast', forecast],
] as const

describe('phase 6 disabled model routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(routes)('returns 410 from %s after authentication', async (_name, handler) => {
    const response = await handler(new NextRequest('http://localhost/api', { method: 'POST' }))
    expect(response.status).toBe(410)
    const body = (await response.json()) as { error?: string }
    expect(body.error).toBe('disabled')
  })
})
