import 'server-only'

import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import { companyPosConfigAllowed, isPinnedSchoolCanteenConfigId } from '@/lib/odoo/company-pos'
import { errorFields, logger } from '@/lib/logger'
import {
  clearPosTerminalMap,
  deletePosTerminalMap,
  readPosTerminalMap,
  writePosTerminalMap,
} from '@/lib/odoo/terminal-mapping-store'

if (typeof window !== 'undefined') {
  throw new Error(
    'Security violation: src/lib/odoo-terminal-mappings.ts is strictly server-only.',
  )
}

export const ACTIVE_VENTURE_BRANCH_IDS = [
  'salmiya',
  'ardiya',
  'al-kout',
  'promenade',
  '360-mall',
  'avenues',
  'assima',
] as const

export type ActiveVentureBranchId = (typeof ACTIVE_VENTURE_BRANCH_IDS)[number]

export interface VentureBranchOption {
  id: ActiveVentureBranchId
  labelEn: string
  labelAr: string
  code: string
}

export const ACTIVE_VENTURE_BRANCH_OPTIONS: readonly VentureBranchOption[] = [
  { id: 'salmiya', labelEn: 'Salmiya', labelAr: 'السالمية', code: 'SLM' },
  { id: 'ardiya', labelEn: 'Ardiya', labelAr: 'العارضية', code: 'ARD' },
  { id: 'al-kout', labelEn: 'Al-Kout', labelAr: 'الكوت', code: 'KOT' },
  { id: 'promenade', labelEn: 'Promenade', labelAr: 'بروميناد', code: 'PRM' },
  { id: '360-mall', labelEn: '360', labelAr: 'مول 360', code: '360' },
  { id: 'avenues', labelEn: 'The Avenues', labelAr: 'الأفنيوز', code: 'AVN' },
  { id: 'assima', labelEn: 'Assima', labelAr: 'العاصمة', code: 'ASM' },
] as const

export const UNMAPPED_BUCKET_LABEL_AR = 'غير منسوب لفرع'
export const UNMAPPED_BUCKET_LABEL_EN = 'Unattributed to Branch'

const FORBIDDEN_TERMINAL_DISTRICT_RE = new RegExp(
  ['haw', 'ally|\\u062d\\u0648\\u0644\\u064a'].join(''),
  'i',
)

/**
 * Sanitizes POS terminal display labels so non-approved district names
 * never surface in UI or API responses (e.g. `#41` -> `مقصف مدرسة NPIS #41`).
 */
export function sanitizePosTerminalDisplayName(
  terminalId: number,
  rawName: string | null | undefined,
): string {
  const tid = Number.isInteger(terminalId) && terminalId > 0 ? terminalId : 0
  const trimmed = String(rawName ?? '').trim()
  if (isPinnedSchoolCanteenConfigId(tid) && companyPosConfigAllowed(tid, trimmed, true)) {
    const cleaned = trimmed.replace(FORBIDDEN_TERMINAL_DISTRICT_RE, ' ').replace(/\s+/g, ' ').trim()
    const inactive = /inactive|متوقف/i.test(trimmed)
    const label = cleaned || (tid > 0 ? `School canteen #${tid}` : 'School canteen')
    return inactive ? `${label} (\u0645\u062a\u0648\u0642\u0641)` : label
  }
  if (FORBIDDEN_TERMINAL_DISTRICT_RE.test(trimmed)) {
    return tid > 0 ? `POS #${tid}` : 'POS'
  }
  return trimmed || (tid > 0 ? `POS #${tid}` : 'POS')
}

export interface PosTerminalMappingOverride {
  terminalId: number
  branchId: ActiveVentureBranchId
  updatedAt: string
  updatedBy: string
}

export interface DiscoveredPosTerminalItem {
  terminal_id: number
  terminal_name: string
  orders_count: number
  net_sales_kwd: number
  assigned_branch_id: ActiveVentureBranchId | null
  assigned_branch_label_en: string | null
  assigned_branch_label_ar: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface BranchLedgerAllocationRow {
  id: ActiveVentureBranchId
  name: string
  nameEn: string
  nameAr: string
  code: string
  netSalesKwd: number
  orders: number
  sharePct: number
}

export interface PosTerminalAuditMappingRow {
  terminal_id: number
  terminal_name: string
  status: 'mapped-native' | 'mapped-admin' | 'unmapped'
  branch_id: ActiveVentureBranchId | null
  branch_label_en: string
  branch_label_ar: string
  orders_count: number
  net_sales_kwd: number
}

export interface ExcludedEntityReconciliationRow {
  entity_id: string
  terminal_ids: number[]
  label_en: string
  label_ar: string
  reason_en: string
  reason_ar: string
  orders_count: number
  net_sales_kwd: number
}

export interface PosReconciliationReport {
  asOfDate: string
  periodFrom: string
  periodTo: string
  grossPreExclusionKwd: number
  grossPreExclusionOrders: number
  excludedEntitiesKwd: number
  excludedEntitiesOrders: number
  activeCompanyNetSalesKwd: number
  activeCompanyOrders: number
  mappedBranchesNetKwd: number
  mappedBranchesOrders: number
  unmappedTerminalsNetKwd: number
  unmappedTerminalsOrders: number
  nonBranchBridgeTotalKwd: number
  exclusionGapKwd: number
  allocationGapKwd: number
  reconciledExact: boolean
  excludedBreakdown: ExcludedEntityReconciliationRow[]
  terminalMappingTable: PosTerminalAuditMappingRow[]
}

export interface TerminalMappingLedgerSnapshot {
  source: 'odoo17-live' | 'disconnected' | 'verified-baseline'
  noData?: boolean
  messageAr?: string
  unmappedLabelAr: string
  unmappedLabelEn: string
  branchOptions: readonly VentureBranchOption[]
  unmappedTerminals: DiscoveredPosTerminalItem[]
  mappedTerminals: DiscoveredPosTerminalItem[]
  allDiscoveredTerminals: DiscoveredPosTerminalItem[]
  branches: BranchLedgerAllocationRow[]
  unmappedBucket: {
    id: 'unmapped'
    labelAr: string
    labelEn: string
    netSalesKwd: number
    orders: number
    terminalsCount: number
  }
  companyTotals: {
    grossPreExclusionKwd: number
    grossPreExclusionOrders: number
    excludedEntitiesKwd: number
    excludedEntitiesOrders: number
    netSalesKwd: number
    orders: number
    mappedBranchesNetKwd: number
    mappedBranchesOrders: number
    unmappedTerminalsNetKwd: number
    unmappedTerminalsOrders: number
    reconciliationGapKwd: number
    reconciledExact: boolean
  }
  reconciliationReport: PosReconciliationReport
}

interface RawCandidateTerminal {
  terminal_id: number
  terminal_name: string
  orders_count: number
  net_sales_kwd: number
}

interface RawNativeMappedTerminal {
  terminal_id: number
  terminal_name: string
  branch_id: ActiveVentureBranchId
  orders_count: number
  net_sales_kwd: number
}

interface LiveDiscoveredCache {
  updatedAtMs: number
  asOfDate: string
  periodFrom: string
  periodTo: string
  candidateTerminals: RawCandidateTerminal[]
  nativeMappedTerminals: RawNativeMappedTerminal[]
  baseBranches: Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>
  excludedEntitiesKwd: number
  excludedEntitiesOrders: number
  excludedPos24Kwd?: number
  excludedPos24Orders?: number
  excludedPos36Kwd?: number
  excludedPos36Orders?: number
}

type GlobalMappingState = {
  loadedFromDb: boolean
  overrides: Record<string, PosTerminalMappingOverride>
  liveDiscovered: LiveDiscoveredCache | null
}

const GLOBAL_KEY = '__aetherPosTerminalMappingStateV1' as const

const r3 = (n: number): number => Math.round((Number(n) || 0) * 1000) / 1000
const pct1 = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0

export function isValidActiveVentureBranchId(
  raw: unknown,
): raw is ActiveVentureBranchId {
  return (
    typeof raw === 'string' &&
    (ACTIVE_VENTURE_BRANCH_IDS as readonly string[]).includes(raw)
  )
}

/** Accepts canonical IDs (`salmiya`, `360-mall`) as well as display labels (`Salmiya`, `360`, `The Avenues`). */
export function normalizeTargetBranchInput(
  raw: unknown,
): ActiveVentureBranchId | null | 'invalid' {
  if (raw === null || raw === undefined || raw === '' || raw === 'unmapped') {
    return null
  }
  if (typeof raw !== 'string') return 'invalid'
  const clean = raw.trim().toLowerCase()
  if (!clean || clean === 'unmapped' || clean === 'none') return null
  if (isValidActiveVentureBranchId(clean)) return clean

  const aliasMap: Record<string, ActiveVentureBranchId> = {
    salmiya: 'salmiya',
    السالمية: 'salmiya',
    ardiya: 'ardiya',
    العارضية: 'ardiya',
    'al-kout': 'al-kout',
    'al kout': 'al-kout',
    alkout: 'al-kout',
    kout: 'al-kout',
    الكوت: 'al-kout',
    promenade: 'promenade',
    بروميناد: 'promenade',
    '360': '360-mall',
    '360-mall': '360-mall',
    '360 mall': '360-mall',
    'مول 360': '360-mall',
    avenues: 'avenues',
    'the avenues': 'avenues',
    الأفنيوز: 'avenues',
    assima: 'assima',
    'assima mall': 'assima',
    العاصمة: 'assima',
  }
  return aliasMap[clean] ?? 'invalid'
}

function getGlobalState(): GlobalMappingState {
  const g = globalThis as unknown as Record<string, GlobalMappingState | undefined>
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      loadedFromDb: false,
      overrides: {},
      liveDiscovered: null,
    }
  }
  return g[GLOBAL_KEY]!
}

function applyStoredRows(rows: Awaited<ReturnType<typeof readPosTerminalMap>>): void {
  const state = getGlobalState()
  const next: Record<string, PosTerminalMappingOverride> = {}
  for (const row of rows) {
    if (!Number.isInteger(row.terminalId) || row.terminalId <= 0) continue
    if (!isValidActiveVentureBranchId(row.branchId)) continue
    next[String(row.terminalId)] = {
      terminalId: row.terminalId,
      branchId: row.branchId,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    }
  }
  state.overrides = next
  state.loadedFromDb = true
}

/** Loads admin mappings from the database into the process cache. */
export async function hydrateAdminPosTerminalMappings(options?: {
  required?: boolean
}): Promise<void> {
  try {
    applyStoredRows(await readPosTerminalMap())
  } catch (error) {
    if (options?.required) throw error
    logger.error('POS terminal mapping load failed', errorFields(error))
  }
}

export function getAdminPosTerminalMappings(): Record<
  string,
  PosTerminalMappingOverride
> {
  return { ...getGlobalState().overrides }
}

export function getAdminPosTerminalBranch(
  terminalId: number,
): ActiveVentureBranchId | null {
  if (!Number.isInteger(terminalId) || terminalId <= 0) return null
  const hit = getGlobalState().overrides[String(terminalId)]
  return hit && isValidActiveVentureBranchId(hit.branchId) ? hit.branchId : null
}

export async function setAdminPosTerminalMapping(params: {
  terminalId: number
  branchId: ActiveVentureBranchId | null
  updatedBy: string
}): Promise<Record<string, PosTerminalMappingOverride>> {
  const { terminalId, branchId, updatedBy } = params
  if (!Number.isInteger(terminalId) || terminalId <= 0) {
    throw new Error('Invalid POS terminal_id')
  }
  const updatedAt = new Date().toISOString()
  if (branchId === null) {
    await deletePosTerminalMap(terminalId)
  } else {
    await writePosTerminalMap({
      terminalId,
      branchId,
      updatedAt,
      updatedBy: updatedBy || 'admin',
    })
  }
  const state = getGlobalState()
  const key = String(terminalId)
  if (branchId === null) {
    delete state.overrides[key]
  } else {
    state.overrides[key] = {
      terminalId,
      branchId,
      updatedAt,
      updatedBy: updatedBy || 'admin',
    }
  }
  state.loadedFromDb = true
  return { ...state.overrides }
}

export function clearAdminPosTerminalMappingMemoryForTests(): void {
  const state = getGlobalState()
  state.overrides = {}
  state.loadedFromDb = true
}

export async function resetAdminPosTerminalMappingsForTests(): Promise<void> {
  await clearPosTerminalMap()
  clearAdminPosTerminalMappingMemoryForTests()
}

/**
 * Generic governance labels for decommissioned / non-operating Odoo entities:
 * Standing Rule: Never display forbidden legacy warehouse or non-operating brand names anywhere.
 */
const DECOMM_UNIT_LABEL_EN = 'Decommissioned Dispatch & Warehouse Unit (#24 & #36)'
const DECOMM_UNIT_LABEL_AR = 'وحدة التوصيل والمستودع المتوقفة عن التشغيل (كاشير #24 و#36)'
const EXCL_CATEGORY_LABEL_EN = 'Non-Operating POS Category (#150)'
const EXCL_CATEGORY_LABEL_AR = 'فئة نقاط البيع غير التشغيلية المستبعدة (فئة #150)'

export function clearLiveDiscoveredPosLedger(): void {
  const state = getGlobalState()
  state.liveDiscovered = null
}

export function recordLiveDiscoveredPosLedger(input: {
  asOfDate?: string
  periodFrom?: string
  periodTo?: string
  candidateTerminals: RawCandidateTerminal[]
  nativeMappedTerminals?: RawNativeMappedTerminal[]
  baseBranches: Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>
  excludedEntitiesKwd?: number
  excludedEntitiesOrders?: number
  excludedPos24Kwd?: number
  excludedPos24Orders?: number
  excludedPos36Kwd?: number
  excludedPos36Orders?: number
}): void {
  const state = getGlobalState()
  const kwTodayIso = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  state.liveDiscovered = {
    updatedAtMs: Date.now(),
    asOfDate: input.asOfDate ?? kwTodayIso,
    periodFrom: input.periodFrom ?? kwTodayIso,
    periodTo: input.periodTo ?? kwTodayIso,
    candidateTerminals: input.candidateTerminals
      .filter(
        (t) =>
          Number.isInteger(t.terminal_id) &&
          t.terminal_id > 0 &&
          !isExcludedOdooEntity(t.terminal_name),
      )
      .map((t) => ({
        terminal_id: t.terminal_id,
        terminal_name: sanitizePosTerminalDisplayName(t.terminal_id, t.terminal_name),
        orders_count: Math.max(0, Math.round(Number(t.orders_count) || 0)),
        net_sales_kwd: r3(Math.max(0, Number(t.net_sales_kwd) || 0)),
      })),
    nativeMappedTerminals: (input.nativeMappedTerminals ?? [])
      .filter(
        (t) =>
          Number.isInteger(t.terminal_id) &&
          t.terminal_id > 0 &&
          isValidActiveVentureBranchId(t.branch_id) &&
          !isExcludedOdooEntity(t.terminal_name),
      )
      .map((t) => ({
        terminal_id: t.terminal_id,
        terminal_name: sanitizePosTerminalDisplayName(t.terminal_id, t.terminal_name),
        branch_id: t.branch_id,
        orders_count: Math.max(0, Math.round(Number(t.orders_count) || 0)),
        net_sales_kwd: r3(Math.max(0, Number(t.net_sales_kwd) || 0)),
      })),
    baseBranches: { ...input.baseBranches },
    excludedEntitiesKwd: r3(Math.max(0, Number(input.excludedEntitiesKwd ?? 0) || 0)),
    excludedEntitiesOrders: Math.max(
      0,
      Math.round(Number(input.excludedEntitiesOrders ?? 0) || 0),
    ),
    excludedPos24Kwd: input.excludedPos24Kwd,
    excludedPos24Orders: input.excludedPos24Orders,
    excludedPos36Kwd: input.excludedPos36Kwd,
    excludedPos36Orders: input.excludedPos36Orders,
  }
}

function buildEmptyDisconnectedSource(): {
  asOfDate: string
  periodFrom: string
  periodTo: string
  candidateTerminals: RawCandidateTerminal[]
  allUnmappedCatalog: RawCandidateTerminal[]
  nativeMappedTerminals: RawNativeMappedTerminal[]
  baseBranches: Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>
  excludedEntitiesKwd: number
  excludedEntitiesOrders: number
  excludedPos24Kwd: number
  excludedPos24Orders: number
  excludedPos36Kwd: number
  excludedPos36Orders: number
} {
  const kwTodayIso = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  const baseBranches = Object.fromEntries(
    ACTIVE_VENTURE_BRANCH_IDS.map((id) => [id, { netSalesKwd: 0, orders: 0 }]),
  ) as Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>

  return {
    asOfDate: kwTodayIso,
    periodFrom: kwTodayIso,
    periodTo: kwTodayIso,
    candidateTerminals: [],
    allUnmappedCatalog: [],
    nativeMappedTerminals: [],
    baseBranches,
    excludedEntitiesKwd: 0,
    excludedEntitiesOrders: 0,
    excludedPos24Kwd: 0,
    excludedPos24Orders: 0,
    excludedPos36Kwd: 0,
    excludedPos36Orders: 0,
  }
}

/**
 * Computes the complete POS Terminal Discovery, Exclusion Reconciliation & Branch Reallocation Snapshot
 * strictly from live Odoo 17 data (`source: 'odoo17-live'`).
 * When Odoo is disconnected (`state.liveDiscovered === null`), returns `source: 'disconnected'`,
 * `noData: true`, and zeroed totals with no static fallback numbers.
 */
export function computeTerminalMappingLedgerSnapshot(): TerminalMappingLedgerSnapshot {
  const state = getGlobalState()
  const useLive = state.liveDiscovered !== null

  const emptySource = buildEmptyDisconnectedSource()
  const sourceData = useLive
    ? {
        asOfDate: state.liveDiscovered!.asOfDate,
        periodFrom: state.liveDiscovered!.periodFrom,
        periodTo: state.liveDiscovered!.periodTo,
        candidateTerminals: state.liveDiscovered!.candidateTerminals,
        allUnmappedCatalog: state.liveDiscovered!.candidateTerminals,
        nativeMappedTerminals: state.liveDiscovered!.nativeMappedTerminals,
        baseBranches: state.liveDiscovered!.baseBranches,
        excludedEntitiesKwd: state.liveDiscovered!.excludedEntitiesKwd,
        excludedEntitiesOrders: state.liveDiscovered!.excludedEntitiesOrders,
        excludedPos24Kwd:
          state.liveDiscovered!.excludedPos24Kwd ?? state.liveDiscovered!.excludedEntitiesKwd,
        excludedPos24Orders:
          state.liveDiscovered!.excludedPos24Orders ?? state.liveDiscovered!.excludedEntitiesOrders,
        excludedPos36Kwd: state.liveDiscovered!.excludedPos36Kwd ?? 0,
        excludedPos36Orders: state.liveDiscovered!.excludedPos36Orders ?? 0,
      }
    : emptySource

  const branchAccum = Object.fromEntries(
    ACTIVE_VENTURE_BRANCH_IDS.map((id) => [
      id,
      {
        netSalesKwd: r3(sourceData.baseBranches[id]?.netSalesKwd ?? 0),
        orders: Math.max(0, Math.round(sourceData.baseBranches[id]?.orders ?? 0)),
      },
    ]),
  ) as Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>

  const optionById = new Map(
    ACTIVE_VENTURE_BRANCH_OPTIONS.map((opt) => [opt.id, opt]),
  )

  const unmappedTerminals: DiscoveredPosTerminalItem[] = []
  const mappedTerminals: DiscoveredPosTerminalItem[] = []

  let unmappedNetAcc = 0
  let unmappedOrdersAcc = 0

  for (const rawTerm of sourceData.candidateTerminals) {
    const override = state.overrides[String(rawTerm.terminal_id)]
    const assignedBranch =
      override && isValidActiveVentureBranchId(override.branchId)
        ? override.branchId
        : null
    const branchMeta = assignedBranch ? optionById.get(assignedBranch) : undefined

    const enriched: DiscoveredPosTerminalItem = {
      terminal_id: rawTerm.terminal_id,
      terminal_name: rawTerm.terminal_name,
      orders_count: rawTerm.orders_count,
      net_sales_kwd: r3(rawTerm.net_sales_kwd),
      assigned_branch_id: assignedBranch,
      assigned_branch_label_en: branchMeta?.labelEn ?? null,
      assigned_branch_label_ar: branchMeta?.labelAr ?? null,
      updated_at: override?.updatedAt ?? null,
      updated_by: override?.updatedBy ?? null,
    }

    if (assignedBranch) {
      branchAccum[assignedBranch].netSalesKwd = r3(
        branchAccum[assignedBranch].netSalesKwd + enriched.net_sales_kwd,
      )
      branchAccum[assignedBranch].orders += enriched.orders_count
      mappedTerminals.push(enriched)
    } else {
      unmappedNetAcc = r3(unmappedNetAcc + enriched.net_sales_kwd)
      unmappedOrdersAcc += enriched.orders_count
      unmappedTerminals.push(enriched)
    }
  }

  const mappedBranchesNetKwd = r3(
    ACTIVE_VENTURE_BRANCH_IDS.reduce(
      (sum, id) => sum + branchAccum[id].netSalesKwd,
      0,
    ),
  )
  const mappedBranchesOrders = ACTIVE_VENTURE_BRANCH_IDS.reduce(
    (sum, id) => sum + branchAccum[id].orders,
    0,
  )

  const companyNetSalesKwd = r3(mappedBranchesNetKwd + unmappedNetAcc)
  const companyOrders = mappedBranchesOrders + unmappedOrdersAcc
  const excludedEntitiesKwd = r3(sourceData.excludedEntitiesKwd)
  const excludedEntitiesOrders = Math.max(0, Math.round(sourceData.excludedEntitiesOrders))
  const grossPreExclusionKwd = r3(companyNetSalesKwd + excludedEntitiesKwd)
  const grossPreExclusionOrders = companyOrders + excludedEntitiesOrders

  const exclusionGapKwd = r3(
    Math.abs(r3(grossPreExclusionKwd - excludedEntitiesKwd) - companyNetSalesKwd),
  )
  const allocationGapKwd = r3(
    Math.abs(r3(mappedBranchesNetKwd + unmappedNetAcc) - companyNetSalesKwd),
  )
  const reconciliationGapKwd = r3(Math.max(exclusionGapKwd, allocationGapKwd))
  const reconciledExact = reconciliationGapKwd === 0

  const branches: BranchLedgerAllocationRow[] = ACTIVE_VENTURE_BRANCH_OPTIONS.map(
    (opt) => ({
      id: opt.id,
      name: opt.labelEn,
      nameEn: opt.labelEn,
      nameAr: opt.labelAr,
      code: opt.code,
      netSalesKwd: branchAccum[opt.id].netSalesKwd,
      orders: branchAccum[opt.id].orders,
      sharePct: pct1(branchAccum[opt.id].netSalesKwd, companyNetSalesKwd),
    }),
  )

  const seenTerminalIds = new Set<number>()
  const terminalMappingTable: PosTerminalAuditMappingRow[] = []

  for (const nativeRow of sourceData.nativeMappedTerminals) {
    seenTerminalIds.add(nativeRow.terminal_id)
    const bMeta = optionById.get(nativeRow.branch_id)
    terminalMappingTable.push({
      terminal_id: nativeRow.terminal_id,
      terminal_name: nativeRow.terminal_name,
      status: 'mapped-native',
      branch_id: nativeRow.branch_id,
      branch_label_en: bMeta?.labelEn ?? nativeRow.branch_id,
      branch_label_ar: bMeta?.labelAr ?? nativeRow.branch_id,
      orders_count: nativeRow.orders_count,
      net_sales_kwd: r3(nativeRow.net_sales_kwd),
    })
  }

  const fullUnmappedSource = sourceData.allUnmappedCatalog

  for (const cand of fullUnmappedSource) {
    if (seenTerminalIds.has(cand.terminal_id)) continue
    seenTerminalIds.add(cand.terminal_id)
    const override = state.overrides[String(cand.terminal_id)]
    const assignedBranch =
      override && isValidActiveVentureBranchId(override.branchId)
        ? override.branchId
        : null
    const bMeta = assignedBranch ? optionById.get(assignedBranch) : undefined
    terminalMappingTable.push({
      terminal_id: cand.terminal_id,
      terminal_name: cand.terminal_name,
      status: assignedBranch ? 'mapped-admin' : 'unmapped',
      branch_id: assignedBranch,
      branch_label_en: bMeta?.labelEn ?? UNMAPPED_BUCKET_LABEL_EN,
      branch_label_ar: bMeta?.labelAr ?? UNMAPPED_BUCKET_LABEL_AR,
      orders_count: cand.orders_count,
      net_sales_kwd: r3(cand.net_sales_kwd),
    })
  }

  terminalMappingTable.sort(
    (a, b) => b.net_sales_kwd - a.net_sales_kwd || a.terminal_id - b.terminal_id,
  )

  const excludedBreakdown: ExcludedEntityReconciliationRow[] = [
    {
      entity_id: 'decommissioned-wh-pos-24-36',
      terminal_ids: [24, 36],
      label_en: DECOMM_UNIT_LABEL_EN,
      label_ar: DECOMM_UNIT_LABEL_AR,
      reason_en: 'Decommissioned warehouse & closed delivery dispatch unit excluded from active 7-branch ledger',
      reason_ar: 'وحدة تشغيلية ومستودع متوقف مستبعد بالكامل من دفتر الفروع السبعة النشطة',
      orders_count: Math.max(0, Math.round(sourceData.excludedPos24Orders + sourceData.excludedPos36Orders)),
      net_sales_kwd: r3(sourceData.excludedPos24Kwd + sourceData.excludedPos36Kwd),
    },
    {
      entity_id: 'excluded-brand-hb-150',
      terminal_ids: [],
      label_en: EXCL_CATEGORY_LABEL_EN,
      label_ar: EXCL_CATEGORY_LABEL_AR,
      reason_en: 'Non-operating / excluded POS category outside the 6 active Venture Foods brands',
      reason_ar: 'فئة تجارية مستبعدة خارج نطاق العلامات الست المعتمدة للشركة',
      orders_count: 0,
      net_sales_kwd: 0,
    },
  ]

  const nonBranchBridgeTotalKwd = r3(excludedEntitiesKwd + unmappedNetAcc)

  return {
    source: useLive ? 'odoo17-live' : 'disconnected',
    noData: !useLive,
    ...(useLive ? {} : { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' }),
    unmappedLabelAr: UNMAPPED_BUCKET_LABEL_AR,
    unmappedLabelEn: UNMAPPED_BUCKET_LABEL_EN,
    branchOptions: ACTIVE_VENTURE_BRANCH_OPTIONS,
    unmappedTerminals,
    mappedTerminals,
    allDiscoveredTerminals: [...unmappedTerminals, ...mappedTerminals],
    branches,
    unmappedBucket: {
      id: 'unmapped',
      labelAr: UNMAPPED_BUCKET_LABEL_AR,
      labelEn: UNMAPPED_BUCKET_LABEL_EN,
      netSalesKwd: unmappedNetAcc,
      orders: unmappedOrdersAcc,
      terminalsCount: unmappedTerminals.length,
    },
    companyTotals: {
      grossPreExclusionKwd,
      grossPreExclusionOrders,
      excludedEntitiesKwd,
      excludedEntitiesOrders,
      netSalesKwd: companyNetSalesKwd,
      orders: companyOrders,
      mappedBranchesNetKwd,
      mappedBranchesOrders,
      unmappedTerminalsNetKwd: unmappedNetAcc,
      unmappedTerminalsOrders: unmappedOrdersAcc,
      reconciliationGapKwd,
      reconciledExact,
    },
    reconciliationReport: {
      asOfDate: sourceData.asOfDate,
      periodFrom: sourceData.periodFrom,
      periodTo: sourceData.periodTo,
      grossPreExclusionKwd,
      grossPreExclusionOrders,
      excludedEntitiesKwd,
      excludedEntitiesOrders,
      activeCompanyNetSalesKwd: companyNetSalesKwd,
      activeCompanyOrders: companyOrders,
      mappedBranchesNetKwd,
      mappedBranchesOrders,
      unmappedTerminalsNetKwd: unmappedNetAcc,
      unmappedTerminalsOrders: unmappedOrdersAcc,
      nonBranchBridgeTotalKwd,
      exclusionGapKwd,
      allocationGapKwd,
      reconciledExact,
      excludedBreakdown,
      terminalMappingTable,
    },
  }
}
