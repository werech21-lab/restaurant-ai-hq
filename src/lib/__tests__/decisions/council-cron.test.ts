/**
 * Council cron: the middleware lets Vercel's cron (Bearer CRON_SECRET) reach /api/cron/council —
 * query string ignored — and refuses it otherwise; vercel.json runs it once nightly.
 */
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { middleware } from '@/middleware'

const SECRET = 'test-cron-secret-not-real-0123456789'
const req = (url: string, auth?: string) =>
  new NextRequest(`https://aetherbi.com${url}`, { method: 'GET', headers: auth ? { authorization: auth } : {} })

describe('middleware → /api/cron/council', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('passes Bearer CRON_SECRET through (with or without the scope query)', async () => {
    vi.stubEnv('CRON_SECRET', SECRET)
    for (const url of ['/api/cron/council?scope=nightly', '/api/cron/council']) {
      const res = await middleware(req(url, `Bearer ${SECRET}`))
      expect(res.status, url).not.toBe(401)
      expect(res.headers.get('x-middleware-next'), url).toBe('1')
    }
  })

  it('returns 401 without the header, with a wrong secret, or when CRON_SECRET is not set', async () => {
    vi.stubEnv('CRON_SECRET', SECRET)
    expect((await middleware(req('/api/cron/council?scope=nightly'))).status).toBe(401)
    expect((await middleware(req('/api/cron/council?scope=nightly', 'Bearer wrong-secret'))).status).toBe(401)
    vi.stubEnv('CRON_SECRET', '')
    expect((await middleware(req('/api/cron/council?scope=nightly', `Bearer ${SECRET}`))).status).toBe(401)
  })
})

describe('vercel.json', () => {
  it('runs the council once nightly, never hourly', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] }
    const council = cfg.crons.filter((c) => c.path.startsWith('/api/cron/council'))
    expect(council).toEqual([{ path: '/api/cron/council?scope=nightly', schedule: '7 1 * * *' }])
  })
})
