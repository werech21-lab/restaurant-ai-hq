import { createHash, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { NextResponse, type NextRequest } from 'next/server'
import { Pool } from 'pg'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  extractClientIp,
  managerPinFailureLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import {
  resolveExecRoleProfile,
  toExecApproverRole,
  type ExecApproverRole,
} from '@/lib/auth/exec-role-meta'
import { prisma } from '@/lib/db'
import { sslOptions } from '@/lib/db-ssl'
import { APPROVED_BRANCH_IDS, type GlobalBranch } from '@/lib/aether/global-filter-engine'
import {
  buildCircularSerialRef,
  createDigitalSeal,
  createInitialGovernanceStore,
  DEFAULT_MASTER_PIN_HASH,
  hashManagerPin,
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

const GOVERNANCE_RESPONSE_HEADERS = ENTERPRISE_API_SECURITY_HEADERS
const SERVER_PIN_SALT = 'vf-aether-manager-pin-2026-v1:'
const DEFAULT_MANAGER_PIN_SHA256 =
  'db319c32fe81403035ac2bf4c1f627df061bc5cefe53c48ac55c628fa8f2e1d7'

function hashServerManagerPin(pin: string): Buffer {
  return createHash('sha256')
    .update(`${SERVER_PIN_SALT}${pin.trim()}`)
    .digest()
}

function verifyServerManagerPin(candidatePin: string, storedPinHash: string): boolean {
  const clean = candidatePin.trim()
  if (!/^\d{4}$/.test(clean)) return false

  const envOverride = process.env.AETHER_MANAGER_PIN?.trim()
  if (envOverride && /^\d{4}$/.test(envOverride)) {
    return timingSafeEqual(hashServerManagerPin(clean), hashServerManagerPin(envOverride))
  }

  if (storedPinHash && storedPinHash.startsWith('vfsha256_')) {
    const hex = storedPinHash.slice('vfsha256_'.length)
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      return timingSafeEqual(hashServerManagerPin(clean), Buffer.from(hex, 'hex'))
    }
  }

  if (storedPinHash && storedPinHash.startsWith('vfh1_') && storedPinHash !== DEFAULT_MASTER_PIN_HASH) {
    const a = createHash('sha256').update(hashManagerPin(clean)).digest()
    const b = createHash('sha256').update(storedPinHash).digest()
    return timingSafeEqual(a, b)
  }

  return timingSafeEqual(
    hashServerManagerPin(clean),
    Buffer.from(DEFAULT_MANAGER_PIN_SHA256, 'hex'),
  )
}

async function resolveAuthenticatedApproverRole(
  request: NextRequest,
  fallbackRole?: unknown,
): Promise<ExecApproverRole> {
  const rawToken =
    request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
    request.cookies.get('aether_exec_session')?.value
  const session = await verifyExecSessionToken(rawToken)
  if (session && session.role !== 'auditor') {
    return toExecApproverRole(session.role)
  }
  return toExecApproverRole(fallbackRole)
}

function stampIncomingStoreWithApprover(
  incoming: PersistedGovernanceStore,
  previous: PersistedGovernanceStore,
  approverRole: ExecApproverRole,
): PersistedGovernanceStore {
  const profile = resolveExecRoleProfile(approverRole)
  const prevByRef = new Map(previous.approvals.map((a) => [a.refKey, a]))

  const stampedApprovals = incoming.approvals.map((item) => {
    if (item.status !== 'approved' || !item.seal) return item
    const prev = prevByRef.get(item.refKey)
    const newlyApproved =
      !prev ||
      prev.status !== 'approved' ||
      prev.seal?.sealId !== item.seal.sealId
    if (newlyApproved || !item.seal.approverRole) {
      const roleToStamp = newlyApproved
        ? approverRole
        : toExecApproverRole(item.seal.approverRole ?? approverRole)
      const roleProfile = resolveExecRoleProfile(roleToStamp)
      return {
        ...item,
        seal: {
          ...item.seal,
          approverRole: roleToStamp,
          approverRoleAr: roleProfile.approverRoleAr,
          approverRoleEn: roleProfile.approverRoleEn,
          approvedByAr: roleProfile.sealAuthorityAr,
          approvedByEn: roleProfile.sealAuthorityEn,
        },
      }
    }
    return item
  })

  const stampedCirculars: Record<string, IssuedCircularRecord> = {
    ...incoming.issuedCirculars,
  }
  for (const [key, rec] of Object.entries(stampedCirculars)) {
    if (!rec) continue
    const prevRec = previous.issuedCirculars[key]
    const newlyIssued = !prevRec || prevRec.sealId !== rec.sealId
    if (newlyIssued || !rec.approverRole) {
      const roleToStamp = newlyIssued
        ? approverRole
        : toExecApproverRole(rec.approverRole ?? approverRole)
      const roleProfile =
        roleToStamp === approverRole
          ? profile
          : resolveExecRoleProfile(roleToStamp)
      stampedCirculars[key] = {
        ...rec,
        approverRole: roleToStamp,
        approverRoleAr: roleProfile.approverRoleAr,
        approverRoleEn: roleProfile.approverRoleEn,
        approvedByAr: roleProfile.sealAuthorityAr,
        approvedByEn: roleProfile.sealAuthorityEn,
      }
    }
  }

  return {
    ...incoming,
    approvals: stampedApprovals,
    issuedCirculars: stampedCirculars,
  }
}

export async function GET(request: NextRequest) {
  const authGuard = await requireExecApiSession(request, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  const env = await loadEnvelopeFromDatabase()
  return NextResponse.json(
    {
      ok: true,
      backend: env.backend,
      seededOnly: env.seededOnly,
      updatedAtIso: env.updatedAtIso,
      store: env.store,
    },
    { headers: GOVERNANCE_RESPONSE_HEADERS },
  )
}

export async function POST(request: NextRequest) {
  const authGuard = await requireExecApiSession(request, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  try {
    const body = (await request.json()) as {
      action?: string
      pin?: string
      currentPin?: string
      newPin?: string
      store?: PersistedGovernanceStore
      pinHash?: string
    }

    if (body?.action === 'verifyPin') {
      const pinKey = `${extractClientIp(request)}:${authGuard.session.sub}`
      const blocked = managerPinFailureLimiter.peekBlocked(pinKey)
      if (blocked.blocked) {
        return buildRateLimitedJsonResponse(blocked.retryAfterSeconds)
      }
      const current = await loadEnvelopeFromDatabase()
      const valid = verifyServerManagerPin(String(body.pin ?? ''), current.pinHash)
      if (!valid) {
        const fail = managerPinFailureLimiter.check(pinKey)
        if (!fail.allowed) {
          return buildRateLimitedJsonResponse(fail.retryAfterSeconds)
        }
      } else {
        managerPinFailureLimiter.reset(pinKey)
      }
      return NextResponse.json({ ok: true, valid }, { headers: GOVERNANCE_RESPONSE_HEADERS })
    }

    if (body?.action === 'changePin') {
      const pinKey = `${extractClientIp(request)}:${authGuard.session.sub}`
      const blocked = managerPinFailureLimiter.peekBlocked(pinKey)
      if (blocked.blocked) {
        return buildRateLimitedJsonResponse(blocked.retryAfterSeconds)
      }
      const current = await loadEnvelopeFromDatabase()
      const curOk = verifyServerManagerPin(String(body.currentPin ?? ''), current.pinHash)
      const nextClean = String(body.newPin ?? '').trim()
      if (!curOk || !/^\d{4}$/.test(nextClean)) {
        const fail = managerPinFailureLimiter.check(pinKey)
        if (!fail.allowed) {
          return buildRateLimitedJsonResponse(fail.retryAfterSeconds)
        }
        return NextResponse.json(
          { ok: false, valid: false, error: 'Invalid Manager PIN' },
          { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
        )
      }
      managerPinFailureLimiter.reset(pinKey)
      const nextShaHex = hashServerManagerPin(nextClean).toString('hex')
      await saveEnvelopeToDatabase(current.store, `vfsha256_${nextShaHex}`)
      return NextResponse.json({ ok: true, valid: true }, { headers: GOVERNANCE_RESPONSE_HEADERS })
    }

    const approverRole = toExecApproverRole(authGuard.session.role)
    const current = await loadEnvelopeFromDatabase()
    const normalizedIncoming = body?.store
      ? normalizeGovernanceStore(body.store)
      : current.store
    const incomingStore = body?.store
      ? stampIncomingStoreWithApprover(normalizedIncoming, current.store, approverRole)
      : current.store
    const merged = mergeGovernanceStores(incomingStore, current.store)
    const nextPinHash =
      typeof body?.pinHash === 'string' &&
      (body.pinHash.startsWith('vfh1_') || body.pinHash.startsWith('vfsha256_'))
        ? body.pinHash
        : current.pinHash

    const saved = await saveEnvelopeToDatabase(merged, nextPinHash)
    return NextResponse.json(
      {
        ok: true,
        backend: saved.backend,
        updatedAtIso: saved.updatedAtIso,
        store: saved.store,
      },
      { headers: GOVERNANCE_RESPONSE_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid governance sync payload' },
      { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const authGuard = await requireExecApiSession(request, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  try {
    const body = (await request.json()) as {
      action?: string
      pinHash?: string
      approverRole?: ExecApproverRole
      approval?: GovernanceApprovalRequest
      approvalId?: string
      rejectionNote?: string
      breachId?: string
      circularKey?: string
      branchId?: Exclude<GlobalBranch, 'all'>
      circularRecord?: IssuedCircularRecord & { circularKey?: string }
    }

    const serverApproverRole = await resolveAuthenticatedApproverRole(
      request,
      body.approverRole,
    )
    const approverProfile = resolveExecRoleProfile(serverApproverRole)
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
          const seal = createDigitalSeal(serverApproverRole)
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
          const sealRef = createDigitalSeal(serverApproverRole)
          nextStore = {
            ...nextStore,
            issuedCirculars: {
              ...nextStore.issuedCirculars,
              [body.circularKey]: {
                ...body.circularRecord,
                serialRef,
                sealId: body.circularRecord.sealId || sealRef.sealId,
                issuedAtIso: body.circularRecord.issuedAtIso || sealRef.approvedAtIso,
                approverRole: serverApproverRole,
                approverRoleAr: approverProfile.approverRoleAr,
                approverRoleEn: approverProfile.approverRoleEn,
                approvedByAr: approverProfile.sealAuthorityAr,
                approvedByEn: approverProfile.sealAuthorityEn,
              },
            },
          }
        }
        break
      }
      default:
        break
    }

    const saved = await saveEnvelopeToDatabase(nextStore, nextPinHash)
    return NextResponse.json(
      {
        ok: true,
        backend: saved.backend,
        updatedAtIso: saved.updatedAtIso,
        store: saved.store,
      },
      { headers: GOVERNANCE_RESPONSE_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to apply governance patch' },
      { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
    )
  }
}

export async function PUT(request: NextRequest) {
  const authGuard = await requireExecApiSession(request, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response
  return POST(request)
}

export async function DELETE(request: NextRequest) {
  const authGuard = await requireExecApiSession(request, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405, headers: GOVERNANCE_RESPONSE_HEADERS },
  )
}
