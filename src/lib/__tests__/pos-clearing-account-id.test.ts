import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyReceivablesExecutivePolicy,
  type WorkspaceReceivablesMeta,
} from '@/lib/aether/global-filter-engine'
import type { OdooReceivableAccountRow, OdooReceivablePartnerRow } from '@/lib/odoo/live-sync-core'
import { isPosClearingRow, POS_CLEARING_ACCOUNT_ID } from '@/lib/odoo/receivable-domain'

const TALABAT_ACCOUNT_ID = 101
const KEETA_ACCOUNT_ID = 105
const TRADE_RECEIVABLE_ACCOUNT_ID = 210
const OTHER_ACCOUNT_ID = 777
const UNVERIFIED_ACCOUNT_ID = 0
const NEGATIVE_ACCOUNT_ID = -POS_CLEARING_ACCOUNT_ID
const FRACTIONAL_ACCOUNT_ID = POS_CLEARING_ACCOUNT_ID + 0.5

const TALABAT_ACCOUNT_CODE = '10501'
const KEETA_ACCOUNT_CODE = '10505'
const TRADE_RECEIVABLE_ACCOUNT_CODE = '121000'
const POS_CLEARING_DISPLAY_CODE = '10552'

const TALABAT_RESIDUAL_KWD = 10.125
const KEETA_RESIDUAL_KWD = 8.25
const TRADE_RESIDUAL_KWD = 4.5
const POS_CLEARING_RESIDUAL_KWD = -1.125
const OTHER_ACCOUNT_RESIDUAL_KWD = 3.5

const KWD_FILS = 1000

function roundKwd(amount: number): number {
  return Math.round(amount * KWD_FILS) / KWD_FILS
}

function accountRow(
  accountId: number,
  accountCode: string,
  residualKwd: number,
): OdooReceivableAccountRow {
  return {
    accountId,
    accountCode,
    accountName: accountCode,
    labelAr: accountCode,
    labelEn: accountCode,
    residualKwd,
    linesCount: 1,
  }
}

function partnerRow(input: {
  partnerId: number
  accountId?: number | null
  accountCode: string
  residualKwd: number
}): OdooReceivablePartnerRow {
  return {
    partnerId: input.partnerId,
    partnerName: `Partner ${input.partnerId}`,
    accountId: input.accountId as number,
    accountCode: input.accountCode,
    accountName: input.accountCode,
    residualKwd: input.residualKwd,
    linesCount: 1,
    oldestPostingDate: '2026-11-01',
  }
}

function receivablesMeta(overrides: Partial<WorkspaceReceivablesMeta>): WorkspaceReceivablesMeta {
  return {
    unavailable: false,
    pendingReconciliation: false,
    openReceivableKwd: 0,
    grossPositiveReceivableKwd: 0,
    creditClearingOffsetKwd: 0,
    unreconciledLineCount: 0,
    posClearingLinesCount: 0,
    platformAndCorporateLinesCount: 0,
    fromDate: '2026-10-21',
    toDate: '2026-11-21',
    latestMaturityDate: null,
    maturityStatusAr: 'رصيد',
    maturityStatusEn: 'Open residual',
    openLinesExplanationAr: 'رصيد متبقٍ',
    openLinesExplanationEn: 'Open residual',
    sourceLabelAr: 'أودو',
    sourceLabelEn: 'Odoo',
    reconciliationFormulaAr: 'صيغة',
    reconciliationFormulaEn: 'formula',
    byAccount: [],
    agingBuckets: [],
    openDebitsKwd: null,
    unappliedCreditsKwd: null,
    agingHiddenReasonAr: null,
    agingHiddenReasonEn: null,
    byPartner: [],
    ...overrides,
  }
}

describe('isPosClearingRow', () => {
  it('is true only for verified account id 35', () => {
    expect(POS_CLEARING_ACCOUNT_ID).toBe(35)
    expect(isPosClearingRow({ accountId: POS_CLEARING_ACCOUNT_ID })).toBe(true)
    const clearingIdWithTradeCode = {
      accountId: POS_CLEARING_ACCOUNT_ID,
      accountCode: TALABAT_ACCOUNT_CODE,
    }
    expect(isPosClearingRow(clearingIdWithTradeCode)).toBe(true)
  })

  it('does not treat account code 10552 as clearing when the account id is not 35', () => {
    const codeWithoutClearingId = {
      accountId: OTHER_ACCOUNT_ID,
      accountCode: POS_CLEARING_DISPLAY_CODE,
    }
    expect(isPosClearingRow(codeWithoutClearingId)).toBe(false)
  })

  it('does not treat a missing or invalid account id as POS clearing', () => {
    expect(isPosClearingRow({})).toBe(false)
    expect(isPosClearingRow({ accountId: null })).toBe(false)
    expect(isPosClearingRow({ accountId: undefined })).toBe(false)
    expect(isPosClearingRow({ accountId: UNVERIFIED_ACCOUNT_ID })).toBe(false)
    expect(isPosClearingRow({ accountId: NEGATIVE_ACCOUNT_ID })).toBe(false)
    expect(isPosClearingRow({ accountId: Number.NaN })).toBe(false)
    expect(isPosClearingRow({ accountId: FRACTIONAL_ACCOUNT_ID })).toBe(false)
  })
})

describe('applyReceivablesExecutivePolicy partner filter', () => {
  const clearingPartner = partnerRow({
    partnerId: 1,
    accountId: POS_CLEARING_ACCOUNT_ID,
    accountCode: TALABAT_ACCOUNT_CODE,
    residualKwd: POS_CLEARING_RESIDUAL_KWD,
  })
  const codeWithoutClearingId = partnerRow({
    partnerId: 2,
    accountId: OTHER_ACCOUNT_ID,
    accountCode: POS_CLEARING_DISPLAY_CODE,
    residualKwd: OTHER_ACCOUNT_RESIDUAL_KWD,
  })
  const missingAccountId = partnerRow({
    partnerId: 3,
    accountId: null,
    accountCode: POS_CLEARING_DISPLAY_CODE,
    residualKwd: 1.25,
  })
  const invalidAccountId = partnerRow({
    partnerId: 4,
    accountId: Number.NaN,
    accountCode: POS_CLEARING_DISPLAY_CODE,
    residualKwd: 2.25,
  })

  it('drops account id 35 and keeps a 10552 code on any other id, including a missing id', () => {
    const out = applyReceivablesExecutivePolicy(
      receivablesMeta({
        byPartner: [clearingPartner, codeWithoutClearingId, missingAccountId, invalidAccountId],
      }),
      false,
    )
    expect(out.byPartner?.map((row) => row.partnerId)).toEqual([
      codeWithoutClearingId.partnerId,
      missingAccountId.partnerId,
      invalidAccountId.partnerId,
    ])
    expect(out.byPartner?.some((row) => row.accountId === POS_CLEARING_ACCOUNT_ID)).toBe(false)
    expect(out.byPartner?.some((row) => row.accountCode === POS_CLEARING_DISPLAY_CODE)).toBe(true)
  })

  it('nets 10501, 10505 and 121000 and leaves out the account id 35 row', () => {
    const talabat = accountRow(TALABAT_ACCOUNT_ID, TALABAT_ACCOUNT_CODE, TALABAT_RESIDUAL_KWD)
    const keeta = accountRow(KEETA_ACCOUNT_ID, KEETA_ACCOUNT_CODE, KEETA_RESIDUAL_KWD)
    const trade = accountRow(
      TRADE_RECEIVABLE_ACCOUNT_ID,
      TRADE_RECEIVABLE_ACCOUNT_CODE,
      TRADE_RESIDUAL_KWD,
    )
    const posClearing = accountRow(
      POS_CLEARING_ACCOUNT_ID,
      POS_CLEARING_DISPLAY_CODE,
      POS_CLEARING_RESIDUAL_KWD,
    )
    const customerAccounts = [talabat, keeta, trade]
    const expectedNet = roundKwd(
      customerAccounts.reduce((sum, row) => sum + row.residualKwd, 0),
    )
    const partners = customerAccounts.map((row, index) =>
      partnerRow({
        partnerId: index + 1,
        accountId: row.accountId,
        accountCode: row.accountCode,
        residualKwd: row.residualKwd,
      }),
    )
    partners.push(
      partnerRow({
        partnerId: 4,
        accountId: POS_CLEARING_ACCOUNT_ID,
        accountCode: POS_CLEARING_DISPLAY_CODE,
        residualKwd: POS_CLEARING_RESIDUAL_KWD,
      }),
    )

    const out = applyReceivablesExecutivePolicy(
      receivablesMeta({
        byAccount: [...customerAccounts, posClearing],
        byPartner: partners,
      }),
      false,
    )

    expect(out.byAccount.map((row) => row.accountCode)).toEqual([
      TALABAT_ACCOUNT_CODE,
      KEETA_ACCOUNT_CODE,
      TRADE_RECEIVABLE_ACCOUNT_CODE,
      POS_CLEARING_DISPLAY_CODE,
    ])
    expect(out.byPartner?.map((row) => row.accountId)).toEqual([
      TALABAT_ACCOUNT_ID,
      KEETA_ACCOUNT_ID,
      TRADE_RECEIVABLE_ACCOUNT_ID,
    ])
    expect(out.platformNetKwd).toBe(expectedNet)
    expect(out.figures?.netKwd).toBe(expectedNet)
    expect(out.figures?.netKwd).not.toBe(roundKwd(expectedNet + POS_CLEARING_RESIDUAL_KWD))
  })
})

describe('POS clearing call sites', () => {
  it('filters studio partners with isPosClearingRow and does not match account code 10552', () => {
    const studio = readFileSync(
      path.join(process.cwd(), 'src/components/erp/ReceivablesAgingStudio.tsx'),
      'utf8',
    )
    const policy = readFileSync(
      path.join(process.cwd(), 'src/lib/aether/global-filter-engine.ts'),
      'utf8',
    )
    expect(studio).toContain('!isPosClearingRow(row)')
    expect(studio).not.toContain('isPosClearingAccount')
    expect(policy).toContain('!isPosClearingRow(row)')
    expect(policy).not.toContain('isPosClearingAccount')
  })
})
