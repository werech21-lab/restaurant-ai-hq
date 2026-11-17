import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MASTER_PIN_HASH } from '@/lib/governance-compliance'

const pinState = vi.hoisted(() => ({
  fail: false,
  queries: [] as string[],
  hash: '',
}))

vi.mock('pg', () => ({
  Pool: class {
    on() {
      return this
    }
    query(sql: string) {
      pinState.queries.push(String(sql))
      if (pinState.fail) return Promise.reject(new Error('governance down'))
      if (/select/i.test(String(sql))) {
        return Promise.resolve({
          rows: [{ payload: {}, pin_hash: pinState.hash, updated_at: '2026-11-16T00:00:00.000Z' }],
        })
      }
      return Promise.resolve({ rows: [] })
    }
  },
}))

vi.mock('@/lib/auth/api-guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-guard')>('@/lib/auth/api-guard')
  return {
    ...actual,
    requireExecApiSession: vi.fn(async () => ({ ok: true, session: { sub: 'phase10-pin', role: 'admin' } })),
  }
})

import { POST } from '@/app/api/erp/governance/route'

const TMP_FILE = path.join(tmpdir(), 'vf-aether-governance-sync-v2.json')
const databaseUrl = 'DATABASE_URL'
const databaseSsl = 'DATABASE_SSL'
const managerPin = 'AETHER_MANAGER_PIN'
const previousEnv = {
  DATABASE_URL: process.env[databaseUrl],
  DATABASE_SSL: process.env[databaseSsl],
  AETHER_MANAGER_PIN: process.env[managerPin],
}
const previousTmp = existsSync(TMP_FILE) ? readFileSync(TMP_FILE) : null

function request(action: string, body: Record<string, string>, ip: string) {
  return new NextRequest('http://localhost/api/erp/governance', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ action, ...body }),
  })
}

function writes() {
  return pinState.queries.filter((sql) => /\b(update|insert into)\b/i.test(sql))
}

describe('phase 10 manager pin route', () => {
  beforeEach(() => {
    pinState.fail = false
    pinState.queries.length = 0
    pinState.hash = DEFAULT_MASTER_PIN_HASH
    process.env[databaseUrl] = 'postgresql://pin-test.invalid/governance'
    process.env[databaseSsl] = 'disable'
    process.env[managerPin] = '1357'
    const globals = globalThis as { __vfGovPgHealthy?: boolean; __vfGovPgCheckedAt?: number }
    delete globals.__vfGovPgHealthy
    delete globals.__vfGovPgCheckedAt
  })

  afterAll(() => {
    if (previousEnv.DATABASE_URL === undefined) delete process.env[databaseUrl]
    else process.env[databaseUrl] = previousEnv.DATABASE_URL
    if (previousEnv.DATABASE_SSL === undefined) delete process.env[databaseSsl]
    else process.env[databaseSsl] = previousEnv.DATABASE_SSL
    if (previousEnv.AETHER_MANAGER_PIN === undefined) delete process.env[managerPin]
    else process.env[managerPin] = previousEnv.AETHER_MANAGER_PIN
    if (previousTmp) writeFileSync(TMP_FILE, previousTmp)
    else if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE)
    const globals = globalThis as { __vfGovPgPool?: unknown; __vfGovPgHealthy?: boolean; __vfGovPgCheckedAt?: number; __vfGovCache?: unknown }
    delete globals.__vfGovPgPool
    delete globals.__vfGovPgHealthy
    delete globals.__vfGovPgCheckedAt
    delete globals.__vfGovCache
  })

  it('checks the env pin before refusing the default hash and does not write a hash', async () => {
    const wrong = await POST(request('verifyPin', { pin: '0000' }, '203.0.113.10'))
    expect(wrong.status).toBe(200)
    expect(await wrong.json()).toMatchObject({ ok: true, valid: false })

    const allowed = await POST(request('verifyPin', { pin: '1357' }, '203.0.113.11'))
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toMatchObject({ ok: true, valid: true })

    delete process.env[managerPin]
    const withoutEnv = await POST(request('verifyPin', { pin: '1357' }, '203.0.113.12'))
    expect(await withoutEnv.json()).toMatchObject({ ok: true, valid: false })
    process.env[managerPin] = '1357'

    const change = await POST(request('changePin', { currentPin: '1357', newPin: '2468' }, '203.0.113.13'))
    expect(change.status).toBe(503)
    expect(writes()).toEqual([])
    expect(pinState.hash).toBe(DEFAULT_MASTER_PIN_HASH)
  })

  it('keeps the outage denied after the pool would accept a query again', async () => {
    pinState.fail = true
    const during = await POST(request('verifyPin', { pin: '1357' }, '203.0.113.20'))
    expect(await during.json()).toMatchObject({ ok: true, valid: false })
    const change = await POST(request('changePin', { currentPin: '1357', newPin: '2468' }, '203.0.113.21'))
    expect(change.status).toBe(503)
    const callsDuringOutage = pinState.queries.length

    pinState.fail = false
    const raced = await POST(request('verifyPin', { pin: '1357' }, '203.0.113.22'))
    expect(await raced.json()).toMatchObject({ ok: true, valid: false })
    expect(pinState.queries.length).toBe(callsDuringOutage)
    expect(writes()).toEqual([])
    expect(pinState.hash).toBe(DEFAULT_MASTER_PIN_HASH)
  })
})
