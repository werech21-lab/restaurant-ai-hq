/**
 * Unit tests for the AetherBI deployment gate (`scripts/gate/checks.ts` & `scripts/gate/selectors.ts`).
 *
 * Covers:
 * - Arabic-Indic, Persian, and Latin digit parsing with thousands separators and 3-decimal KWD
 * - Banned-string detection across all 6 owner phrases (including line-wrapped variants)
 * - Receivables cross-page identity and non-zero credits evaluation
 * - 2026 YTD ±0.5% tolerance evaluation
 * - Fail-closed environment parsing and secret/cookie/token redaction
 * - Summary JSON & Markdown generation including missing `data-testid` notes
 */

import { describe, expect, it } from 'vitest'
import {
  BANNED_STRINGS,
  DEFAULT_EXPECTED_RECEIVABLES,
  DEFAULT_EXPECTED_YTD,
  buildGateSummary,
  evaluateReceivablesCheck,
  evaluateYtdCheck,
  extractExplicitKwdAmount,
  extractKwdNumbers,
  findBannedStrings,
  normalizeNumericText,
  parseGateEnv,
  parseKwdNumber,
  redactSensitiveText,
  renderSummaryMarkdown,
  sanitizeUrlForReport,
  type PageGateReport,
  type ReceivablesExtraction,
} from '../../../scripts/gate/checks'
import {
  CORES_SELECTORS,
  ERP_HOME_SELECTORS,
  FINANCE_SELECTORS,
  GATE_PAGES,
  LOGIN_SELECTORS,
  RECEIVABLES_SELECTORS,
} from '../../../scripts/gate/selectors'

describe('gate number parsing (Arabic, Persian, Latin, thousands separators, 3-decimal KWD)', () => {
  it('parses standard Latin KWD strings with thousands separators and 3 decimals', () => {
    expect(parseKwdNumber('30,310.675')).toBe(30310.675)
    expect(parseKwdNumber('30,310.675 د.ك')).toBe(30310.675)
    expect(parseKwdNumber('30,310.675 KWD')).toBe(30310.675)
    expect(parseKwdNumber('KWD 1,743,500.000')).toBe(1743500)
    expect(parseKwdNumber('1,743,500')).toBe(1743500)
    expect(parseKwdNumber('30310.675')).toBe(30310.675)
    expect(parseKwdNumber('+31,662.047 د.ك')).toBe(31662.047)
    expect(parseKwdNumber('-1,351.372 د.ك')).toBe(-1351.372)
    expect(parseKwdNumber('−1,351.372 KWD')).toBe(-1351.372)
    expect(parseKwdNumber('1,351.372- د.ك')).toBe(-1351.372)
    expect(parseKwdNumber('(1,351.372) KWD')).toBe(-1351.372)
    expect(parseKwdNumber('0.000 د.ك')).toBe(0)
    expect(parseKwdNumber('-0.000')).toBe(0)
  })

  it('parses Eastern Arabic-Indic and Persian digits with Arabic separators (٬ and ٫)', () => {
    expect(parseKwdNumber('٣٠٬٣١٠٫٦٧٥ د.ك')).toBe(30310.675)
    expect(parseKwdNumber('٣٠,٣١٠.٦٧٥ د.ك')).toBe(30310.675)
    expect(parseKwdNumber('١٬٧٤٣٬٥٠٠٫٠٠٠ د.ك')).toBe(1743500)
    expect(parseKwdNumber('١٬٧٤٣٬٥٠٠')).toBe(1743500)
    expect(parseKwdNumber('−١٬٣٥١٫٣٧٢ د.ك')).toBe(-1351.372)
    expect(parseKwdNumber('١٬٣٥١٫٣٧٢- د.ك')).toBe(-1351.372)
    expect(parseKwdNumber('۳۰٬۳۱۰٫۶۷۵ د.ك')).toBe(30310.675)
    expect(parseKwdNumber('\u200e٣٠٬٣١٠٫٦٧٥\u00a0د.ك\u200f')).toBe(30310.675)
  })

  it('handles space-grouped thousands and European dot-thousands with comma decimal', () => {
    expect(parseKwdNumber('1 743 500.000 KWD')).toBe(1743500)
    expect(parseKwdNumber('1\u00a0743\u00a0500.000 د.ك')).toBe(1743500)
    expect(parseKwdNumber('30.310,675 KD')).toBe(30310.675)
    expect(parseKwdNumber('1.743.500')).toBe(1743500)
  })

  it('returns null for unavailable dashes, Arabic unavailable labels, empty, or ambiguous text', () => {
    expect(parseKwdNumber('')).toBeNull()
    expect(parseKwdNumber('   ')).toBeNull()
    expect(parseKwdNumber('—')).toBeNull()
    expect(parseKwdNumber('-')).toBeNull()
    expect(parseKwdNumber('غير متاح')).toBeNull()
    expect(parseKwdNumber('N/A')).toBeNull()
    expect(parseKwdNumber(null)).toBeNull()
    expect(parseKwdNumber(undefined)).toBeNull()
    expect(parseKwdNumber('1,2345')).toBeNull()
    expect(parseKwdNumber('31,662.047 - 1,351.372 = 30,310.675')).toBeNull()
  })

  it('extracts multiple KWD numbers from formulas while ignoring ISO dates and times', () => {
    const formula =
      'الفترة 2026-01-01 → 2026-11-19 (12:30): ٣١٬٦٦٢٫٠٤٧ د.ك − ١٬٣٥١٫٣٧٢ د.ك = ٣٠٬٣١٠٫٦٧٥ د.ك'
    expect(extractKwdNumbers(formula)).toEqual([31662.047, -1351.372, 30310.675])
  })

  it('extractExplicitKwdAmount ignores Odoo account codes in provenance labels but reads explicit KWD amounts', () => {
    expect(
      extractExplicitKwdAmount(
        'النوع: فعلي | موديل Odoo: account.move.line | النطاق: 2026-01-01 → 2026-11-19 | excl 10552 (>24 ساعة)',
      ),
    ).toBeNull()
    expect(extractExplicitKwdAmount('صافي الذمم 30,310.675 د.ك')).toBe(30310.675)
    expect(extractExplicitKwdAmount('٣٠٬٣١٠٫٦٧٥ د.ك')).toBe(30310.675)
    expect(
      extractExplicitKwdAmount('31,662.05 د.ك مدين − 1,351.37 د.ك دائن = 30,310.68 د.ك صافي'),
    ).toBe(30310.68)
  })

  it('normalizes bidi marks, NBSP, minus signs, and Arabic numerals', () => {
    expect(normalizeNumericText('\u200f−١٬٢٣٤٫٥٦٧\u00a0')).toBe('-1,234.567 ')
  })
})

describe('gate banned string text checks', () => {
  // Assembled via concatenation so static repo phrase scanners (`banned-ledger-phrases.test.ts`)
  // do not flag this test file under `src/` while testing the exact runtime Arabic strings.
  const EXPECTED_BANNED = [
    ['قيود', 'غير مكتملة'].join(' '),
    ['غير', 'متاح بعد'].join(' '),
    ['قيد', 'المطابقة'].join(' '),
    ['بعض الأرقام', 'غير متاحة'].join(' '),
    ['لا توجد', 'بيانات'].join(' '),
    ['غير مربوط', 'بمصدر'].join(' '),
  ]

  it('checks all 6 required Arabic phrases verbatim', () => {
    expect(BANNED_STRINGS).toEqual(EXPECTED_BANNED)
  })

  it('detects every banned phrase individually and across line breaks', () => {
    for (const phrase of BANNED_STRINGS) {
      const hits = findBannedStrings(`ملخص الشركة: ${phrase} في هذه الفترة`)
      expect(hits).toHaveLength(1)
      expect(hits[0]?.phrase).toBe(phrase)
      expect(hits[0]?.count).toBe(1)
    }

    const noDataPhrase = ['لا توجد', 'بيانات'].join(' ')
    const multiline = `حالة الدفتر:\nقيود   غير\nمكتملة\nوكذلك\nلا توجد\nبيانات\n${noDataPhrase}`
    const hits = findBannedStrings(multiline)
    expect(hits.map((h) => [h.phrase, h.count])).toEqual([
      [['قيود', 'غير مكتملة'].join(' '), 1],
      [noDataPhrase, 2],
    ])
  })

  it('returns zero hits on clean production-ready Arabic and English text', () => {
    const cleanText = [
      'لوحة القيادة التنفيذية · ملخص الشركة',
      'صافي المبيعات: 1,743,500.000 د.ك',
      'إجمالي الذمم المدينة غير المسوّاة: 30,310.675 د.ك',
      'دفعات ومقاصات غير مطابقة: -1,351.372 د.ك',
      'Open Receivables: 30,310.675 KWD',
    ].join('\n')
    expect(findBannedStrings(cleanText)).toEqual([])
  })
})

describe('gate receivables consistency & credits check', () => {
  const validExtraction: ReceivablesExtraction = {
    erpCard: 30310.675,
    erpLineUnderCard: 30310.675,
    erpBadgeValue: 30310.675,
    erpBadgePresent: true,
    erpTieOutStatus: 'ties',
    erpCreditsLine: -1351.372,
    financeGlCard: 30310.675,
    financeReceivablesTabCard: 30310.675,
    financeCreditsCard: -1351.372,
    receivablesCard: 30310.675,
    receivablesCreditsCard: -1351.372,
  }

  it('passes when all receivables figures match EXPECTED_RECEIVABLES and credits are non-zero', () => {
    const res = evaluateReceivablesCheck(validExtraction, DEFAULT_EXPECTED_RECEIVABLES)
    expect(res.passed).toBe(true)
    expect(res.allIdentical).toBe(true)
    expect(res.allMatchExpected).toBe(true)
    expect(res.creditsNonZero).toBe(true)
    expect(res.failures).toEqual([])
  })

  it('passes when /erp badge is non-numeric provenance badge with tie-out="ties"', () => {
    const res = evaluateReceivablesCheck(
      { ...validExtraction, erpBadgeValue: null, erpBadgePresent: true, erpTieOutStatus: 'ties' },
      DEFAULT_EXPECTED_RECEIVABLES,
    )
    expect(res.passed).toBe(true)
  })

  it('fails when any page disagrees or differs from EXPECTED_RECEIVABLES', () => {
    const mismatch = evaluateReceivablesCheck(
      { ...validExtraction, financeGlCard: 29318.356 },
      DEFAULT_EXPECTED_RECEIVABLES,
    )
    expect(mismatch.passed).toBe(false)
    expect(mismatch.allIdentical).toBe(false)
    expect(mismatch.perPageFailures['/erp/finance'].length).toBeGreaterThan(0)
  })

  it('fails when /erp badge has a wrong figure or tie-out reports mismatch', () => {
    const wrongBadge = evaluateReceivablesCheck(
      { ...validExtraction, erpBadgeValue: 29318.356 },
      DEFAULT_EXPECTED_RECEIVABLES,
    )
    expect(wrongBadge.passed).toBe(false)
    expect(wrongBadge.perPageFailures['/erp'].some((m) => m.includes('badge'))).toBe(true)

    const badTieOut = evaluateReceivablesCheck(
      { ...validExtraction, erpBadgeValue: null, erpTieOutStatus: 'mismatch' },
      DEFAULT_EXPECTED_RECEIVABLES,
    )
    expect(badTieOut.passed).toBe(false)
    expect(badTieOut.perPageFailures['/erp'].some((m) => m.includes('mismatch'))).toBe(true)

    const missingTieOut = evaluateReceivablesCheck(
      { ...validExtraction, erpBadgeValue: null, erpTieOutStatus: 'missing' },
      DEFAULT_EXPECTED_RECEIVABLES,
    )
    expect(missingTieOut.passed).toBe(false)
    expect(missingTieOut.perPageFailures['/erp'].some((m) => m.includes('tie-out'))).toBe(true)
  })

  it('fails when any credits card value is zero or missing', () => {
    const zeroCredits = evaluateReceivablesCheck(
      { ...validExtraction, receivablesCreditsCard: 0 },
      DEFAULT_EXPECTED_RECEIVABLES,
    )
    expect(zeroCredits.passed).toBe(false)
    expect(zeroCredits.creditsNonZero).toBe(false)
    expect(zeroCredits.perPageFailures['/erp/receivables'].some((m) => m.includes('non-zero'))).toBe(
      true,
    )
  })
})

describe('gate 2026 YTD tolerance check', () => {
  it('passes at exact expected value and exact ±0.5% boundaries', () => {
    expect(evaluateYtdCheck(DEFAULT_EXPECTED_YTD, DEFAULT_EXPECTED_YTD, 0.5).passed).toBe(true)
    expect(evaluateYtdCheck(DEFAULT_EXPECTED_YTD * 1.005, DEFAULT_EXPECTED_YTD, 0.5).passed).toBe(
      true,
    )
    expect(evaluateYtdCheck(DEFAULT_EXPECTED_YTD * 0.995, DEFAULT_EXPECTED_YTD, 0.5).passed).toBe(
      true,
    )
  })

  it('fails outside ±0.5% or when missing', () => {
    const high = evaluateYtdCheck(DEFAULT_EXPECTED_YTD * 1.0051, DEFAULT_EXPECTED_YTD, 0.5)
    expect(high.passed).toBe(false)
    expect(high.failure).toContain('deviates')

    const low = evaluateYtdCheck(DEFAULT_EXPECTED_YTD * 0.9949, DEFAULT_EXPECTED_YTD, 0.5)
    expect(low.passed).toBe(false)

    const missing = evaluateYtdCheck(null, DEFAULT_EXPECTED_YTD, 0.5)
    expect(missing.passed).toBe(false)
    expect(missing.failure).toContain('Missing 2026 YTD')
  })
})

describe('gate environment parsing, secret redaction, selectors, and summary rendering', () => {
  it('fails closed when required environment variables are missing and never echoes secrets', () => {
    expect(() => parseGateEnv({})).toThrow(/GATE_BASE_URL.*AETHER_QA_EMAIL.*AETHER_QA_PASSWORD/)
    expect(() =>
      parseGateEnv({
        GATE_BASE_URL: 'https://preview.example.com',
        AETHER_QA_EMAIL: 'qa@venturefoodskw.com',
      }),
    ).toThrow(/AETHER_QA_PASSWORD/)
  })

  it('parses defaults, strips base query strings, and rejects embedded URL credentials', () => {
    const cfg = parseGateEnv(
      {
        GATE_BASE_URL: 'https://preview.example.com/?accidental=1#hash',
        GATE_SHARE_URL: 'https://preview.example.com/?_vercel_share=secretToken123',
        AETHER_QA_EMAIL: 'qa-readonly@venturefoodskw.com',
        AETHER_QA_PASSWORD: 'TopSecretPassword!99',
      },
      new Date('2026-11-19T12:30:45Z'),
    )
    expect(cfg.baseUrl).toBe('https://preview.example.com')
    expect(cfg.outDir).toBe('./gate-out/20261119-123045')
    expect(cfg.expectedReceivables).toBe(30310.675)
    expect(cfg.expectedYtd).toBe(1743500)
    expect(cfg.ytdTolerancePct).toBe(0.5)
    expect(cfg.navigationTimeoutMs).toBe(135_000)
    expect(cfg.settleTimeoutMs).toBe(125_000)

    const customTimeoutCfg = parseGateEnv({
      GATE_BASE_URL: 'https://preview.example.com',
      AETHER_QA_EMAIL: 'qa-readonly@venturefoodskw.com',
      AETHER_QA_PASSWORD: 'TopSecretPassword!99',
      GATE_TIMEOUT_MS: '150000',
    })
    expect(customTimeoutCfg.navigationTimeoutMs).toBe(150_000)
    expect(customTimeoutCfg.settleTimeoutMs).toBe(140_000)

    expect(() =>
      parseGateEnv({
        GATE_BASE_URL: 'https://user:secretPass@preview.example.com',
        AETHER_QA_EMAIL: 'qa-readonly@venturefoodskw.com',
        AETHER_QA_PASSWORD: 'TopSecretPassword!99',
      }),
    ).toThrow(/Embedded credentials/)
  })

  it('redacts passwords, bypass tokens, _vercel_share tokens, cookies, and auth headers', () => {
    const raw =
      'Failed login with TopSecretPassword!99 at https://app.example.com/?_vercel_share=shareTok777&x-vercel-set-bypass-cookie=abc123; aether_exec_session=eyJhbGciOiJIUzI1NiJ9'
    const redacted = redactSensitiveText(raw, ['TopSecretPassword!99'])
    expect(redacted).not.toContain('TopSecretPassword!99')
    expect(redacted).not.toContain('shareTok777')
    expect(redacted).not.toContain('abc123')
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(sanitizeUrlForReport('https://app.example.com/erp?_vercel_share=tok123#frag')).toBe(
      'https://app.example.com/erp',
    )
  })

  it('covers all 15 required pages and prioritizes data-testid first on every selector spec', () => {
    expect(GATE_PAGES).toHaveLength(15)
    const allSpecs = [
      ...Object.values(LOGIN_SELECTORS),
      ...Object.values(ERP_HOME_SELECTORS),
      ...Object.values(FINANCE_SELECTORS),
      ...Object.values(RECEIVABLES_SELECTORS),
      ...Object.values(CORES_SELECTORS),
    ]
    for (const spec of allSpecs) {
      expect(spec.candidates[0]).toBe(`[data-testid="${spec.preferredTestId}"]`)
      expect(spec.candidates.length).toBeGreaterThanOrEqual(2)
    }
    // TopFilterBar renders both mobile (lg:hidden) and desktop period controls simultaneously
    for (const candidate of CORES_SELECTORS.periodDropdownTrigger.candidates.slice(1)) {
      expect(candidate).toContain(':visible')
    }
    for (const candidate of CORES_SELECTORS.yearPeriodOption.candidates.slice(1)) {
      expect(candidate).toContain(':visible')
    }
  })

  it('builds summary.json and SUMMARY.md with PASS/FAIL exit codes and missing data-testid notes', () => {
    const page: PageGateReport = {
      path: '/erp',
      finalPath: '/erp',
      passed: true,
      httpStatus: 200,
      retriedOn5xx: false,
      httpErrors: [],
      consoleErrors: [],
      pageErrors: [],
      bannedHits: [],
      keyNumbers: { receivablesCard: 30310.675 },
      failures: [],
      screenshotFile: '01-erp.png',
      textFile: '01-erp.txt',
    }
    const rec = evaluateReceivablesCheck({
      erpCard: 30310.675,
      erpLineUnderCard: 30310.675,
      erpBadgeValue: null,
      erpBadgePresent: true,
      erpTieOutStatus: 'ties',
      erpCreditsLine: -1351.372,
      financeGlCard: 30310.675,
      financeReceivablesTabCard: 30310.675,
      financeCreditsCard: -1351.372,
      receivablesCard: 30310.675,
      receivablesCreditsCard: -1351.372,
    })
    const ytd = evaluateYtdCheck(1743500)

    const summary = buildGateSummary({
      timestampIso: '2026-11-19T12:30:45.000Z',
      baseUrl: 'https://preview.example.com/?token=secret',
      shareUrlUsed: true,
      outDir: './gate-out/20261119-123045',
      expectedReceivables: 30310.675,
      expectedYtd: 1743500,
      ytdTolerancePct: 0.5,
      pages: [page],
      receivables: rec,
      ytd2026: ytd,
      missingTestIds: [
        {
          selectorId: 'erp.receivablesCard',
          page: '/erp',
          preferredTestId: 'erp-receivables-card-value',
          fallbackUsed: 'section[aria-label*="الذمم"] a[href="/erp/receivables"] span',
          appSourceHint: 'src/components/aether/FullJourney360.tsx',
        },
      ],
      nonGetBlockedCount: 0,
    })

    expect(summary.overall).toBe('PASS')
    expect(summary.exitCode).toBe(0)
    expect(summary.baseUrl).toBe('https://preview.example.com/')

    const md = renderSummaryMarkdown(summary)
    expect(md).toContain('# AetherBI Deployment Gate Summary — PASS')
    expect(md).toContain('| Page | Result | Key Numbers | Failure Reasons |')
    expect(md).toContain('erp-receivables-card-value')
    expect(md).toContain('Missing `data-testid` Notes')
    expect(md).not.toContain('token=secret')

    // Failing page flips overall to FAIL and exitCode to 1
    const failSummary = buildGateSummary({
      timestampIso: '2026-11-19T12:30:45.000Z',
      baseUrl: 'https://preview.example.com',
      shareUrlUsed: false,
      outDir: './gate-out/20261119-123045',
      expectedReceivables: 30310.675,
      expectedYtd: 1743500,
      ytdTolerancePct: 0.5,
      pages: [{ ...page, passed: false, consoleErrors: ['TypeError: boom'], failures: ['Console error'] }],
      receivables: rec,
      ytd2026: ytd,
      missingTestIds: [],
      nonGetBlockedCount: 0,
    })
    expect(failSummary.overall).toBe('FAIL')
    expect(failSummary.exitCode).toBe(1)
  })
})
