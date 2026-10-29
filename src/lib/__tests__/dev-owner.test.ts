import { describe, expect, it } from 'vitest'
import { devOwnerEnabled, devOwnerHostAllowed, devOwnerNextPath, devOwnerRedirectUrl, devOwnerShouldSignIn } from '@/lib/auth/dev-owner'

describe('dev owner gate', () => {
  it('accepts only this machine', () => {
    expect(devOwnerHostAllowed('127.0.0.1:4020')).toBe(true)
    expect(devOwnerHostAllowed('localhost')).toBe(true)
    expect(devOwnerHostAllowed('aetherbi.com')).toBe(false)
    expect(devOwnerHostAllowed(null)).toBe(false)
  })

  it('stays closed in production even when the local flag and a secret are set', () => {
    const env = process.env as { NODE_ENV?: string; AETHER_DEV_OWNER?: string; AETHER_DEV_OWNER_SECRET?: string }
    const previous = { nodeEnv: env.NODE_ENV, flag: env.AETHER_DEV_OWNER, secret: env.AETHER_DEV_OWNER_SECRET }
    env.AETHER_DEV_OWNER = '1'
    env.AETHER_DEV_OWNER_SECRET = 'x'.repeat(32)
    env.NODE_ENV = 'production'
    try {
      expect(devOwnerEnabled()).toBe(false)
    } finally {
      env.NODE_ENV = previous.nodeEnv
      env.AETHER_DEV_OWNER = previous.flag
      env.AETHER_DEV_OWNER_SECRET = previous.secret
    }
  })

  it('signs the local hub in before the cards render', () => {
    const env = process.env as { NODE_ENV?: string; AETHER_DEV_OWNER?: string; AETHER_DEV_OWNER_SECRET?: string }
    const previous = { nodeEnv: env.NODE_ENV, flag: env.AETHER_DEV_OWNER, secret: env.AETHER_DEV_OWNER_SECRET }
    env.AETHER_DEV_OWNER = '1'
    env.AETHER_DEV_OWNER_SECRET = 'x'.repeat(32)
    env.NODE_ENV = 'development'
    try {
      expect(devOwnerShouldSignIn(false, '127.0.0.1:4020')).toBe(true)
      expect(devOwnerShouldSignIn(false, 'localhost:4020')).toBe(true)
      expect(devOwnerShouldSignIn(true, '127.0.0.1:4020')).toBe(false)
      expect(devOwnerShouldSignIn(false, 'aetherbi.com')).toBe(false)
    } finally {
      env.NODE_ENV = previous.nodeEnv
      env.AETHER_DEV_OWNER = previous.flag
      env.AETHER_DEV_OWNER_SECRET = previous.secret
    }
  })

  it('keeps the next path on this site', () => {
    expect(devOwnerNextPath('/erp/finance')).toBe('/erp/finance')
    expect(devOwnerNextPath('https://evil.example')).toBe('/erp/finance')
    expect(devOwnerNextPath('//evil.example')).toBe('/erp/finance')
    expect(devOwnerNextPath(null)).toBe('/erp/finance')
    expect(devOwnerRedirectUrl('127.0.0.1:4020', '/')).toBe('http://127.0.0.1:4020/')
    expect(devOwnerRedirectUrl('localhost:4020', '/erp/ai')).toBe('http://localhost:4020/erp/ai')
  })
})
