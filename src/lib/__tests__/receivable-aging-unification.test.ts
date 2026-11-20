import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLiveDecisionSnapshotFromSummary } from '@/lib/aether/live-decision-generator'
import { logger } from '@/lib/logger'
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import {
  buildReceivablePartnerRows,
  customerReceivableFigures,
  customerReceivableNetKwd,
  receivablesCustomerSplit,
  type OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'
import {
  AR_AGING_BUCKETS,
  buildArTieOut,
  computeUnifiedReceivableAging,
  UnverifiedReceivableAccountError,
  type OpenReceivableLine,
  type UnifiedReceivablePartnerGroup,
} from '@/lib/odoo/receivable-aging'
import { openReceivableLineIncluded, POS_CLEARING_ACCOUNT_ID } from '@/lib/odoo/receivable-domain'

const TODAY_ISO = '2026-11-20'
const REF_NOW_MS = Date.parse('2026-11-20T11:30:00.000Z')
const ODOO_ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Production-mirror ledger dataset:
 * - Raw positive non-35 lines sum to 1,077,552.499 KWD (with 969,294.512 KWD aged >30 days).
 * - Unapplied negative settlement credits per `(partner_id, account_id)` net down historical invoices
 *   so net-positive debtors equal exact 28,168.351 KWD (and net-negative creditors = -1,351.372 KWD).
 * - Explicit POS cashier clearing account `accountId === 35` carries +85,000.000 / -85,992.319 = -992.319 KWD.
 */
function buildProductionMirrorLedger(): {
  lines: OpenReceivableLine[]
  partnerGroups: UnifiedReceivablePartnerGroup[]
} {
  const lines: OpenReceivableLine[] = [
    // Partner 101 (Talabat, accountId 121): +831,744.712 debits vs -813,576.361 credits -> +18,168.351 net open debit
    { id: 1, partnerId: 101, accountId: 121, residualKwd: 620000.0, dateMaturity: '2026-08-15', date: '2026-08-01' },
    { id: 2, partnerId: 101, accountId: 121, residualKwd: 149294.512, dateMaturity: '2026-10-10', date: '2026-10-01' },
    { id: 3, partnerId: 101, accountId: 121, residualKwd: 50000.0, dateMaturity: '2026-11-05', date: '2026-11-01' },
    { id: 4, partnerId: 101, accountId: 121, residualKwd: 12450.2, dateMaturity: '2026-11-19', date: '2026-11-18' },
    { id: 5, partnerId: 101, accountId: 121, residualKwd: -813576.361, dateMaturity: null, date: '2026-11-15' },

    // Partner 102 (Deliveroo, accountId 122): +235,807.787 debits vs -237,159.159 credits -> -1,351.372 net unapplied credit
    { id: 6, partnerId: 102, accountId: 122, residualKwd: 190000.0, dateMaturity: '2026-07-20', date: '2026-07-10' },
    { id: 7, partnerId: 102, accountId: 122, residualKwd: 45807.787, dateMaturity: '2026-11-18', date: '2026-11-17' },
    { id: 8, partnerId: 102, accountId: 122, residualKwd: -237159.159, dateMaturity: null, date: '2026-11-19' },

    // Partner 103 (Corporate Client, accountId 129): +10,000.000 debits vs 0 credits -> +10,000.000 net open debit
    { id: 9, partnerId: 103, accountId: 129, residualKwd: 6000.0, dateMaturity: '2026-08-25', date: '2026-08-10' },
    { id: 10, partnerId: 103, accountId: 129, residualKwd: 4000.0, dateMaturity: '2026-10-12', date: '2026-10-05' },

    // POS Cashier Clearing (explicit accountId === 35): +85,000.000 debits vs -85,992.319 credits -> -992.319 net
    { id: 11, partnerId: 0, accountId: POS_CLEARING_ACCOUNT_ID, residualKwd: 85000.0, dateMaturity: '2026-06-01', date: '2026-06-01' },
    { id: 12, partnerId: 0, accountId: POS_CLEARING_ACCOUNT_ID, residualKwd: -85992.319, dateMaturity: null, date: '2026-11-19' },
  ]

  const partnerGroups: UnifiedReceivablePartnerGroup[] = [
    {
      partnerId: 101,
      accountId: 121,
      residualKwd: 18168.351,
      linesCount: 5,
      oldestDueDate: '2026-08-15',
      oldestPostingDate: '2026-08-01',
    },
    {
      partnerId: 102,
      accountId: 122,
      residualKwd: -1351.372,
      linesCount: 3,
      oldestDueDate: '2026-07-20',
      oldestPostingDate: '2026-07-10',
    },
    {
      partnerId: 103,
      accountId: 129,
      residualKwd: 10000.0,
      linesCount: 2,
      oldestDueDate: '2026-08-25',
      oldestPostingDate: '2026-08-10',
    },
    {
      partnerId: 0,
      accountId: POS_CLEARING_ACCOUNT_ID,
      residualKwd: -992.319,
      linesCount: 2,
      oldestDueDate: '2026-06-01',
      oldestPostingDate: '2026-06-01',
    },
  ]

  return { lines, partnerGroups }
}

describe('Receivable Aging Unification & Explicit POS_CLEARING_ACCOUNT_ID = 35 Fail-Closed', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  it('nets unapplied credits FIFO per (partner_id, account_id), isolates accountId: 35, and reconciles bucket sum to exact 28,168.351 KWD (never 1,077,552.499 or 969,294.512)', () => {
    const { lines, partnerGroups } = buildProductionMirrorLedger()

    // Confirm raw un-netted customer positive lines equal the historical inflated totals:
    const nonPosPositiveLines = lines.filter(
      (l) => l.accountId !== POS_CLEARING_ACCOUNT_ID && l.residualKwd > 0,
    )
    const rawPositiveTotal = round3(nonPosPositiveLines.reduce((s, l) => s + l.residualKwd, 0))
    const rawOver30Total = round3(
      nonPosPositiveLines
        .filter((l) => (l.dateMaturity ?? l.date) < '2026-10-21')
        .reduce((s, l) => s + l.residualKwd, 0),
    )
    expect(rawPositiveTotal).toBe(1077552.499)
    expect(rawOver30Total).toBe(969294.512)

    // 1. Unified aging from partnerGroups + open lines:
    const unified = computeUnifiedReceivableAging({
      todayIso: TODAY_ISO,
      partnerGroups,
      lines,
    })

    expect(unified.failClosed).toBe(false)
    expect(unified.buckets.map((b) => b.key)).toEqual(['0_7', '8_30', '31_60', 'over_60'])
    expect(AR_AGING_BUCKETS.map((b) => b.key)).toEqual(['0_7', '8_30', '31_60', 'over_60'])

    const bucketByKey = Object.fromEntries(unified.buckets.map((b) => [b.key, b.positiveDebitKwd]))
    expect(bucketByKey).toEqual({
      '0_7': 12450.2,
      '8_30': 5718.151,
      '31_60': 4000.0,
      over_60: 6000.0,
    })

    const bucketPositiveSum = round3(unified.buckets.reduce((s, b) => s + b.positiveDebitKwd, 0))
    const bucketResidualSum = round3(unified.buckets.reduce((s, b) => s + b.residualKwd, 0))
    expect(bucketPositiveSum).toBe(28168.351)
    expect(bucketResidualSum).toBe(28168.351)
    expect(unified.openDebitsKwd).toBe(28168.351)
    expect(unified.unappliedCreditsKwd).toBe(-1351.372)
    expect(unified.openReceivableKwd).toBe(26816.979)
    expect(unified.posClearingResidualKwd).toBe(-992.319)

    const overdueOver30Kwd = round3((bucketByKey['31_60'] ?? 0) + (bucketByKey.over_60 ?? 0))
    expect(overdueOver30Kwd).toBe(10000.0)
    expect(overdueOver30Kwd).not.toBe(969294.512)
    expect(bucketPositiveSum).not.toBe(1077552.499)

    const tieOut = buildArTieOut({
      openDebitsKwd: unified.openDebitsKwd,
      unappliedCreditsKwd: unified.unappliedCreditsKwd,
      openReceivableKwd: unified.openReceivableKwd,
    })
    expect(tieOut?.ties).toBe(true)
    expect(tieOut?.differenceKwd).toBe(0)

    // 2. Unified aging from raw lines alone yields the identical 28,168.351 KWD result:
    const fromLinesOnly = computeUnifiedReceivableAging({
      todayIso: TODAY_ISO,
      lines,
    })
    expect(fromLinesOnly.openDebitsKwd).toBe(28168.351)
    expect(round3(fromLinesOnly.buckets.reduce((s, b) => s + b.positiveDebitKwd, 0))).toBe(28168.351)
    expect(fromLinesOnly.unappliedCreditsKwd).toBe(-1351.372)
    expect(fromLinesOnly.posClearingResidualKwd).toBe(-992.319)

    // 3. Clean fallback to partnerGroups dates when line rows are empty:
    const fallbackFromGroups = computeUnifiedReceivableAging({
      todayIso: TODAY_ISO,
      partnerGroups,
      lines: [],
    })
    expect(fallbackFromGroups.openDebitsKwd).toBe(28168.351)
    expect(round3(fallbackFromGroups.buckets.reduce((s, b) => s + b.positiveDebitKwd, 0))).toBe(28168.351)
  })

  it('isolates POS clearing strictly by POS_CLEARING_ACCOUNT_ID = 35 without accountCode string guessing', () => {
    expect(POS_CLEARING_ACCOUNT_ID).toBe(35)

    // Account 35 is excluded even if renamed; account 777 with code "10552" is NOT excluded as POS clearing
    expect(
      openReceivableLineIncluded({
        accountId: 35,
        accountCode: '99999',
        accountType: 'asset_receivable',
        moveType: 'entry',
        parentState: 'posted',
        reconciled: false,
      }),
    ).toBe(false)
    expect(
      openReceivableLineIncluded({
        accountId: 777,
        accountCode: '10552',
        accountType: 'asset_receivable',
        moveType: 'entry',
        parentState: 'posted',
        reconciled: false,
      }),
    ).toBe(true)

    const split = receivablesCustomerSplit([
      {
        accountId: 121,
        accountCode: '10501',
        accountName: 'Talabat',
        labelAr: 'طلبات',
        labelEn: 'Talabat',
        residualKwd: 20000,
        linesCount: 5,
      },
      {
        accountId: 777,
        accountCode: '10552',
        accountName: 'Non-35 Receivable',
        labelAr: 'ذمم',
        labelEn: 'Non-35 Receivable',
        residualKwd: 8168.351,
        linesCount: 2,
      },
      {
        accountId: POS_CLEARING_ACCOUNT_ID,
        accountCode: '99999',
        accountName: 'Renamed POS Dump',
        labelAr: 'مقاصة',
        labelEn: 'Renamed POS Dump',
        residualKwd: -992.319,
        linesCount: 40,
      },
    ])
    expect(split.failClosed).toBe(false)
    expect(split.platformNetKwd).toBe(28168.351)
    expect(split.posClearingResidualKwd).toBe(-992.319)
  })

  it('enforces Fail-Closed + structured logger.error when accountId is missing, null, 0, negative, float, or NaN', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const invalidIds: Array<number | null | undefined> = [undefined, null, 0, -35, 35.5, Number.NaN]

    for (const invalidId of invalidIds) {
      errorSpy.mockClear()
      const agingRes = computeUnifiedReceivableAging({
        todayIso: TODAY_ISO,
        partnerGroups: [
          { partnerId: 101, accountId: 121, residualKwd: 28168.351, linesCount: 2, oldestDueDate: '2026-11-10' },
          { partnerId: 0, accountId: invalidId, residualKwd: -992.319, linesCount: 4, oldestDueDate: '2026-06-01' },
        ],
      })
      expect(agingRes.failClosed).toBe(true)
      expect(agingRes.buckets).toEqual([])
      expect(agingRes.openDebitsKwd).toBe(0)
      expect(errorSpy).toHaveBeenCalledWith(
        'receivable_aging_fail_closed_unverified_account_id',
        expect.objectContaining({ stage: 'partnerGroups', unverifiedCount: 1 }),
      )

      expect(() =>
        computeUnifiedReceivableAging({
          todayIso: TODAY_ISO,
          lines: [{ partnerId: 101, accountId: invalidId, residualKwd: 500, dateMaturity: null, date: '2026-11-10' }],
          throwOnUnverifiedAccountId: true,
        }),
      ).toThrow(UnverifiedReceivableAccountError)

      errorSpy.mockClear()
      const splitRes = receivablesCustomerSplit([
        {
          accountId: invalidId,
          accountCode: '10552',
          accountName: 'POS Clearing',
          labelAr: 'مقاصة',
          labelEn: 'POS Clearing',
          residualKwd: -992.319,
          linesCount: 4,
        },
      ])
      expect(splitRes.failClosed).toBe(true)
      expect(splitRes.splitKnown).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith(
        'receivables_customer_split_fail_closed_unverified_account_id',
        expect.objectContaining({ stage: 'accounts', unverifiedRowCount: 1 }),
      )

      expect(
        customerReceivableNetKwd({
          openReceivableKwd: 28168.351,
          byAccount: [
            {
              accountId: invalidId as number,
              accountCode: '10552',
              accountName: 'POS Clearing',
              labelAr: 'مقاصة',
              labelEn: 'POS Clearing',
              residualKwd: -992.319,
              linesCount: 4,
            },
          ],
        }),
      ).toBeNull()

      const figs = customerReceivableFigures({
        openReceivableKwd: 28168.351,
        byAccount: [
          {
            accountId: invalidId as number,
            accountCode: '10552',
            accountName: 'POS Clearing',
            labelAr: 'مقاصة',
            labelEn: 'POS Clearing',
            residualKwd: -992.319,
            linesCount: 4,
          },
        ],
      })
      expect(figs.netKwd).toBeNull()
      expect(figs.openDebitsKwd).toBeNull()

      errorSpy.mockClear()
      const partnerRows = buildReceivablePartnerRows([
        {
          partnerId: 101,
          partnerName: 'Talabat',
          accountId: invalidId,
          accountLabel: '10501 Talabat',
          residualKwd: 1000,
          linesCount: 2,
          oldestPostingDate: '2026-11-01',
        },
      ])
      expect(partnerRows).toEqual([])
      expect(errorSpy).toHaveBeenCalledWith(
        'receivable_partner_rows_fail_closed_unverified_account_id',
        expect.objectContaining({ unverifiedRowCount: 1 }),
      )
    }
  })

  it('end-to-end fetchLiveOdooSnapshot paginates net-positive debtor lines, reconciles Decision Room to 28,168.351 KWD, and fails closed on missing account_id', async () => {
    const saved: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}
    for (const key of ODOO_ENV_KEYS) saved[key] = process.env[key]
    process.env.ODOO_URL = 'https://localhost:8069'
    process.env.ODOO_DB = 'vf_test'
    process.env.ODOO_USERNAME = 'bi@example.com'
    process.env.ODOO_API_KEY = 'test_key'

    try {
      // Build 505 open lines for Partner 101 across 2 pages (500 + 5) plus Partner 103 & Partner 102
      const paginatedLines: Array<{
        id: number
        partner_id: [number, string]
        account_id: [number, string]
        amount_residual: number
        date_maturity: string | false
        date: string
      }> = []
      // 500 historical >60d invoice lines of 1,240.000 KWD = 620,000.000 KWD
      for (let i = 1; i <= 500; i++) {
        paginatedLines.push({
          id: i,
          partner_id: [101, 'Talabat'],
          account_id: [121, '10501 Talabat Receivable'],
          amount_residual: 1240.0,
          date_maturity: '2026-08-15',
          date: '2026-08-01',
        })
      }
      paginatedLines.push(
        {
          id: 501,
          partner_id: [101, 'Talabat'],
          account_id: [121, '10501 Talabat Receivable'],
          amount_residual: 149294.512,
          date_maturity: '2026-10-10',
          date: '2026-10-01',
        },
        {
          id: 502,
          partner_id: [101, 'Talabat'],
          account_id: [121, '10501 Talabat Receivable'],
          amount_residual: 50000.0,
          date_maturity: '2026-11-05',
          date: '2026-11-01',
        },
        {
          id: 503,
          partner_id: [101, 'Talabat'],
          account_id: [121, '10501 Talabat Receivable'],
          amount_residual: 12450.2,
          date_maturity: '2026-11-19',
          date: '2026-11-18',
        },
        {
          id: 504,
          partner_id: [101, 'Talabat'],
          account_id: [121, '10501 Talabat Receivable'],
          amount_residual: -813576.361,
          date_maturity: false,
          date: '2026-11-15',
        },
        {
          id: 505,
          partner_id: [103, 'Corporate Catering'],
          account_id: [129, '121000 Trade Receivable'],
          amount_residual: 6000.0,
          date_maturity: '2026-08-25',
          date: '2026-08-10',
        },
        {
          id: 506,
          partner_id: [103, 'Corporate Catering'],
          account_id: [129, '121000 Trade Receivable'],
          amount_residual: 4000.0,
          date_maturity: '2026-10-12',
          date: '2026-10-05',
        },
      )

      let injectMissingAccountId = false
      let searchReadPageCalls = 0

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const rpcOk = (result: unknown) =>
          new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })

        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcOk(7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const callArgs = (args[5] as unknown[] | undefined) ?? []
        const kwargs = (args[6] as Record<string, unknown> | undefined) ?? {}

        if (model === 'pos.config' && method === 'search_read') {
          return rpcOk([{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'res.users' && method === 'read') {
          return rpcOk([{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.order' && method === 'search_read') {
          return rpcOk([
            {
              id: 1,
              date_order: '2026-11-20 09:00:00',
              amount_total: 250,
              config_id: [8, 'Promenade 1'],
              company_id: [1, 'Venture Foods'],
            },
          ])
        }
        if (model === 'account.move.line' && method === 'read_group') {
          const groupBy = (callArgs[2] as string[] | undefined) ?? []
          if (groupBy.includes('partner_id')) {
            return rpcOk([
              {
                partner_id: [101, 'Talabat'],
                account_id: injectMissingAccountId ? false : [121, '10501 Talabat Receivable'],
                amount_residual: 18168.351,
                __count: 504,
                date_min: '2026-08-01',
                date_maturity_min: '2026-08-15',
              },
              {
                partner_id: [102, 'Deliveroo'],
                account_id: [122, '10502 Deliveroo Receivable'],
                amount_residual: -1351.372,
                __count: 3,
                date_min: '2026-07-10',
                date_maturity_min: '2026-07-20',
              },
              {
                partner_id: [103, 'Corporate Catering'],
                account_id: [129, '121000 Trade Receivable'],
                amount_residual: 10000.0,
                __count: 2,
                date_min: '2026-08-10',
                date_maturity_min: '2026-08-25',
              },
              {
                partner_id: false,
                account_id: [POS_CLEARING_ACCOUNT_ID, '10552 Account Receivable (PoS)'],
                amount_residual: -992.319,
                __count: 20,
                date_min: '2026-06-01',
                date_maturity_min: '2026-06-01',
              },
            ])
          }
          const domainStr = JSON.stringify(callArgs[0] ?? [])
          if (domainStr.includes('asset_receivable')) {
            return rpcOk([
              { account_id: [121, '10501 Talabat Receivable'], amount_residual: 18168.351, __count: 504 },
              { account_id: [122, '10502 Deliveroo Receivable'], amount_residual: -1351.372, __count: 3 },
              { account_id: [129, '121000 Trade Receivable'], amount_residual: 10000.0, __count: 2 },
              {
                account_id: [POS_CLEARING_ACCOUNT_ID, '10552 Account Receivable (PoS)'],
                amount_residual: -992.319,
                __count: 20,
              },
            ])
          }
          return rpcOk([])
        }
        if (model === 'account.move.line' && method === 'search_read') {
          const fields = (kwargs.fields as string[] | undefined) ?? []
          if (fields.includes('amount_residual')) {
            searchReadPageCalls += 1
            const offset = Number(kwargs.offset ?? 0)
            const limit = Number(kwargs.limit ?? 500)
            return rpcOk(paginatedLines.slice(offset, offset + limit))
          }
          if (kwargs.order === 'date asc') return rpcOk([{ date: '2026-07-10' }])
          if (kwargs.order === 'date desc') return rpcOk([{ date: '2026-11-19' }])
          return rpcOk([{ date_maturity: '2026-11-19' }])
        }
        return rpcOk([])
      })

      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      const snapshot = await fetchLiveOdooSnapshot({
        period: 'today',
        forceRefresh: true,
        referenceNowMs: REF_NOW_MS,
      })

      expect(searchReadPageCalls).toBe(2)
      const ar = snapshot.aggregatorReceivables
      expect(ar?.readable).toBe(true)
      expect(ar?.openDebitsKwd).toBe(28168.351)
      expect(ar?.platformOpenDebitsKwd).toBe(28168.351)
      expect(ar?.unappliedCreditsKwd).toBe(-1351.372)
      expect(ar?.platformUnappliedCreditsKwd).toBe(-1351.372)
      expect(ar?.posClearingResidualKwd).toBe(-992.319)

      const bucketSum = round3((ar?.agingBuckets ?? []).reduce((s, b) => s + b.positiveDebitKwd, 0))
      expect(bucketSum).toBe(28168.351)

      // Decision Room finding uses the exact unified 28,168.351 KWD open debits and 10,000.000 KWD >30d:
      const liveSummaryForDecisions: OdooLiveSummary = {
        ...(snapshot.summary ?? {
          source: 'live',
          connected: true,
          syncedAt: '2026-11-20T11:30:00.000Z',
          period: { from: '2026-11-01', to: '2026-11-20' },
          database: null,
          totals: { netSalesKwd: 250, orders: 5, aovKwd: 50 },
          brands: [],
          branches: [],
          channels: [],
        }),
        connected: true,
        noData: false,
        aggregatorReceivables: ar,
      }
      const decisions = buildLiveDecisionSnapshotFromSummary(liveSummaryForDecisions)
      expect(decisions.available).toBe(true)
      const serializedDecisions = JSON.stringify(decisions)
      expect(serializedDecisions).toContain('28,168.351')
      expect(serializedDecisions).toContain('10,000.000')
      expect(serializedDecisions).not.toContain('1,077,552')
      expect(serializedDecisions).not.toContain('1077552')
      expect(serializedDecisions).not.toContain('969,294')
      expect(serializedDecisions).not.toContain('969294')

      // Now inject missing account_id in partnerGroups -> connector fails closed cleanly
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
      injectMissingAccountId = true
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      const failedClosedSnapshot = await fetchLiveOdooSnapshot({
        period: 'today',
        forceRefresh: true,
        referenceNowMs: REF_NOW_MS,
      })
      expect(failedClosedSnapshot.aggregatorReceivables).toBeNull()
      expect(failedClosedSnapshot.unavailableSections).toContain('receivables')
      expect(errorSpy).toHaveBeenCalledWith(
        'odoo_receivables_fail_closed_unverified_account_id',
        expect.objectContaining({ stage: 'partnerGroups', unverifiedCount: 1 }),
      )
    } finally {
      for (const key of ODOO_ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]
      }
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    }
  })
})
