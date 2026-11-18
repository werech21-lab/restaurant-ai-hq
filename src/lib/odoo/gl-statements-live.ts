/**
 * Read-only Odoo trial balance and balance sheet. Failures become a named
 * unavailable section and a warn log (section name and error code only).
 */

import { logger } from '@/lib/logger'
import {
  authenticateOdoo,
  executeOdooKw,
  isDecommissionedWarehouseRecord,
} from '@/lib/odoo-live-connector'
import type { GlAccountLine } from '@/lib/odoo/gl-statements'

type M2O = [number, string] | false | null | undefined

function m2oId(value: M2O): number | null {
  return Array.isArray(value) && typeof value[0] === 'number' ? value[0] : null
}

/** Same company resolution as the live connector: the user's company, else an active POS company. */
export async function resolveGlCompanyId(): Promise<number | null> {
  const uid = await authenticateOdoo()
  const users = await executeOdooKw<{ company_id?: M2O }[]>(
    'res.users',
    'read',
    [[uid], ['id', 'company_id']],
  )
  const fromUser = m2oId(users?.[0]?.company_id)
  if (fromUser !== null) return fromUser
  const configs = await executeOdooKw<{ company_id?: M2O }[]>(
    'pos.config',
    'search_read',
    [[['active', '=', true]]],
    { fields: ['company_id'], limit: 50 },
  )
  for (const row of configs ?? []) {
    const id = m2oId(row.company_id)
    if (id !== null) return id
  }
  return null
}

/** Active chart accounts, excluding the connector's decommissioned-warehouse names. */
export async function activeGlAccountIds(): Promise<number[]> {
  const rows = await executeOdooKw<{ id: number; code?: string; name?: string }[]>(
    'account.account',
    'search_read',
    [[]],
    { fields: ['id', 'code', 'name'] },
  )
  return (rows ?? [])
    .filter((row) => !isDecommissionedWarehouseRecord(`${row.code ?? ''} ${row.name ?? ''}`))
    .map((row) => row.id)
}

export function glReadDomains(
  companyId: number,
  activeAccountIds: readonly number[],
  fromIso: string,
  toIso: string,
): { trialBalance: unknown[][]; balanceSheet: unknown[][] } {
  const scope: unknown[][] = [
    ['company_id', '=', companyId],
    ['account_id', 'in', [...activeAccountIds]],
    ['parent_state', '=', 'posted'],
  ]
  return {
    trialBalance: [...scope, ['date', '>=', fromIso], ['date', '<=', toIso]],
    balanceSheet: [...scope, ['date', '<=', toIso]],
  }
}

export interface TrialBalance {
  fromIso: string
  toIso: string
  lines: GlAccountLine[]
  unavailableSections: string[]
}

type GroupRow = {
  account_id?: [number, string] | false
  debit?: number
  credit?: number
  balance?: number
  __count?: number
}

type AccountMeta = { code: string; name: string; account_type: string }

function lineFromGroup(row: GroupRow, meta: Map<number, AccountMeta>): GlAccountLine | null {
  const pair = row.account_id
  if (!pair || !Array.isArray(pair)) return null
  const account = meta.get(pair[0])
  if (!account) return null
  return {
    code: account.code,
    name: account.name,
    accountType: account.account_type,
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
    balance: Number(row.balance) || 0,
    lineCount: Math.max(0, Number(row.__count) || 0),
  }
}

async function readAccountMeta(): Promise<Map<number, AccountMeta>> {
  const rows = await executeOdooKw<{ id: number; code: string; name: string; account_type: string }[]>(
    'account.account',
    'search_read',
    [[]],
    { fields: ['id', 'code', 'name', 'account_type'] },
  )
  const map = new Map<number, AccountMeta>()
  for (const row of rows ?? []) map.set(row.id, row)
  return map
}

async function readGrouped(
  domain: unknown[][],
  section: string,
  fromIso: string,
  toIso: string,
): Promise<TrialBalance> {
  try {
    const meta = await readAccountMeta()
    const rows = await executeOdooKw<GroupRow[]>(
      'account.move.line',
      'read_group',
      [domain, ['debit:sum', 'credit:sum', 'balance:sum'], ['account_id']],
      { lazy: false },
    )
    const lines = (rows ?? [])
      .map((row) => lineFromGroup(row, meta))
      .filter((line): line is GlAccountLine => line !== null)
    return { fromIso, toIso, lines, unavailableSections: [] }
  } catch (error) {
    logger.warn(section, {
      section,
      code: error instanceof Error ? error.name : 'read_failed',
    })
    return { fromIso, toIso, lines: [], unavailableSections: [section] }
  }
}

async function scopedDomain(
  kind: 'trialBalance' | 'balanceSheet',
  fromIso: string,
  toIso: string,
): Promise<unknown[][] | null> {
  const companyId = await resolveGlCompanyId()
  const accountIds = await activeGlAccountIds()
  if (companyId === null || accountIds.length === 0) return null
  return glReadDomains(companyId, accountIds, fromIso, toIso)[kind]
}

export async function fetchGlTrialBalance(fromIso: string, toIso: string): Promise<TrialBalance> {
  const domain = await scopedDomain('trialBalance', fromIso, toIso)
  if (!domain) {
    return { fromIso, toIso, lines: [], unavailableSections: ['gl.trial_balance'] }
  }
  return readGrouped(domain, 'gl.trial_balance', fromIso, toIso)
}

export async function fetchGlBalanceSheet(asOfIso: string): Promise<TrialBalance> {
  const domain = await scopedDomain('balanceSheet', asOfIso, asOfIso)
  if (!domain) {
    return { fromIso: asOfIso, toIso: asOfIso, lines: [], unavailableSections: ['gl.balance_sheet'] }
  }
  return readGrouped(domain, 'gl.balance_sheet', asOfIso, asOfIso)
}

/** Read-only. False when `crossovered.budget` is missing or not readable. */
export async function probeCrossoveredBudgetReadable(): Promise<boolean> {
  try {
    const models = await executeOdooKw<{ model: string }[]>(
      'ir.model',
      'search_read',
      [[['model', '=', 'crossovered.budget']]],
      { fields: ['model'], limit: 1 },
    )
    if (!models?.length) return false
    const rights = await executeOdooKw<boolean>(
      'crossovered.budget',
      'check_access_rights',
      ['read'],
      { raise_exception: false },
    )
    return rights === true
  } catch (error) {
    logger.warn('gl.budget', {
      section: 'gl.budget',
      code: error instanceof Error ? error.name : 'probe_failed',
    })
    return false
  }
}
