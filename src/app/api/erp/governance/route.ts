import { existsSync, readFileSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { NextResponse, type NextRequest } from 'next/server'
import { Pool } from 'pg'
import { prisma } from '@/lib/db'
import { sslOptions } from '@/lib/db-ssl'
import { APPROVED_BRANCH_IDS, type GlobalBranch } from '@/lib/aether/global-filter-engine'
import {
  buildCircularSerialRef,
  createDigitalSeal,
  createInitialGovernanceStore,
  DEFAULT_MASTER_PIN_HASH,
  mergeGovernanceStores,
  normalizeGovernanceStore,
  type GovernanceApprovalRequest,
  type IssuedCircularRecord,
  type PersistedGovernanceStore,
} from '@/lib/governance-compliance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROW_ID = 'venture-foods-hq'
const TMP_FILE_PATH = path.join(os.tmpdir(), 'vf-aether-governance-sync-v1.json')

interface ServerGovernanceEnvelope {
  store: PersistedGovernanceStore
  pinHash: string
  seededOnly: boolean
  updatedAtIso: string
  backend: 'postgres' | 'prisma' | 'server-cache'
}

const globalForGov = globalThis as unknown as {
  __vfGovCache?: ServerGovernanceEnvelope
  __vfGovPgPool?: Pool | null
  __vfGovPgCheckedAt?: number
  __vfGovPgHealthy?: boolean
}

function readTmpFallback(): ServerGovernanceEnvelope {
  if (globalForGov.__vfGovCache) return globalForGov.__vfGovCache
  try {
    if (existsSync(TMP_FILE_PATH)) {
      const parsed = JSON.parse(readFileSync(TMP_FILE_PATH, 'utf8')) as Partial<ServerGovernanceEnvelope>
      if (parsed && parsed.store) {
        const loaded: ServerGovernanceEnvelope = {
          store: normalizeGovernanceStore(parsed.store),
          pinHash:
            typeof parsed.pinHash === 'string' && parsed.pinHash.startsWith('vfh1_')
              ? parsed.pinHash
              : DEFAULT_MASTER_PIN_HASH,
          seededOnly: false,
          updatedAtIso: parsed.updatedAtIso ?? new Date().toISOString(),
          backend: 'server-cache',
        }
        globalForGov.__vfGovCache = loaded
        return loaded
      }
    }
  } catch {
    // ignore fs errors on read-only edge containers
  }
  const initial: ServerGovernanceEnvelope = {
    store: createInitialGovernanceStore(),
    pinHash: DEFAULT_MASTER_PIN_HASH,
    seededOnly: true,
    updatedAtIso: new Date().toISOString(),
    backend: 'server-cache',
  }
  globalForGov.__vfGovCache = initial
  return initial
}

function writeTmpFallback(env: ServerGovernanceEnvelope): void {
  globalForGov.__vfGovCache = env
  try {
    writeFileSync(
      TMP_FILE_PATH,
      JSON.stringify({
        store: env.store,
        pinHash: env.pinHash,
        updatedAtIso: env.updatedAtIso,
      }),
      'utf8',
    )
  } catch {
    // ignore fs write errors on ephemeral containers
  }
}

function getGovernancePgPool(): Pool | null {
  const dbUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    return null
  }
  if (
    globalForGov.__vfGovPgHealthy === false &&
    globalForGov.__vfGovPgCheckedAt &&
    Date.now() - globalForGov.__vfGovPgCheckedAt < 30_000
  ) {
    return null
  }
  if (globalForGov.__vfGovPgPool) return globalForGov.__vfGovPgPool

  try {
    const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
    const sslMode: 'require' | 'verify' | 'disable' =
      rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
    const ssl = sslOptions(sslMode, process.env.DATABASE_SSL_CA)
    const pool = new Pool({
      connectionString: dbUrl,
      ssl,
      max: 2,
      connectionTimeoutMillis: 2200,
      idleTimeoutMillis: 10000,
    })
    pool.on('error', () => {
      globalForGov.__vfGovPgHealthy = false
      globalForGov.__vfGovPgCheckedAt = Date.now()
    })
    globalForGov.__vfGovPgPool = pool
    return pool
  } catch {
    globalForGov.__vfGovPgHealthy = false
    globalForGov.__vfGovPgCheckedAt = Date.now()
    return null
  }
}

async function loadEnvelopeFromDatabase(): Promise<ServerGovernanceEnvelope> {
  // 1. Try cloud Postgres (`DATABASE_URL`) when configured & reachable
  const pgPool = getGovernancePgPool()
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS vf_executive_governance_sync (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          pin_hash TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      const res = await pgPool.query<{
        payload: unknown
        pin_hash: string
        updated_at: string | Date
      }>(`SELECT payload, pin_hash, updated_at FROM vf_executive_governance_sync WHERE id = $1`, [
        ROW_ID,
      ])
      globalForGov.__vfGovPgHealthy = true
      globalForGov.__vfGovPgCheckedAt = Date.now()

      if (res.rows.length > 0) {
        const row = res.rows[0]
        const env: ServerGovernanceEnvelope = {
          store: normalizeGovernanceStore(row.payload),
          pinHash:
            typeof row.pin_hash === 'string' && row.pin_hash.startsWith('vfh1_')
              ? row.pin_hash
              : DEFAULT_MASTER_PIN_HASH,
          seededOnly: false,
          updatedAtIso:
            row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : String(row.updated_at || new Date().toISOString()),
          backend: 'postgres',
        }
        writeTmpFallback(env)
        return env
      }
      const seeded = readTmpFallback()
      return { ...seeded, backend: 'postgres' }
    } catch {
      globalForGov.__vfGovPgHealthy = false
      globalForGov.__vfGovPgCheckedAt = Date.now()
    }
  }

  // 2. Try Prisma SQLite when running on Vercel `/tmp` copy (never mutates tracked `prisma/dev.db` locally)
  if (process.env.VERCEL || process.env.VF_GOVERNANCE_PRISMA === '1') {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS vf_executive_governance_sync (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)
      const rows = await prisma.$queryRawUnsafe<
        { payload: string; pin_hash: string; updated_at: string }[]
      >(`SELECT payload, pin_hash, updated_at FROM vf_executive_governance_sync WHERE id = ?`, ROW_ID)
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0]
        const env: ServerGovernanceEnvelope = {
          store: normalizeGovernanceStore(JSON.parse(r.payload)),
          pinHash:
            typeof r.pin_hash === 'string' && r.pin_hash.startsWith('vfh1_')
              ? r.pin_hash
              : DEFAULT_MASTER_PIN_HASH,
          seededOnly: false,
          updatedAtIso: r.updated_at || new Date().toISOString(),
          backend: 'prisma',
        }
        writeTmpFallback(env)
        return env
      }
    } catch {
      // fall through to server cache
    }
  }

  // 3. Resilient server memory + `os.tmpdir()` state
  return readTmpFallback()
}

async function saveEnvelopeToDatabase(
  store: PersistedGovernanceStore,
  pinHash: string,
): Promise<ServerGovernanceEnvelope> {
  const nowIso = new Date().toISOString()
  const stampedStore: PersistedGovernanceStore = {
    ...normalizeGovernanceStore(store),
    updatedAtIso: nowIso,
  }
  const safePinHash =
    typeof pinHash === 'string' && pinHash.startsWith('vfh1_') ? pinHash : DEFAULT_MASTER_PIN_HASH

  let backend: ServerGovernanceEnvelope['backend'] = 'server-cache'

  const pgPool = getGovernancePgPool()
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS vf_executive_governance_sync (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          pin_hash TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await pgPool.query(
        `
        INSERT INTO vf_executive_governance_sync (id, payload, pin_hash, updated_at)
        VALUES ($1, $2::jsonb, $3, NOW())
        ON CONFLICT (id)
        DO UPDATE SET payload = EXCLUDED.payload, pin_hash = EXCLUDED.pin_hash, updated_at = NOW()
      `,
        [ROW_ID, JSON.stringify(stampedStore), safePinHash],
      )
      globalForGov.__vfGovPgHealthy = true
      globalForGov.__vfGovPgCheckedAt = Date.now()
      backend = 'postgres'
    } catch {
      globalForGov.__vfGovPgHealthy = false
      globalForGov.__vfGovPgCheckedAt = Date.now()
    }
  }

  if (backend === 'server-cache' && (process.env.VERCEL || process.env.VF_GOVERNANCE_PRISMA === '1')) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS vf_executive_governance_sync (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO vf_executive_governance_sync (id, payload, pin_hash, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          pin_hash = excluded.pin_hash,
          updated_at = excluded.updated_at
      `,
        ROW_ID,
        JSON.stringify(stampedStore),
        safePinHash,
        nowIso,
      )
      backend = 'prisma'
    } catch {
      // keep server-cache fallback
    }
  }

  const saved: ServerGovernanceEnvelope = {
    store: stampedStore,
    pinHash: safePinHash,
    seededOnly: false,
    updatedAtIso: nowIso,
    backend,
  }
  writeTmpFallback(saved)
  return saved
}

export async function GET() {
  const env = await loadEnvelopeFromDatabase()
  return NextResponse.json(
    {
      ok: true,
      backend: env.backend,
      seededOnly: env.seededOnly,
      updatedAtIso: env.updatedAtIso,
      pinHash: env.pinHash,
      store: env.store,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      store?: PersistedGovernanceStore
      pinHash?: string
    }
    const current = await loadEnvelopeFromDatabase()
    const incomingStore = body?.store
      ? normalizeGovernanceStore(body.store)
      : current.store
    const merged = mergeGovernanceStores(incomingStore, current.store)
    const nextPinHash =
      typeof body?.pinHash === 'string' && body.pinHash.startsWith('vfh1_')
        ? body.pinHash
        : current.pinHash

    const saved = await saveEnvelopeToDatabase(merged, nextPinHash)
    return NextResponse.json({
      ok: true,
      backend: saved.backend,
      updatedAtIso: saved.updatedAtIso,
      pinHash: saved.pinHash,
      store: saved.store,
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid governance sync payload' },
      { status: 400 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: string
      pinHash?: string
      approval?: GovernanceApprovalRequest
      approvalId?: string
      rejectionNote?: string
      breachId?: string
      circularKey?: string
      branchId?: Exclude<GlobalBranch, 'all'>
      circularRecord?: IssuedCircularRecord & { circularKey?: string }
    }

    const current = await loadEnvelopeFromDatabase()
    let nextStore = normalizeGovernanceStore(current.store)
    let nextPinHash = current.pinHash
    const nowIso = new Date().toISOString()

    switch (body.action) {
      case 'updatePinHash': {
        if (typeof body.pinHash === 'string' && body.pinHash.startsWith('vfh1_')) {
          nextPinHash = body.pinHash
        }
        break
      }
      case 'upsertApproval': {
        if (body.approval?.refKey) {
          const idx = nextStore.approvals.findIndex((a) => a.refKey === body.approval?.refKey)
          const nextList = [...nextStore.approvals]
          if (idx >= 0) nextList[idx] = { ...body.approval, updatedAtIso: nowIso }
          else nextList.unshift({ ...body.approval, updatedAtIso: nowIso })
          nextStore = { ...nextStore, approvals: nextList }
        }
        break
      }
      case 'approve': {
        if (body.approvalId) {
          const seal = createDigitalSeal()
          nextStore = {
            ...nextStore,
            approvals: nextStore.approvals.map((a) =>
              a.id === body.approvalId
                ? { ...a, status: 'approved', seal, updatedAtIso: seal.approvedAtIso }
                : a,
            ),
          }
        }
        break
      }
      case 'reject': {
        if (body.approvalId) {
          nextStore = {
            ...nextStore,
            approvals: nextStore.approvals.map((a) =>
              a.id === body.approvalId
                ? {
                    ...a,
                    status: 'rejected',
                    rejectionNote: body.rejectionNote,
                    updatedAtIso: nowIso,
                  }
                : a,
            ),
          }
        }
        break
      }
      case 'freezeBreach': {
        if (body.breachId) {
          const nextResolved = { ...nextStore.resolvedBreachIds }
          delete nextResolved[body.breachId]
          nextStore = {
            ...nextStore,
            frozenBreachIds: { ...nextStore.frozenBreachIds, [body.breachId]: nowIso },
            resolvedBreachIds: nextResolved,
          }
        }
        break
      }
      case 'unfreezeBreach': {
        if (body.breachId) {
          const nextFrozen = { ...nextStore.frozenBreachIds }
          delete nextFrozen[body.breachId]
          nextStore = {
            ...nextStore,
            frozenBreachIds: nextFrozen,
            resolvedBreachIds: { ...nextStore.resolvedBreachIds, [body.breachId]: nowIso },
          }
        }
        break
      }
      case 'toggleBranchReceipt': {
        if (body.circularKey && body.branchId) {
          const cur = nextStore.branchReceipts[body.circularKey] ?? {}
          nextStore = {
            ...nextStore,
            branchReceipts: {
              ...nextStore.branchReceipts,
              [body.circularKey]: { ...cur, [body.branchId]: !cur[body.branchId] },
            },
          }
        }
        break
      }
      case 'confirmAllBranches': {
        if (body.circularKey) {
          const allTrue: Partial<Record<Exclude<GlobalBranch, 'all'>, boolean>> = {}
          for (const b of APPROVED_BRANCH_IDS) allTrue[b] = true
          nextStore = {
            ...nextStore,
            branchReceipts: { ...nextStore.branchReceipts, [body.circularKey]: allTrue },
          }
        }
        break
      }
      case 'issueCircular': {
        if (body.circularKey && body.circularRecord) {
          const serialRef =
            body.circularRecord.serialRef ?? buildCircularSerialRef(body.circularKey)
          nextStore = {
            ...nextStore,
            issuedCirculars: {
              ...nextStore.issuedCirculars,
              [body.circularKey]: { ...body.circularRecord, serialRef },
            },
          }
        }
        break
      }
      default:
        break
    }

    const saved = await saveEnvelopeToDatabase(nextStore, nextPinHash)
    return NextResponse.json({
      ok: true,
      backend: saved.backend,
      updatedAtIso: saved.updatedAtIso,
      pinHash: saved.pinHash,
      store: saved.store,
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to apply governance patch' },
      { status: 400 },
    )
  }
}
