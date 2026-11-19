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
  isVercelToolbarNoise,
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
      ignoredToolbarNoiseCount: 0,
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
    expect(summary.ignoredToolbarNoiseCount).toBe(0)

    const md = renderSummaryMarkdown(summary)
    expect(md).toContain('# AetherBI Deployment Gate Summary — PASS')
    expect(md).toContain('| Page | Result | Key Numbers | Failure Reasons |')
    expect(md).toContain('erp-receivables-card-value')
    expect(md).toContain('Missing `data-testid` Notes')
    expect(md).toContain('ignoredToolbarNoiseCount')
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

  it('reports ignoredToolbarNoiseCount across pages, passing on toolbar-only noise and failing on real app/API errors', () => {
    const rec = evaluateReceivablesCheck({
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
    })
    const ytd = evaluateYtdCheck(1743500)

    const erpPage: PageGateReport = {
      path: '/erp',
      finalPath: '/erp',
      passed: true,
      httpStatus: 200,
      retriedOn5xx: false,
      httpErrors: [],
      consoleErrors: [],
      pageErrors: [],
      ignoredToolbarNoiseCount: 3,
      bannedHits: [],
      keyNumbers: { receivablesCard: 30310.675 },
      failures: [],
      screenshotFile: '01-erp.png',
      textFile: '01-erp.txt',
    }
    const coresPage: PageGateReport = {
      ...erpPage,
      path: '/erp/cores',
      finalPath: '/erp/cores',
      ignoredToolbarNoiseCount: 4, // includes initial visit + YTD interaction noise
      keyNumbers: { ytd2026Total: 1743500 },
    }
    const financePage: PageGateReport = {
      ...erpPage,
      path: '/erp/finance',
      finalPath: '/erp/finance',
      ignoredToolbarNoiseCount: 2, // includes initial visit + receivables tab interaction noise
    }

    const passWithToolbarNoise = buildGateSummary({
      timestampIso: '2026-11-19T12:30:45.000Z',
      baseUrl: 'https://preview.vercel.app',
      shareUrlUsed: true,
      outDir: './gate-out/20261119-123045',
      expectedReceivables: 30310.675,
      expectedYtd: 1743500,
      ytdTolerancePct: 0.5,
      pages: [erpPage, coresPage, financePage],
      receivables: rec,
      ytd2026: ytd,
      missingTestIds: [],
      nonGetBlockedCount: 2,
    })

    expect(passWithToolbarNoise.overall).toBe('PASS')
    expect(passWithToolbarNoise.exitCode).toBe(0)
    expect(passWithToolbarNoise.ignoredToolbarNoiseCount).toBe(9)
    expect(passWithToolbarNoise.conditions.httpAndConsole.passed).toBe(true)
    expect(passWithToolbarNoise.conditions.httpAndConsole.ignoredToolbarNoiseCount).toBe(9)

    const passMd = renderSummaryMarkdown(passWithToolbarNoise)
    expect(passMd).toContain('- **Ignored Vercel Toolbar Noise (`ignoredToolbarNoiseCount`):** `9`')
    expect(passMd).toContain(
      '| d | No HTTP >= 400 and no console errors | PASS | HTTP>=400: 0, console errors: 0, page errors: 0, ignored toolbar noise: 9 |',
    )

    // Real API HTTP >= 400 alongside toolbar noise MUST fail
    const failOnRealHttpError = buildGateSummary({
      timestampIso: '2026-11-19T12:30:45.000Z',
      baseUrl: 'https://preview.vercel.app',
      shareUrlUsed: true,
      outDir: './gate-out/20261119-123045',
      expectedReceivables: 30310.675,
      expectedYtd: 1743500,
      ytdTolerancePct: 0.5,
      pages: [
        erpPage,
        {
          ...financePage,
          passed: false,
          httpErrors: [
            {
              status: 500,
              method: 'GET',
              url: 'https://preview.vercel.app/api/erp/odoo-sync',
              resourceType: 'fetch',
            },
          ],
          failures: ['HTTP 500 (fetch) https://preview.vercel.app/api/erp/odoo-sync'],
        },
      ],
      receivables: rec,
      ytd2026: ytd,
      missingTestIds: [],
      nonGetBlockedCount: 0,
    })
    expect(failOnRealHttpError.overall).toBe('FAIL')
    expect(failOnRealHttpError.exitCode).toBe(1)
    expect(failOnRealHttpError.ignoredToolbarNoiseCount).toBe(5)
    expect(failOnRealHttpError.conditions.httpAndConsole.passed).toBe(false)
    expect(failOnRealHttpError.conditions.httpAndConsole.httpErrorCount).toBe(1)

    // Real app console error alongside toolbar noise MUST fail
    const failOnRealConsoleError = buildGateSummary({
      timestampIso: '2026-11-19T12:30:45.000Z',
      baseUrl: 'https://preview.vercel.app',
      shareUrlUsed: true,
      outDir: './gate-out/20261119-123045',
      expectedReceivables: 30310.675,
      expectedYtd: 1743500,
      ytdTolerancePct: 0.5,
      pages: [
        {
          ...erpPage,
          passed: false,
          consoleErrors: ["TypeError: Cannot read properties of undefined (reading 'receivables')"],
          failures: ["Console error: TypeError: Cannot read properties of undefined (reading 'receivables')"],
        },
      ],
      receivables: rec,
      ytd2026: ytd,
      missingTestIds: [],
      nonGetBlockedCount: 0,
    })
    expect(failOnRealConsoleError.overall).toBe('FAIL')
    expect(failOnRealConsoleError.exitCode).toBe(1)
    expect(failOnRealConsoleError.ignoredToolbarNoiseCount).toBe(3)
    expect(failOnRealConsoleError.conditions.httpAndConsole.passed).toBe(false)
    expect(failOnRealConsoleError.conditions.httpAndConsole.consoleErrorCount).toBe(1)
  })
})

describe('isVercelToolbarNoise strict allowlist', () => {
  it('ignores Vercel preview toolbar, feedback, Pusher WebSocket, insights, and speed-insights URLs', () => {
    expect(isVercelToolbarNoise('https://vercel.live/_next-live/feedback/feedback.js')).toBe(true)
    expect(isVercelToolbarNoise('https://vercel.live/api/feedback/threads?slug=aether')).toBe(true)
    expect(isVercelToolbarNoise('https://ws-us3.vercel.live/pusher')).toBe(true)
    expect(isVercelToolbarNoise('wss://ws-us3.vercel.live/app/key123?protocol=7')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/insights/view')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/insights/script.js')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/insights')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/speed-insights/vitals')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/speed-insights/script.js')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/speed-insights')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/toolbar/script.js')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_vercel/toolbar')).toBe(true)
    expect(isVercelToolbarNoise('https://preview.vercel.app/vercel-toolbar.js')).toBe(true)
    expect(isVercelToolbarNoise('https://assets.vercel.com/v1/vercel-toolbar.min.js')).toBe(true)
  })

  it('ignores console errors originating from vercel.live scripts or CORS/CSP/WebSocket errors targeting toolbar endpoints', () => {
    // Console errors whose `sourceUrl` (`msg.location().url`) is on `vercel.live` or `/_vercel/*`
    expect(
      isVercelToolbarNoise(
        'Uncaught Error: Feedback widget failed to initialize',
        'https://vercel.live/_next-live/feedback/feedback.js',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        'Failed to load resource: the server responded with a status of 403 ()',
        'https://vercel.live/_next-live/feedback/feedback.js',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
        'https://preview.vercel.app/_vercel/insights/view',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
        'https://preview.vercel.app/_vercel/speed-insights/vitals',
      ),
    ).toBe(true)

    // CORS / CSP / WebSocket / network load errors targeting `vercel.live` even when `sourceUrl` is the preview document
    expect(
      isVercelToolbarNoise(
        "Access to fetch at 'https://vercel.live/_next-live/feedback/feedback.js' from origin 'https://preview.vercel.app' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.",
        'https://preview.vercel.app/erp',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        "Refused to load the script 'https://vercel.live/_next-live/feedback/feedback.js' because it violates the following Content Security Policy directive: \"script-src 'self' https://preview.vercel.app\".",
        'https://preview.vercel.app/erp',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        "Refused to connect to 'wss://ws-us3.vercel.live/pusher' because it violates the following Content Security Policy directive: \"connect-src 'self' https://*.supabase.co\".",
        'https://preview.vercel.app/erp',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        "WebSocket connection to 'wss://ws-us3.vercel.live/pusher?protocol=7' failed: Error during WebSocket handshake: Unexpected response code: 403",
        'https://preview.vercel.app/erp',
      ),
    ).toBe(true)
    expect(
      isVercelToolbarNoise(
        'POST https://preview.vercel.app/_vercel/insights/view net::ERR_BLOCKED_BY_CLIENT',
        'https://preview.vercel.app/_next/static/chunks/main.js',
      ),
    ).toBe(true)
  })

  it('strictly rejects application routes, /api/*, /_next/*, query-param spoofing, Odoo, Supabase, and app JS errors', () => {
    // Application & Next.js & API URLs on `*.vercel.app`
    expect(isVercelToolbarNoise('https://preview.vercel.app/erp')).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/erp/finance')).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/api/erp/odoo-sync')).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_next/static/chunks/main.js')).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/_next/static/chunks/vercel-toolbar.js')).toBe(
      false,
    )

    // Query-parameter, hash, userinfo, lookalike-domain, and path-traversal spoofing
    expect(isVercelToolbarNoise('https://preview.vercel.app/api/foo?next=https://vercel.live')).toBe(
      false,
    )
    expect(isVercelToolbarNoise('https://preview.vercel.app/api/x?ref=vercel.live')).toBe(false)
    expect(
      isVercelToolbarNoise('https://preview.vercel.app/api/x?script=/_vercel/toolbar/script.js'),
    ).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/erp#https://vercel.live')).toBe(false)
    expect(isVercelToolbarNoise('https://vercel.live@preview.vercel.app/erp')).toBe(false)
    expect(isVercelToolbarNoise('https://evilvercel.live/feedback.js')).toBe(false)
    expect(isVercelToolbarNoise('https://vercel.live.evil.example/feedback.js')).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/api/../_vercel/insights/view')).toBe(
      false,
    )

    // Odoo JSON-RPC & XML-RPC URLs
    expect(isVercelToolbarNoise('https://venturefoods.odoo.com/jsonrpc')).toBe(false)
    expect(isVercelToolbarNoise('https://venturefoods.odoo.com/web/dataset/call_kw')).toBe(false)
    expect(isVercelToolbarNoise('https://preview.vercel.app/jsonrpc')).toBe(false)

    // Supabase URLs
    expect(isVercelToolbarNoise('https://abcdefghijklm.supabase.co/rest/v1/profiles')).toBe(false)
    expect(isVercelToolbarNoise('https://abcdefghijklm.supabase.co/auth/v1/token')).toBe(false)

    // Real application console errors (`TypeError`, API 500s, CORS/CSP on real endpoints)
    expect(
      isVercelToolbarNoise(
        "TypeError: Cannot read properties of undefined (reading 'map')",
        'https://preview.vercel.app/_next/static/chunks/main.js',
      ),
    ).toBe(false)
    expect(
      isVercelToolbarNoise("TypeError: Cannot read properties of undefined (reading 'total')"),
    ).toBe(false)
    expect(
      isVercelToolbarNoise(
        'TypeError: Failed while processing redirect https://vercel.live',
        'https://preview.vercel.app/_next/static/chunks/main.js',
      ),
    ).toBe(false)
    expect(
      isVercelToolbarNoise(
        'Failed to load resource: the server responded with a status of 500 ()',
        'https://preview.vercel.app/api/erp/odoo-sync',
      ),
    ).toBe(false)
    expect(
      isVercelToolbarNoise(
        "Access to fetch at 'https://preview.vercel.app/api/erp/odoo-sync?ref=vercel.live' from origin 'https://preview.vercel.app' has been blocked by CORS policy",
        'https://preview.vercel.app/erp',
      ),
    ).toBe(false)
    expect(
      isVercelToolbarNoise(
        "Refused to connect to 'https://abcdefghijklm.supabase.co/rest/v1/kpi' because it violates the following Content Security Policy directive: \"connect-src 'self' https://vercel.live\".",
        'https://preview.vercel.app/erp',
      ),
    ).toBe(false)
  })
})
