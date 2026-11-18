import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/odoo/gl-statements-live', () => ({
  fetchGlTrialBalance: vi.fn(async (fromIso: string, toIso: string) => ({
    fromIso,
    toIso,
    lines: [],
    unavailableSections: [],
  })),
  fetchGlBalanceSheet: vi.fn(async (asOfIso: string) => ({
    fromIso: asOfIso,
    toIso: asOfIso,
    lines: [],
    unavailableSections: [],
  })),
  probeCrossoveredBudgetReadable: vi.fn(async () => false),
}))

import { GET } from '@/app/api/erp/finance/gl-statements/route'
import { EXEC_SESSION_COOKIE, createExecSessionToken } from '@/lib/auth/exec-session'

const ORIGINAL_CRON = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = 'route-test-cron-secret'
})

async function callAs(role: 'marketing' | 'supply' | 'cfo' | 'gm' | 'auditor' | 'cron') {
  const headers = new Headers({ 'sec-fetch-site': 'same-origin' })
  if (role === 'cron') {
    headers.set('authorization', 'Bearer route-test-cron-secret')
  } else {
    const token = await createExecSessionToken(`${role}@venturefoodskw.com`, role)
    headers.set('cookie', `${EXEC_SESSION_COOKIE}=${token}`)
  }
  return GET(
    new NextRequest('http://localhost/api/erp/finance/gl-statements?from=2026-11-01&to=2026-11-17', {
      headers,
    }),
  )
}

describe('GL statements route role gate', () => {
  it('refuses marketing, supply and cron, and allows cfo, gm and auditor', async () => {
    expect((await callAs('marketing')).status).toBe(403)
    expect((await callAs('supply')).status).toBe(403)
    expect((await callAs('cron')).status).toBe(403)
    expect((await callAs('cfo')).status).toBe(200)
    expect((await callAs('gm')).status).toBe(200)
    expect((await callAs('auditor')).status).toBe(200)
    if (ORIGINAL_CRON === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_CRON
  })
})
