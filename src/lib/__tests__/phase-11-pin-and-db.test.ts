import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  govRows: [] as Array<{ payload: unknown; pin_hash: string; updated_at: string }>,
  govQueries: [] as Array<{ sql: string; params: unknown[] }>,
  mapQueries: [] as string[],
}))

vi.mock('pg', () => ({
  Pool: class {
    on() {
      return this
    }
    async query(sql: string, params: unknown[] = []) {
      const text = String(sql)
      if (text.includes('pos_terminal_branch_map')) {
        mockState.mapQueries.push(text)
        return { rows: [] }
      }
      mockState.govQueries.push({ sql: text, params })
      if (/^\s*select/i.test(text)) {
        return { rows: [...mockState.govRows] }
      }
      if (/insert\s+into\s+vf_executive_governance_sync/i.test(text)) {
        if (mockState.govRows.length === 0) {
          mockState.govRows.push({
            payload: typeof params[1] === 'string' ? JSON.parse(params[1]) : {},
            pin_hash: String(params[2] ?? ''),
            updated_at: '2026-11-16T00:00:00.000Z',
          })
        } else if (!/do\s+nothing/i.test(text)) {
          mockState.govRows[0] = {
            payload: typeof params[1] === 'string' ? JSON.parse(params[1]) : {},
            pin_hash: String(params[2] ?? mockState.govRows[0]!.pin_hash),
            updated_at: '2026-11-16T00:00:00.000Z',
          }
        }
      }
      return { rows: [] }
    }
  },
}))

vi.mock('@/lib/auth/api-guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-guard')>('@/lib/auth/api-guard')
  return {
    ...actual,
    requireExecApiSession: vi.fn(async () => ({ ok: true, session: { sub: 'phase11-pin', role: 'admin' } })),
  }
})

import { POST } from '@/app/api/erp/governance/route'
import { prisma } from '@/lib/db'
import { readPosTerminalMap, writePosTerminalMap } from '@/lib/odoo/terminal-mapping-store'
import { provisionLeadershipAccount } from '@/lib/ensure-venture-foods-team'

const TMP_FILE = path.join(tmpdir(), 'vf-aether-governance-sync-v2.json')
const dbKey = 'DATABASE_URL'
const sslKey = 'DATABASE_SSL'
const pinKey = 'AETHER_MANAGER_PIN'
const nodeEnvKey = 'NODE_ENV'

const envRecord = process.env as Record<string, string | undefined>
const prevEnv = {
  DATABASE_URL: envRecord[dbKey],
  DATABASE_SSL: envRecord[sslKey],
  AETHER_MANAGER_PIN: envRecord[pinKey],
  NODE_ENV: envRecord[nodeEnvKey],
}
const prevTmp = existsSync(TMP_FILE) ? readFileSync(TMP_FILE) : null

function govRequest(action: string, body: Record<string, string>, ip: string) {
  return new NextRequest('http://localhost/api/erp/governance', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ action, ...body }),
  })
}

describe('phase 11 blocker 4 & should-fix 5 & should-fix 7', () => {
  beforeEach(() => {
    mockState.govRows = []
    mockState.govQueries = []
    mockState.mapQueries = []
    process.env[dbKey] = 'postgresql://phase11-test.invalid/erp'
    process.env[sslKey] = 'disable'
    delete process.env[pinKey]
    const g = globalThis as {
      __vfGovPgPool?: unknown
      __vfGovPgHealthy?: boolean
      __vfGovPgCheckedAt?: number
      __vfGovCache?: unknown
      posTerminalMapPool?: unknown
    }
    delete g.__vfGovPgPool
    delete g.__vfGovPgHealthy
    delete g.__vfGovPgCheckedAt
    delete g.__vfGovCache
    delete g.posTerminalMapPool
  })

  afterAll(() => {
    if (prevEnv.DATABASE_URL === undefined) delete process.env[dbKey]
    else process.env[dbKey] = prevEnv.DATABASE_URL
    if (prevEnv.DATABASE_SSL === undefined) delete process.env[sslKey]
    else process.env[sslKey] = prevEnv.DATABASE_SSL
    if (prevEnv.AETHER_MANAGER_PIN === undefined) delete process.env[pinKey]
    else process.env[pinKey] = prevEnv.AETHER_MANAGER_PIN
    if (prevEnv.NODE_ENV === undefined) delete envRecord[nodeEnvKey]
    else envRecord[nodeEnvKey] = prevEnv.NODE_ENV
    if (prevTmp) writeFileSync(TMP_FILE, prevTmp)
    else if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE)
  })

  it('stops creating pos_terminal_branch_map at runtime in production and ships an RLS migration file', async () => {
    envRecord[nodeEnvKey] = 'production'
    await readPosTerminalMap()
    await writePosTerminalMap({
      terminalId: 19,
      branchId: 'salmiya',
      updatedAt: '2026-11-16T00:00:00.000Z',
      updatedBy: 'admin',
    })
    expect(mockState.mapQueries.some((sql) => /create\s+table/i.test(sql))).toBe(false)
    envRecord[nodeEnvKey] = prevEnv.NODE_ENV ?? 'test'

    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '0051_pos_terminal_branch_map.sql')
    expect(existsSync(migrationPath)).toBe(true)
    const migrationSql = readFileSync(migrationPath, 'utf8')
    expect(migrationSql).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(migrationSql).toMatch(/FORCE ROW LEVEL SECURITY/i)
    expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.pos_terminal_branch_map FROM PUBLIC,\s*anon,\s*authenticated/i)
  })

  it('creates a missing PIN row once ONLY from AETHER_MANAGER_PIN and never overwrites an existing row', async () => {
    // No PIN row + no AETHER_MANAGER_PIN -> denied, no insert
    const denied = await POST(govRequest('verifyPin', { pin: '1357' }, '198.51.100.10'))
    expect(await denied.json()).toMatchObject({ ok: true, valid: false })
    expect(mockState.govRows).toHaveLength(0)

    // With AETHER_MANAGER_PIN set, wrong PIN does not create a row
    process.env[pinKey] = '1357'
    const wrong = await POST(govRequest('verifyPin', { pin: '0000' }, '198.51.100.11'))
    expect(await wrong.json()).toMatchObject({ ok: true, valid: false })
    expect(mockState.govRows).toHaveLength(0)

    // Matching AETHER_MANAGER_PIN creates the row once with ON CONFLICT DO NOTHING
    const created = await POST(govRequest('verifyPin', { pin: '1357' }, '198.51.100.12'))
    expect(await created.json()).toMatchObject({ ok: true, valid: true })
    expect(mockState.govRows).toHaveLength(1)
    const initialHash = mockState.govRows[0]!.pin_hash
    expect(initialHash.startsWith('vfsha256_')).toBe(true)
    const insertsAfterFirst = mockState.govQueries.filter((q) =>
      /insert\s+into\s+vf_executive_governance_sync/i.test(q.sql),
    )
    expect(insertsAfterFirst).toHaveLength(1)
    expect(insertsAfterFirst[0]!.sql).toMatch(/ON CONFLICT\s*\(id\)\s*DO NOTHING/i)

    // Changing env PIN later must NEVER overwrite the existing stored row
    process.env[pinKey] = '9999'
    await POST(govRequest('verifyPin', { pin: '9999' }, '198.51.100.13'))
    expect(mockState.govRows[0]!.pin_hash).toBe(initialHash)
    const insertsAfterSecond = mockState.govQueries.filter((q) =>
      /insert\s+into\s+vf_executive_governance_sync/i.test(q.sql),
    )
    expect(insertsAfterSecond).toHaveLength(1)
  })

  it('requires an explicit non-default password or invite for new leadership accounts without touching existing ones', async () => {
    const existingAdmin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
    if (existingAdmin) {
      const originalHash = existingAdmin.passwordHash
      const kept = await provisionLeadershipAccount({
        email: existingAdmin.email,
        name: 'Should Not Rename',
        roleId: existingAdmin.roleId,
      })
      expect(kept).toEqual({ status: 'existing', userId: existingAdmin.id })
      const reread = await prisma.user.findUnique({ where: { id: existingAdmin.id } })
      expect(reread?.passwordHash).toBe(originalHash)
      expect(reread?.name).toBe(existingAdmin.name)
    }

    await expect(
      provisionLeadershipAccount({
        email: 'new-leader-test@venturefoodskw.com',
        name: 'New Leader',
        roleId: 'nonexistent-role',
        password: '123456',
      }),
    ).rejects.toThrow(/password|123456|invite/i)

    await expect(
      provisionLeadershipAccount({
        email: 'new-leader-test@venturefoodskw.com',
        name: 'New Leader',
        roleId: 'nonexistent-role',
      }),
    ).rejects.toThrow(/password|invite/i)
  })
})
