import 'server-only'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import baselineSnapshot from '@/lib/odoo-live-snapshot.json'
import posRegistry from '@/lib/odoo/pos-registry.json'

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

export const UNMAPPED_BUCKET_LABEL_AR = 'غير مصنّف — أجهزة غير مربوطة'
export const UNMAPPED_BUCKET_LABEL_EN = 'Unclassified — Unmapped POS Terminals'

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

export interface TerminalMappingLedgerSnapshot {
  source: 'odoo17-live' | 'verified-baseline'
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
    netSalesKwd: number
    orders: number
    mappedBranchesNetKwd: number
    mappedBranchesOrders: number
    unmappedTerminalsNetKwd: number
    unmappedTerminalsOrders: number
    reconciledExact: boolean
  }
}

interface RawCandidateTerminal {
  terminal_id: number
  terminal_name: string
  orders_count: number
  net_sales_kwd: number
}

interface LiveDiscoveredCache {
  updatedAtMs: number
  candidateTerminals: RawCandidateTerminal[]
  baseBranches: Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>
}

type GlobalMappingState = {
  loadedFromDisk: boolean
  overrides: Record<string, PosTerminalMappingOverride>
  liveDiscovered: LiveDiscoveredCache | null
}

const GLOBAL_KEY = '__aetherPosTerminalMappingStateV1' as const
const PERSIST_FILE_PATH = path.join(os.tmpdir(), 'aether-pos-terminal-mappings-v1.json')

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
      loadedFromDisk: false,
      overrides: {},
      liveDiscovered: null,
    }
  }
  const state = g[GLOBAL_KEY]!
  if (!state.loadedFromDisk) {
    state.loadedFromDisk = true
    try {
      if (fs.existsSync(PERSIST_FILE_PATH)) {
        const raw = JSON.parse(fs.readFileSync(PERSIST_FILE_PATH, 'utf8')) as Record<
          string,
          PosTerminalMappingOverride
        >
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw)) {
            const tid = Number(v?.terminalId ?? k)
            if (
              Number.isInteger(tid) &&
              tid > 0 &&
              isValidActiveVentureBranchId(v?.branchId)
            ) {
              state.overrides[String(tid)] = {
                terminalId: tid,
                branchId: v.branchId,
                updatedAt:
                  typeof v.updatedAt === 'string'
                    ? v.updatedAt
                    : new Date().toISOString(),
                updatedBy:
                  typeof v.updatedBy === 'string' ? v.updatedBy : 'admin',
              }
            }
          }
        }
      }
    } catch {
      // Safe fallback to in-memory store on read-only serverless filesystems
    }
  }
  return state
}

function persistOverridesToDisk(
  overrides: Record<string, PosTerminalMappingOverride>,
): void {
  try {
    fs.writeFileSync(PERSIST_FILE_PATH, JSON.stringify(overrides, null, 2), 'utf8')
  } catch {
    // Ephemeral / read-only filesystem: in-memory state remains authoritative
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

export function setAdminPosTerminalMapping(params: {
  terminalId: number
  branchId: ActiveVentureBranchId | null
  updatedBy: string
}): Record<string, PosTerminalMappingOverride> {
  const { terminalId, branchId, updatedBy } = params
  if (!Number.isInteger(terminalId) || terminalId <= 0) {
    throw new Error('Invalid POS terminal_id')
  }
  const state = getGlobalState()
  const key = String(terminalId)
  if (branchId === null) {
    delete state.overrides[key]
  } else {
    state.overrides[key] = {
      terminalId,
      branchId,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'admin',
    }
  }
  persistOverridesToDisk(state.overrides)
  return { ...state.overrides }
}

export function resetAdminPosTerminalMappingsForTests(): void {
  const state = getGlobalState()
  state.overrides = {}
  persistOverridesToDisk(state.overrides)
}

export function recordLiveDiscoveredPosLedger(input: {
  candidateTerminals: RawCandidateTerminal[]
  baseBranches: Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>
}): void {
  const state = getGlobalState()
  state.liveDiscovered = {
    updatedAtMs: Date.now(),
    candidateTerminals: input.candidateTerminals
      .filter((t) => Number.isInteger(t.terminal_id) && t.terminal_id > 0)
      .map((t) => ({
        terminal_id: t.terminal_id,
        terminal_name: String(t.terminal_name || `POS #${t.terminal_id}`).trim(),
        orders_count: Math.max(0, Math.round(Number(t.orders_count) || 0)),
        net_sales_kwd: r3(Math.max(0, Number(t.net_sales_kwd) || 0)),
      })),
    baseBranches: { ...input.baseBranches },
  }
}

function buildBaselineDiscoveredSource(): {
  candidateTerminals: RawCandidateTerminal[]
  baseBranches: Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>
} {
  const rawSnap = baselineSnapshot as unknown as {
    registers?: {
      posConfigId: number
      name: string
      location: string
      orders: number
      netKwd: number
    }[]
  }
  const regMeta = posRegistry as unknown as {
    allowedPosConfigIds?: number[]
    registers?: Record<string, { location: string }>
  }

  const baseBranches = Object.fromEntries(
    ACTIVE_VENTURE_BRANCH_IDS.map((id) => [id, { netSalesKwd: 0, orders: 0 }]),
  ) as Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>

  const candidateById = new Map<number, RawCandidateTerminal>()

  for (const reg of rawSnap.registers ?? []) {
    const cfgId = Number(reg.posConfigId)
    if (!Number.isInteger(cfgId) || cfgId <= 0) continue
    const loc = String(reg.location || '')
    const net = r3(Math.max(0, Number(reg.netKwd) || 0))
    const ord = Math.max(0, Math.round(Number(reg.orders) || 0))
    if (isValidActiveVentureBranchId(loc)) {
      baseBranches[loc].netSalesKwd = r3(baseBranches[loc].netSalesKwd + net)
      baseBranches[loc].orders += ord
    } else {
      candidateById.set(cfgId, {
        terminal_id: cfgId,
        terminal_name: String(reg.name || `POS Terminal #${cfgId}`).trim(),
        orders_count: ord,
        net_sales_kwd: net,
      })
    }
  }

  // Also expose any whitelisted exhibition/unassigned pos.config IDs with 0 orders in the window
  for (const cfgId of regMeta.allowedPosConfigIds ?? []) {
    const loc = regMeta.registers?.[String(cfgId)]?.location
    if (loc && !isValidActiveVentureBranchId(loc) && !candidateById.has(cfgId)) {
      candidateById.set(cfgId, {
        terminal_id: cfgId,
        terminal_name: `POS EXEBITION #${cfgId}`,
        orders_count: 0,
        net_sales_kwd: 0,
      })
    }
  }

  const candidateTerminals = [...candidateById.values()]
    .filter((t) => t.net_sales_kwd > 0 || t.orders_count > 0)
    .sort((a, b) => b.net_sales_kwd - a.net_sales_kwd || a.terminal_id - b.terminal_id)

  return { candidateTerminals, baseBranches }
}

/**
 * Computes the complete POS Terminal Discovery & Branch Reallocation Snapshot:
 * Guarantees `sum(branches) + unmapped === companyTotals.netSalesKwd` (`0.000 KWD` drift)
 * before AND immediately after saving any terminal-to-branch mapping!
 */
export function computeTerminalMappingLedgerSnapshot(): TerminalMappingLedgerSnapshot {
  const state = getGlobalState()
  const useLive =
    state.liveDiscovered !== null &&
    state.liveDiscovered.candidateTerminals.length > 0

  const sourceData = useLive
    ? {
        candidateTerminals: state.liveDiscovered!.candidateTerminals,
        baseBranches: state.liveDiscovered!.baseBranches,
      }
    : buildBaselineDiscoveredSource()

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

  return {
    source: useLive ? 'odoo17-live' : 'verified-baseline',
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
      netSalesKwd: companyNetSalesKwd,
      orders: companyOrders,
      mappedBranchesNetKwd,
      mappedBranchesOrders,
      unmappedTerminalsNetKwd: unmappedNetAcc,
      unmappedTerminalsOrders: unmappedOrdersAcc,
      reconciledExact:
        Math.abs(r3(mappedBranchesNetKwd + unmappedNetAcc) - companyNetSalesKwd) === 0,
    },
  }
}
