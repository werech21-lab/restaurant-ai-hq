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
import { keepStoredPinHash, pinHashForSettingsSave } from '@/lib/governance-pin'
import { sslOptions } from '@/lib/db-ssl'
import { APPROVED_BRANCH_IDS, type GlobalBranch } from '@/lib/aether/global-filter-engine'
import {
  fetchLiveOdooPeriodCube,
  fetchLiveOdooPurchaseOrders,
} from '@/lib/odoo-live-connector'
import {
  buildCircularSerialRef,
  createDigitalSeal,
  createInitialGovernanceStore,
  DEFAULT_MASTER_PIN_HASH,
  hashManagerPin,
  isExecutiveGovernanceRole,
  isVerifiedOdooGovernanceBreach,
  mergeGovernanceStores,
  normalizeGovernanceStore,
  type ComplianceBreachItem,
  type GovernanceAdminThresholds,
  type GovernanceApprovalRequest,
  type GovernanceAuditLogEntry,
  type IssuedCircularRecord,
  type PersistedGovernanceStore,
} from '@/lib/governance-compliance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROW_ID = 'venture-foods-hq'
const TMP_FILE_PATH = path.join(os.tmpdir(), 'vf-aether-governance-sync-v2.json')

interface ServerGovernanceEnvelope {
  store: PersistedGovernanceStore
  pinHash: string
  initialEmpty: boolean
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
          initialEmpty: false,
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
    initialEmpty: true,
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
          pinHash: keepStoredPinHash(row.pin_hash, DEFAULT_MASTER_PIN_HASH),
          initialEmpty: false,
          updatedAtIso:
            row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : String(row.updated_at || new Date().toISOString()),
          backend: 'postgres',
        }
        writeTmpFallback(env)
        return env
      }
      const fallback = readTmpFallback()
      return { ...fallback, backend: 'postgres' }
    } catch {
      globalForGov.__vfGovPgHealthy = false
      globalForGov.__vfGovPgCheckedAt = Date.now()
    }
  }

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
          pinHash: keepStoredPinHash(r.pin_hash, DEFAULT_MASTER_PIN_HASH),
          initialEmpty: false,
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
    typeof pinHash === 'string' &&
    (pinHash.startsWith('vfh1_') || pinHash.startsWith('vfsha256_'))
      ? pinHash
      : DEFAULT_MASTER_PIN_HASH

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
    initialEmpty: false,
    updatedAtIso: nowIso,
    backend,
  }
  writeTmpFallback(saved)
  return saved
}

function normalizeOdooWebBaseUrl(): string | null {
  const raw = (process.env.ODOO_URL ?? '').trim().replace(/\/+$/, '')
  if (!raw || !/^https?:\/\//i.test(raw)) return null
  return raw
}

function defaultKuwait30dWindow(): { from: string; to: string } {
  const kuwaitNowMs = Date.now() + 3 * 3600 * 1000
  const toDt = new Date(kuwaitNowMs)
  const fromDt = new Date(kuwaitNowMs - 29 * 86_400_000)
  return {
    from: fromDt.toISOString().slice(0, 10),
    to: toDt.toISOString().slice(0, 10),
  }
}

/**
 * Evaluates live Odoo breaches strictly against admin-saved server thresholds (`store.adminThresholds`).
 * Never uses code constants; returns `0` breaches when no admin threshold is configured or when Odoo has no violation.
 */
async function evaluateServerLiveOdooBreaches(
  store: PersistedGovernanceStore,
  requestedPeriod?: { from?: string; to?: string },
): Promise<ComplianceBreachItem[]> {
  const thresholds = store.adminThresholds ?? {}
  const discountRule = thresholds.posDiscountPctCap
  const supplierRule = thresholds.supplierOrderTotalCapKwd
  const commissionRule = thresholds.aggregatorCommissionPctCap

  const anyEnabled = Boolean(
    (discountRule?.enabled && Number.isFinite(discountRule.thresholdValue)) ||
      (supplierRule?.enabled && Number.isFinite(supplierRule.thresholdValue)) ||
      (commissionRule?.enabled && Number.isFinite(commissionRule.thresholdValue)),
  )
  if (!anyEnabled) return []

  const odooBaseUrl = normalizeOdooWebBaseUrl()
  if (!odooBaseUrl) return []

  const fallbackWin = defaultKuwait30dWindow()
  const fromIso =
    requestedPeriod?.from && /^\d{4}-\d{2}-\d{2}$/.test(requestedPeriod.from)
      ? requestedPeriod.from
      : fallbackWin.from
  const toIso =
    requestedPeriod?.to && /^\d{4}-\d{2}-\d{2}$/.test(requestedPeriod.to)
      ? requestedPeriod.to
      : fallbackWin.to
  const period = fromIso <= toIso ? { from: fromIso, to: toIso } : { from: toIso, to: fromIso }

  const out: ComplianceBreachItem[] = []

  if (
    (discountRule?.enabled && Number.isFinite(discountRule.thresholdValue)) ||
    (commissionRule?.enabled && Number.isFinite(commissionRule.thresholdValue))
  ) {
    try {
      const cube = await fetchLiveOdooPeriodCube(period.from, period.to)
      if (cube.connected && !cube.noData && cube.totals.netSalesKwd > 0) {
        if (discountRule?.enabled && Number.isFinite(discountRule.thresholdValue)) {
          const computedPct =
            Math.round((cube.totals.totalDiscountKwd / cube.totals.netSalesKwd) * 10000) / 100
          if (computedPct > discountRule.thresholdValue) {
            const topProd = cube.topProducts.find((p) => p.discountKwd > 0)
            const odooDomain = [
              ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ['discount', '>', 0],
              ['order_id.date_order', '>=', `${period.from} 00:00:00`],
              ['order_id.date_order', '<=', `${period.to} 23:59:59`],
            ]
            const odooRecordUrl = topProd
              ? `${odooBaseUrl}/web#id=${topProd.productId}&model=product.product&view_type=form`
              : `${odooBaseUrl}/web#model=pos.order.line&view_type=list`
            const excessKwd = Math.max(
              0,
              Math.round(
                ((computedPct - discountRule.thresholdValue) / 100) * cube.totals.netSalesKwd,
              ),
            )
            const id = 'live-breach-pos-discount-cap'
            out.push({
              id,
              category: 'discount-cap',
              severity: 'critical',
              odooModel: 'pos.order.line',
              odooDomain,
              period,
              odooRecordUrl,
              computedValue: computedPct,
              adminThreshold: discountRule.thresholdValue,
              breachKind: 'financial-bleed',
              approvedDecisionTitleAr: `سقف خصومات نقاط البيع المعتمد من الأدمن (${discountRule.thresholdValue}%)`,
              approvedDecisionTitleEn: `Admin-Saved POS Discount Cap (${discountRule.thresholdValue}%)`,
              breachHeadlineAr: `تجاوز خصومات نقاط البيع: ${computedPct}% مقابل السقف المحفوظ (${discountRule.thresholdValue}%)`,
              breachHeadlineEn: `POS Discount Cap Exceeded: ${computedPct}% vs ${discountRule.thresholdValue}% threshold`,
              odooMetricProofAr: `موديل pos.order.line (${period.from} → ${period.to}): خصومات ${cube.totals.totalDiscountKwd.toLocaleString('en-US')} د.ك من مبيعات ${cube.totals.netSalesKwd.toLocaleString('en-US')} د.ك`,
              odooMetricProofEn: `Model pos.order.line (${period.from} -> ${period.to}): ${cube.totals.totalDiscountKwd.toLocaleString('en-US')} KWD discounts on ${cube.totals.netSalesKwd.toLocaleString('en-US')} KWD sales`,
              approvedRuleLimitAr: `السقف الإداري المحفوظ على الخادم: ≤ ${discountRule.thresholdValue}%`,
              approvedRuleLimitEn: `Server Admin Threshold: <= ${discountRule.thresholdValue}%`,
              monthlyLeakKwd: excessKwd,
              affectedScopeAr: 'نقاط البيع الفعالة في Odoo',
              affectedScopeEn: 'Active Odoo POS Registers',
              href: '/erp/cores?tab=sales',
              frozen: Boolean(store.frozenBreachIds[id]),
              frozenAtIso: store.frozenBreachIds[id],
              stopDirectiveAr: `أمر تجميد خصومات يتجاوز السقف المحفوظ (${discountRule.thresholdValue}%) للفترة ${period.from} → ${period.to} (القيمة المحسوبة من Odoo: ${computedPct}%).`,
              stopDirectiveEn: `Freeze POS discounts exceeding admin threshold (${discountRule.thresholdValue}%) for ${period.from} -> ${period.to} (Odoo computed: ${computedPct}%).`,
            })
          }
        }

        if (
          commissionRule?.enabled &&
          Number.isFinite(commissionRule.thresholdValue) &&
          cube.accounting &&
          !cube.accounting.aggregatorCommissionUnposted &&
          cube.accounting.income > 0
        ) {
          const commKwd = cube.accounting.deliveryCommissions ?? 0
          const computedCommPct = Math.round((commKwd / cube.accounting.income) * 10000) / 100
          if (computedCommPct > commissionRule.thresholdValue) {
            const odooDomain = [
              ['parent_state', '=', 'posted'],
              ['date', '>=', period.from],
              ['date', '<=', period.to],
            ]
            const odooRecordUrl = `${odooBaseUrl}/web#model=account.move.line&view_type=list`
            const excessKwd = Math.max(
              0,
              Math.round(
                ((computedCommPct - commissionRule.thresholdValue) / 100) * cube.accounting.income,
              ),
            )
            const id = 'live-breach-aggregator-commission-cap'
            out.push({
              id,
              category: 'aggregator-promo-cap',
              severity: 'high',
              odooModel: 'account.move.line',
              odooDomain,
              period,
              odooRecordUrl,
              computedValue: computedCommPct,
              adminThreshold: commissionRule.thresholdValue,
              breachKind: 'financial-bleed',
              approvedDecisionTitleAr: `سقف نسبة عمولات المنصات المرحّلة (${commissionRule.thresholdValue}%)`,
              approvedDecisionTitleEn: `Admin-Saved Posted Aggregator Commission Cap (${commissionRule.thresholdValue}%)`,
              breachHeadlineAr: `تجاوز نسبة عمولات التوصيل المرحّلة: ${computedCommPct}% مقابل السقف (${commissionRule.thresholdValue}%)`,
              breachHeadlineEn: `Posted Aggregator Commission Exceeded: ${computedCommPct}% vs ${commissionRule.thresholdValue}%`,
              odooMetricProofAr: `موديل account.move.line (${period.from} → ${period.to}): عمولات مرحّلة ${commKwd.toLocaleString('en-US')} د.ك`,
              odooMetricProofEn: `Model account.move.line (${period.from} -> ${period.to}): ${commKwd.toLocaleString('en-US')} KWD posted commissions`,
              approvedRuleLimitAr: `السقف الإداري المحفوظ على الخادم: ≤ ${commissionRule.thresholdValue}%`,
              approvedRuleLimitEn: `Server Admin Threshold: <= ${commissionRule.thresholdValue}%`,
              monthlyLeakKwd: excessKwd,
              affectedScopeAr: 'قيود عمولات منصات التوصيل المرحّلة',
              affectedScopeEn: 'Posted Aggregator Commission Journal Items',
              href: '/erp/aggregator-radar',
              frozen: Boolean(store.frozenBreachIds[id]),
              frozenAtIso: store.frozenBreachIds[id],
              stopDirectiveAr: `مراجعة قيود عمولات المنصات للفترة ${period.from} → ${period.to} (${computedCommPct}% مقابل سقف ${commissionRule.thresholdValue}%).`,
              stopDirectiveEn: `Review posted aggregator commission entries for ${period.from} -> ${period.to} (${computedCommPct}% vs ${commissionRule.thresholdValue}% cap).`,
            })
          }
        }
      }
    } catch {
      // Never fabricate breaches on Odoo connectivity error
    }
  }

  if (supplierRule?.enabled && Number.isFinite(supplierRule.thresholdValue)) {
    try {
      const po = await fetchLiveOdooPurchaseOrders(period.from, period.to)
      if (po.connected && !po.noData && po.totals.totalUntaxedKwd > supplierRule.thresholdValue) {
        const topVendor = po.byVendor[0]
        const odooDomain = [
          ['state', 'in', ['purchase', 'done']],
          ['date_order', '>=', `${period.from} 00:00:00`],
          ['date_order', '<=', `${period.to} 23:59:59`],
        ]
        const odooRecordUrl = topVendor?.partnerId
          ? `${odooBaseUrl}/web#id=${topVendor.partnerId}&model=res.partner&view_type=form`
          : `${odooBaseUrl}/web#model=purchase.order&view_type=list`
        const overrunKwd = Math.max(
          0,
          Math.round(po.totals.totalUntaxedKwd - supplierRule.thresholdValue),
        )
        const id = 'live-breach-purchase-cap'
        out.push({
          id,
          category: 'ardiya-supplier-cost',
          severity: 'high',
          odooModel: 'purchase.order.line',
          odooDomain,
          period,
          odooRecordUrl,
          computedValue: Math.round(po.totals.totalUntaxedKwd * 1000) / 1000,
          adminThreshold: supplierRule.thresholdValue,
          breachKind: 'procedural-cap-overrun',
          capOverrunKwd: overrunKwd,
          approvedDecisionTitleAr: `سقف أوامر الشراء المحفوظ من الأدمن (${supplierRule.thresholdValue.toLocaleString('en-US')} د.ك)`,
          approvedDecisionTitleEn: `Admin-Saved Purchase Order Cap (${supplierRule.thresholdValue.toLocaleString('en-US')} KWD)`,
          breachHeadlineAr: `تجاوز إجمالي أوامر الشراء المؤكدة: ${po.totals.totalUntaxedKwd.toLocaleString('en-US')} د.ك مقابل السقف (${supplierRule.thresholdValue.toLocaleString('en-US')} د.ك)`,
          breachHeadlineEn: `Confirmed Purchase Orders Exceeded Cap: ${po.totals.totalUntaxedKwd.toLocaleString('en-US')} KWD vs ${supplierRule.thresholdValue.toLocaleString('en-US')} KWD`,
          odooMetricProofAr: `موديل purchase.order.line (${period.from} → ${period.to}): ${po.totals.ordersCount} أمر شراء مؤكد`,
          odooMetricProofEn: `Model purchase.order.line (${period.from} -> ${period.to}): ${po.totals.ordersCount} confirmed purchase orders`,
          approvedRuleLimitAr: `السقف الإداري المحفوظ على الخادم: ≤ ${supplierRule.thresholdValue.toLocaleString('en-US')} د.ك`,
          approvedRuleLimitEn: `Server Admin Threshold: <= ${supplierRule.thresholdValue.toLocaleString('en-US')} KWD`,
          monthlyLeakKwd: overrunKwd,
          affectedScopeAr: 'المشتريات والموردون في Odoo',
          affectedScopeEn: 'Odoo Purchasing & Vendors',
          href: '/erp/cost-intelligence',
          frozen: Boolean(store.frozenBreachIds[id]),
          frozenAtIso: store.frozenBreachIds[id],
          stopDirectiveAr: `إيقاف اعتماد أوامر شراء إضافية فوق السقف المحفوظ (${supplierRule.thresholdValue.toLocaleString('en-US')} د.ك) للفترة ${period.from} → ${period.to}.`,
          stopDirectiveEn: `Hold additional purchase orders exceeding admin cap (${supplierRule.thresholdValue.toLocaleString('en-US')} KWD) for ${period.from} -> ${period.to}.`,
        })
      }
    } catch {
      // Never fabricate breaches on Odoo connectivity error
    }
  }

  return out.filter((b) => isVerifiedOdooGovernanceBreach(b))
}

function appendAuditEntry(
  store: PersistedGovernanceStore,
  entry: Omit<GovernanceAuditLogEntry, 'id' | 'timestampIso'>,
  nowIso: string,
): GovernanceAuditLogEntry[] {
  const existing = Array.isArray(store.auditLog) ? store.auditLog : []
  const record: GovernanceAuditLogEntry = {
    id: `gov-audit-${Date.now()}-${existing.length + 1}`,
    timestampIso: nowIso,
    ...entry,
  }
  return [record, ...existing].slice(0, 200)
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

  // Server retains authority over issuedCirculars, adminThresholds, liveBreaches, and auditLog
  return {
    ...incoming,
    approvals: stampedApprovals,
    issuedCirculars: previous.issuedCirculars,
    adminThresholds: previous.adminThresholds,
    liveBreaches: previous.liveBreaches,
    auditLog: previous.auditLog,
    frozenBreachIds: previous.frozenBreachIds,
  }
}

export async function GET(request: NextRequest) {
  const authGuard = await requireExecApiSession(request, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  const env = await loadEnvelopeFromDatabase()
  const fromParam = request.nextUrl.searchParams.get('from') ?? undefined
  const toParam = request.nextUrl.searchParams.get('to') ?? undefined
  const liveBreaches = await evaluateServerLiveOdooBreaches(env.store, {
    from: fromParam,
    to: toParam,
  })
  const storeWithLiveBreaches: PersistedGovernanceStore = {
    ...env.store,
    liveBreaches,
  }

  return NextResponse.json(
    {
      ok: true,
      backend: env.backend,
      initialEmpty: env.initialEmpty,
      updatedAtIso: env.updatedAtIso,
      breachesCount: liveBreaches.length,
      breaches: liveBreaches,
      store: storeWithLiveBreaches,
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
    const liveBreaches = await evaluateServerLiveOdooBreaches(merged)
    const finalStore: PersistedGovernanceStore = {
      ...merged,
      adminThresholds: current.store.adminThresholds ?? {},
      issuedCirculars: current.store.issuedCirculars ?? {},
      frozenBreachIds: current.store.frozenBreachIds ?? {},
      auditLog: current.store.auditLog ?? [],
      liveBreaches,
    }
    const saved = await saveEnvelopeToDatabase(finalStore, pinHashForSettingsSave(current.pinHash))
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

  if (!isExecutiveGovernanceRole(authGuard.session.role)) {
    return NextResponse.json(
      { ok: false, error: 'Executive role (admin/gm/dgm/cfo/ops) required' },
      { status: 403, headers: GOVERNANCE_RESPONSE_HEADERS },
    )
  }

  try {
    const body = (await request.json()) as {
      action?: string
      pinHash?: string
      approverRole?: ExecApproverRole
      confirmedByExecutive?: boolean
      adminThresholds?: Partial<GovernanceAdminThresholds>
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
      case 'saveThresholds': {
        if (authGuard.session.role !== 'admin') {
          return NextResponse.json(
            { ok: false, error: 'Only admin can configure governance thresholds' },
            { status: 403, headers: GOVERNANCE_RESPONSE_HEADERS },
          )
        }
        const incoming = body.adminThresholds ?? {}
        const nextThresholds: GovernanceAdminThresholds = {
          ...(nextStore.adminThresholds ?? {}),
        }
        if (incoming.posDiscountPctCap) {
          const val = Number(incoming.posDiscountPctCap.thresholdValue)
          if (Number.isFinite(val) && val >= 0) {
            nextThresholds.posDiscountPctCap = {
              enabled: Boolean(incoming.posDiscountPctCap.enabled),
              thresholdValue: val,
              odooModel: 'pos.order.line',
              updatedAtIso: nowIso,
              updatedBySub: authGuard.session.sub,
              updatedByRole: serverApproverRole,
            }
          }
        }
        if (incoming.supplierOrderTotalCapKwd) {
          const val = Number(incoming.supplierOrderTotalCapKwd.thresholdValue)
          if (Number.isFinite(val) && val >= 0) {
            nextThresholds.supplierOrderTotalCapKwd = {
              enabled: Boolean(incoming.supplierOrderTotalCapKwd.enabled),
              thresholdValue: val,
              odooModel: 'purchase.order.line',
              updatedAtIso: nowIso,
              updatedBySub: authGuard.session.sub,
              updatedByRole: serverApproverRole,
            }
          }
        }
        if (incoming.aggregatorCommissionPctCap) {
          const val = Number(incoming.aggregatorCommissionPctCap.thresholdValue)
          if (Number.isFinite(val) && val >= 0) {
            nextThresholds.aggregatorCommissionPctCap = {
              enabled: Boolean(incoming.aggregatorCommissionPctCap.enabled),
              thresholdValue: val,
              odooModel: 'account.move.line',
              updatedAtIso: nowIso,
              updatedBySub: authGuard.session.sub,
              updatedByRole: serverApproverRole,
            }
          }
        }
        nextStore = {
          ...nextStore,
          adminThresholds: nextThresholds,
          auditLog: appendAuditEntry(
            nextStore,
            {
              actorSub: authGuard.session.sub,
              actorRole: serverApproverRole,
              action: 'saveThresholds',
              targetId: 'adminThresholds',
              confirmedByExecutive: true,
              summaryAr: 'حفظ سقوف التنبيهات الإدارية على الخادم',
              summaryEn: 'Saved server admin governance thresholds',
            },
            nowIso,
          ),
        }
        break
      }
      case 'updatePinHash':
        break
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
            auditLog: appendAuditEntry(
              nextStore,
              {
                actorSub: authGuard.session.sub,
                actorRole: serverApproverRole,
                action: 'approveRequest',
                targetId: body.approvalId,
                confirmedByExecutive: Boolean(body.confirmedByExecutive),
                summaryAr: `اعتماد طلب حوكمة (${body.approvalId})`,
                summaryEn: `Approved governance request (${body.approvalId})`,
              },
              nowIso,
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
            auditLog: appendAuditEntry(
              nextStore,
              {
                actorSub: authGuard.session.sub,
                actorRole: serverApproverRole,
                action: 'rejectRequest',
                targetId: body.approvalId,
                confirmedByExecutive: Boolean(body.confirmedByExecutive),
                summaryAr: `رفض طلب حوكمة (${body.approvalId})`,
                summaryEn: `Rejected governance request (${body.approvalId})`,
              },
              nowIso,
            ),
          }
        }
        break
      }
      case 'freezeBreach': {
        if (body.confirmedByExecutive !== true) {
          return NextResponse.json(
            { ok: false, error: 'Explicit executive confirmation is required to freeze a breach' },
            { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
          )
        }
        const liveBreaches = await evaluateServerLiveOdooBreaches(nextStore)
        const verifiedTarget = liveBreaches.find(
          (b) => b.id === body.breachId && isVerifiedOdooGovernanceBreach(b),
        )
        if (!body.breachId || !verifiedTarget) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Cannot freeze: no verified live Odoo breach with admin-saved threshold exists',
            },
            { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
          )
        }
        const nextResolved = { ...nextStore.resolvedBreachIds }
        delete nextResolved[body.breachId]
        nextStore = {
          ...nextStore,
          liveBreaches,
          frozenBreachIds: { ...nextStore.frozenBreachIds, [body.breachId]: nowIso },
          resolvedBreachIds: nextResolved,
          auditLog: appendAuditEntry(
            nextStore,
            {
              actorSub: authGuard.session.sub,
              actorRole: serverApproverRole,
              action: 'freezeBreach',
              targetId: body.breachId,
              confirmedByExecutive: true,
              summaryAr: `إيقاف وتجميد مخالفة Odoo مؤكدة (${verifiedTarget.odooModel}: ${verifiedTarget.computedValue} > ${verifiedTarget.adminThreshold})`,
              summaryEn: `Froze verified Odoo breach (${verifiedTarget.odooModel}: ${verifiedTarget.computedValue} > ${verifiedTarget.adminThreshold})`,
            },
            nowIso,
          ),
        }
        break
      }
      case 'unfreezeBreach': {
        if (body.confirmedByExecutive !== true || !body.breachId) {
          return NextResponse.json(
            { ok: false, error: 'Explicit executive confirmation is required' },
            { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
          )
        }
        const nextFrozen = { ...nextStore.frozenBreachIds }
        delete nextFrozen[body.breachId]
        nextStore = {
          ...nextStore,
          frozenBreachIds: nextFrozen,
          resolvedBreachIds: { ...nextStore.resolvedBreachIds, [body.breachId]: nowIso },
          auditLog: appendAuditEntry(
            nextStore,
            {
              actorSub: authGuard.session.sub,
              actorRole: serverApproverRole,
              action: 'unfreezeBreach',
              targetId: body.breachId,
              confirmedByExecutive: true,
              summaryAr: `فك تجميد مخالفة (${body.breachId})`,
              summaryEn: `Unfroze breach (${body.breachId})`,
            },
            nowIso,
          ),
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
        if (body.confirmedByExecutive !== true) {
          return NextResponse.json(
            { ok: false, error: 'Explicit executive confirmation is required to issue a circular' },
            { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
          )
        }
        const liveBreaches = await evaluateServerLiveOdooBreaches(nextStore)
        if (liveBreaches.length === 0 || !body.circularKey || !body.circularRecord) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Official circular issuance is disabled until live Odoo breaches with admin-saved thresholds exist',
            },
            { status: 400, headers: GOVERNANCE_RESPONSE_HEADERS },
          )
        }
        const serialRef =
          body.circularRecord.serialRef ?? buildCircularSerialRef(body.circularKey)
        const sealRef = createDigitalSeal(serverApproverRole)
        nextStore = {
          ...nextStore,
          liveBreaches,
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
          auditLog: appendAuditEntry(
            nextStore,
            {
              actorSub: authGuard.session.sub,
              actorRole: serverApproverRole,
              action: 'issueCircular',
              targetId: body.circularKey,
              confirmedByExecutive: true,
              summaryAr: `إصدار تعميم رسمي (${serialRef}) بتأكيد تنفيذي`,
              summaryEn: `Issued official circular (${serialRef}) with executive confirmation`,
            },
            nowIso,
          ),
        }
        break
      }
      default:
        break
    }

    const refreshedBreaches = await evaluateServerLiveOdooBreaches(nextStore)
    const saved = await saveEnvelopeToDatabase(
      { ...nextStore, liveBreaches: refreshedBreaches },
      nextPinHash,
    )
    return NextResponse.json(
      {
        ok: true,
        backend: saved.backend,
        updatedAtIso: saved.updatedAtIso,
        breachesCount: refreshedBreaches.length,
        breaches: refreshedBreaches,
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
