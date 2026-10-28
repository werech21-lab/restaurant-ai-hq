import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { e2eEnabled, e2eUserId, signE2eCookie } from '@/lib/auth/e2e-session'

const secret = 'local-e2e-secret-must-be-at-least-32'
const userId = '11111111-1111-4111-8111-111111111111'
const databaseKey = ['DATABASE', 'URL'].join('_')
const localDatabase = 'postgresql://127.0.0.1:54330/aether_e2e_synthetic'
const remoteDatabase = 'postgresql://aws-0-region.pooler.supabase.com:6543/postgres'

const env = process.env as { NODE_ENV?: string }

const previous = {
  flag: process.env.AETHER_E2E,
  nodeEnv: process.env.NODE_ENV,
  secret: process.env.AETHER_E2E_SECRET,
  database: process.env[databaseKey],
}

afterEach(() => {
  process.env.AETHER_E2E = previous.flag
  env.NODE_ENV = previous.nodeEnv
  process.env.AETHER_E2E_SECRET = previous.secret
  process.env[databaseKey] = previous.database
})

function openGate(): void {
  process.env.AETHER_E2E = '1'
  env.NODE_ENV = 'development'
  process.env.AETHER_E2E_SECRET = secret
  process.env[databaseKey] = localDatabase
}

describe('local e2e session gate', () => {
  it('stays closed unless every local condition holds', async () => {
    delete process.env.AETHER_E2E
    expect(e2eEnabled()).toBe(false)
    openGate()
    expect(e2eEnabled()).toBe(true)
    env.NODE_ENV = 'production'
    expect(e2eEnabled()).toBe(false)
    env.NODE_ENV = 'development'
    process.env[databaseKey] = remoteDatabase
    expect(e2eEnabled()).toBe(false)
    expect(await e2eUserId(`${userId}.forged`)).toBeNull()
  })

  it('accepts only a cookie signed with the local secret', async () => {
    openGate()
    const cookie = await signE2eCookie(userId, secret)
    const nodeMac = createHmac('sha256', secret).update(userId).digest('base64url')
    expect(cookie).toBe(`${userId}.${nodeMac}`)
    expect(await e2eUserId(cookie)).toBe(userId)
    expect(await e2eUserId(`${userId}.${nodeMac.slice(0, -1)}x`)).toBeNull()
    expect(await e2eUserId(undefined)).toBeNull()
  })
})
