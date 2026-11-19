/**
 * Centralized DOM selector configuration for the AetherBI deployment gate
 * (`scripts/gate/selectors.ts`).
 *
 * Strategy:
 * - Every target lists a preferred `[data-testid="..."]` selector first so the
 *   gate automatically upgrades as soon as test IDs are added to the app.
 * - Structural / accessible-text fallbacks match the current DOM on
 *   `feat/aetherbi-fill-empty-pages` without modifying any app source files.
 * - Whenever a fallback is used because the preferred `data-testid` is absent
 *   in the live DOM, `run-gate.ts` records the target in `SUMMARY.md` under
 *   "Missing `data-testid` Notes".
 */

export interface SelectorSpec {
  /** Stable identifier reported in summary.json and SUMMARY.md. */
  id: string
  /** Page path where this selector is evaluated. */
  page: string
  /** Human-readable description of the target element. */
  description: string
  /** Preferred `data-testid` value (without brackets). */
  preferredTestId: string
  /**
   * Ordered list of Playwright locator selectors to try.
   * Index 0 is always `[data-testid="${preferredTestId}"]`.
   */
  candidates: readonly string[]
  /** Component file in the app where this element lives (for SUMMARY notes). */
  appSourceHint: string
}

function withTestId(
  spec: Omit<SelectorSpec, 'candidates'> & { fallbacks: readonly string[] },
): SelectorSpec {
  const { fallbacks, ...rest } = spec
  return {
    ...rest,
    candidates: [`[data-testid="${spec.preferredTestId}"]`, ...fallbacks],
  }
}

/** Login page (`src/app/login/login-form.tsx`). */
export const LOGIN_SELECTORS = {
  emailInput: withTestId({
    id: 'login.email',
    page: '/login',
    description: 'QA email input field on /login',
    preferredTestId: 'login-email',
    fallbacks: ['input#email', 'input[name="email"]', 'input[type="email"]'],
    appSourceHint: 'src/app/login/login-form.tsx',
  }),
  passwordInput: withTestId({
    id: 'login.password',
    page: '/login',
    description: 'QA password input field on /login',
    preferredTestId: 'login-password',
    fallbacks: ['input#password', 'input[name="password"]', 'input[type="password"]'],
    appSourceHint: 'src/app/login/login-form.tsx',
  }),
  submitButton: withTestId({
    id: 'login.submit',
    page: '/login',
    description: 'Login form submit button on /login',
    preferredTestId: 'login-submit',
    fallbacks: ['form button[type="submit"]', 'button[type="submit"]'],
    appSourceHint: 'src/app/login/login-form.tsx',
  }),
  errorAlert: withTestId({
    id: 'login.errorAlert',
    page: '/login',
    description: 'Login error alert banner on /login',
    preferredTestId: 'login-error-alert',
    fallbacks: ['#login-error-alert', '[role="alert"]'],
    appSourceHint: 'src/app/login/login-form.tsx',
  }),
} as const

/** Home dashboard (`/erp` — `src/components/aether/FullJourney360.tsx`). */
export const ERP_HOME_SELECTORS = {
  /**
   * Primary receivables headline amount inside the "Open Receivables & Ledger Status"
   * card link (`/erp/receivables`).
   */
  receivablesCard: withTestId({
    id: 'erp.receivablesCard',
    page: '/erp',
    description: 'Receivables card headline value on /erp',
    preferredTestId: 'erp-receivables-card-value',
    fallbacks: [
      'section[aria-label*="الذمم المدينة المفتوحة"] a[href="/erp/receivables"] > div:first-child span[dir="ltr"]',
      'section[aria-label*="Open Receivables"] a[href="/erp/receivables"] > div:first-child span[dir="ltr"]',
      'a[href="/erp/receivables"]:has-text("إجمالي الذمم المدينة غير المسوّاة") > div:first-child span[dir="ltr"]',
      'a[href="/erp/receivables"]:has-text("Unreconciled Open Receivables") > div:first-child span[dir="ltr"]',
    ],
    appSourceHint: 'src/components/aether/FullJourney360.tsx',
  }),

  /**
   * Tie-out summary line directly underneath the receivables card headline
   * (`= صافي الذمم المفتوحة` / `= Open receivables` inside `dl[data-ar-tie-out]`).
   */
  receivablesLineUnderCard: withTestId({
    id: 'erp.receivablesLineUnderCard',
    page: '/erp',
    description: 'Receivables tie-out net line under the card on /erp',
    preferredTestId: 'erp-receivables-tie-out-net',
    fallbacks: [
      'dl[data-ar-tie-out] > div:has(dt:has-text("صافي الذمم المفتوحة")) dd',
      'dl[data-ar-tie-out] > div:has(dt:has-text("Open receivables")) dd',
      'dl[data-ar-tie-out] > div:last-of-type dd',
    ],
    appSourceHint: 'src/components/aether/FullJourney360.tsx',
  }),

  /**
   * Receivables tie-out container carrying `data-ar-tie-out="ties" | "mismatch"`.
   */
  receivablesTieOutContainer: withTestId({
    id: 'erp.receivablesTieOutContainer',
    page: '/erp',
    description: 'Receivables tie-out dl container on /erp',
    preferredTestId: 'erp-receivables-tie-out',
    fallbacks: ['dl[data-ar-tie-out]'],
    appSourceHint: 'src/components/aether/FullJourney360.tsx',
  }),

  /**
   * Unapplied credits row inside the receivables card on `/erp`
   * (`div[data-ar-unapplied-credits="true"] dd`).
   */
  receivablesCreditsLine: withTestId({
    id: 'erp.receivablesCreditsLine',
    page: '/erp',
    description: 'Unapplied credits value inside the receivables card on /erp',
    preferredTestId: 'erp-receivables-credits',
    fallbacks: [
      '[data-ar-unapplied-credits="true"] dd',
      'dl[data-ar-tie-out] > div:has(dt:has-text("دفعات ومقاصات غير مطابقة")) dd',
      'dl[data-ar-tie-out] > div:has(dt:has-text("Unapplied credits")) dd',
    ],
    appSourceHint: 'src/components/aether/FullJourney360.tsx',
  }),

  /**
   * Receivables badge on `/erp`.
   * Checks for a dedicated `data-testid="erp-receivables-badge"` first, then
   * falls back to the provenance / ledger AR badge inside the receivables section.
   * If the matched badge contains a KWD amount, the gate asserts it matches
   * `EXPECTED_RECEIVABLES`; otherwise it verifies the badge is present and that
   * `data-ar-tie-out="ties"` without a mismatch.
   */
  receivablesBadge: withTestId({
    id: 'erp.receivablesBadge',
    page: '/erp',
    description: 'Receivables badge inside the Open Receivables section on /erp',
    preferredTestId: 'erp-receivables-badge',
    fallbacks: [
      'section[aria-label*="الذمم المدينة المفتوحة"] [data-kpi-provenance][data-odoo-model="account.move.line"]',
      'section[aria-label*="Open Receivables"] [data-kpi-provenance][data-odoo-model="account.move.line"]',
      'section[aria-label*="الذمم المدينة المفتوحة"] span:has-text("ذمم دفتر الأستاذ")',
      'section[aria-label*="Open Receivables"] span:has-text("Ledger AR")',
    ],
    appSourceHint: 'src/components/aether/FullJourney360.tsx',
  }),
} as const

/** Finance hub (`/erp/finance` — `OdooAccountingAnalyticsHub.tsx` & `VentureAccountingHub.tsx`). */
export const FINANCE_SELECTORS = {
  /** Net Open Receivables KPI card shown on the default GL Summary tab. */
  glSummaryReceivablesCard: withTestId({
    id: 'finance.glSummaryReceivablesCard',
    page: '/erp/finance',
    description: 'Net Open Receivables KPI card on /erp/finance (GL summary tab)',
    preferredTestId: 'finance-receivables-net',
    fallbacks: [
      'article:has-text("صافي الذمم المدينة المفتوحة") .ds-num',
      'article:has-text("Net Open Receivables (AR)") .ds-num',
    ],
    appSourceHint: 'src/components/accounting/OdooAccountingAnalyticsHub.tsx',
  }),

  /** Client-side tab button switching `/erp/finance` to the Open Receivables tab (no network mutation). */
  receivablesTabButton: withTestId({
    id: 'finance.receivablesTabButton',
    page: '/erp/finance',
    description: 'Open Receivables tab button on /erp/finance',
    preferredTestId: 'finance-tab-receivables',
    fallbacks: [
      'nav[role="tablist"] button[role="tab"]:has-text("الذمم المدينة المفتوحة"):visible',
      'nav[role="tablist"] button[role="tab"]:has-text("Open receivables"):visible',
    ],
    appSourceHint: 'src/components/accounting/VentureAccountingHub.tsx',
  }),

  /** Net Open Receivables card on the Receivables tab of `/erp/finance`. */
  receivablesTabNetCard: withTestId({
    id: 'finance.receivablesTabNetCard',
    page: '/erp/finance',
    description: 'Net Open Receivables card on /erp/finance (Receivables tab)',
    preferredTestId: 'finance-receivables-tab-net',
    fallbacks: [
      'article:has-text("صافي الذمم المدينة المفتوحة") .ds-num',
      'article:has-text("Net Open Receivables") .ds-num',
    ],
    appSourceHint: 'src/components/accounting/VentureAccountingHub.tsx',
  }),

  /** Unapplied Credits / Credit Clearing Offset card on the Receivables tab of `/erp/finance`. */
  receivablesTabCreditsCard: withTestId({
    id: 'finance.receivablesTabCreditsCard',
    page: '/erp/finance',
    description: 'Credit Clearing Offset (unapplied credits) card on /erp/finance (Receivables tab)',
    preferredTestId: 'finance-receivables-tab-credits',
    fallbacks: [
      'article:has-text("مقاصة التسويات الدائنة قيد التصفية") .ds-num',
      'article:has-text("Credit Clearing Offset") .ds-num',
    ],
    appSourceHint: 'src/components/accounting/VentureAccountingHub.tsx',
  }),
} as const

/** Receivables page (`/erp/receivables` — `src/components/erp/ReceivablesAgingStudio.tsx`). */
export const RECEIVABLES_SELECTORS = {
  /** Primary "Platform & corporate open residual" KPI card. */
  netCard: withTestId({
    id: 'receivables.netCard',
    page: '/erp/receivables',
    description: 'Platform & corporate open residual KPI card on /erp/receivables',
    preferredTestId: 'receivables-net-card',
    fallbacks: [
      '[data-platform-residual="true"]',
      'article:has-text("المتبقي المفتوح للمنصات والشركات") .ds-num',
      'article:has-text("Platform & corporate open residual") .ds-num',
    ],
    appSourceHint: 'src/components/erp/ReceivablesAgingStudio.tsx',
  }),

  /** "Unapplied credits (excl. cashier clearing)" KPI card (must be non-zero). */
  creditsCard: withTestId({
    id: 'receivables.creditsCard',
    page: '/erp/receivables',
    description: 'Unapplied credits KPI card on /erp/receivables',
    preferredTestId: 'receivables-credits-card',
    fallbacks: [
      'article:has-text("دائن غير مطبّق") .ds-num',
      'article:has-text("Unapplied credits") .ds-num',
    ],
    appSourceHint: 'src/components/erp/ReceivablesAgingStudio.tsx',
  }),
} as const

/** Sales & Cores page (`/erp/cores` — `src/components/aether/CoresHubStudio.tsx` & `TopFilterBar.tsx`). */
export const CORES_SELECTORS = {
  /**
   * Top-bar period dropdown trigger button (used as a UI fallback if URL hydration
   * `?period=year` did not already activate the Year filter).
   */
  periodDropdownTrigger: withTestId({
    id: 'cores.periodDropdownTrigger',
    page: '/erp/cores',
    description: 'Global period filter dropdown trigger on /erp/cores',
    preferredTestId: 'global-period-trigger',
    fallbacks: [
      'header button[aria-haspopup="listbox"][aria-expanded]:visible',
      'header button[aria-expanded][aria-label*="الشهر"]:visible',
      'header button[aria-expanded][aria-label*="السنة"]:visible',
      'header button[aria-expanded][aria-label*="اليوم"]:visible',
      'header button[aria-expanded][aria-label*="الأسبوع"]:visible',
      'header button[aria-expanded][aria-label*="Month"]:visible',
      'header button[aria-expanded][aria-label*="Year"]:visible',
      'button[aria-expanded]:has-text("الشهر"):visible',
      'button[aria-expanded]:has-text("السنة"):visible',
      'button[aria-expanded]:has-text("Month"):visible',
      'button[aria-expanded]:has-text("Year"):visible',
    ],
    appSourceHint: 'src/components/aether/TopFilterBar.tsx',
  }),

  /** Year (`السنة` / `Year`) option inside the TopFilterBar period listbox. */
  yearPeriodOption: withTestId({
    id: 'cores.yearPeriodOption',
    page: '/erp/cores',
    description: 'Year period option inside TopFilterBar listbox on /erp/cores',
    preferredTestId: 'period-option-year',
    fallbacks: [
      '[role="listbox"]:visible [role="option"]:has-text("السنة"):visible',
      '[role="listbox"]:visible [role="option"]:has-text("Year"):visible',
      'button[role="tab"]:has-text("السنة"):visible',
      'button[role="tab"]:has-text("Year"):visible',
    ],
    appSourceHint: 'src/components/aether/TopFilterBar.tsx',
  }),

  /** Headline "Total Net Sales" KPI card on `/erp/cores` under the Year filter (2026 YTD). */
  ytdCompanyTotal: withTestId({
    id: 'cores.ytdCompanyTotal',
    page: '/erp/cores',
    description: '2026 YTD company Total Net Sales KPI card on /erp/cores',
    preferredTestId: 'cores-total-net-sales',
    fallbacks: [
      'div:has(> div:text-is("إجمالي صافي المبيعات")) > div.font-mono[dir="ltr"]',
      'div:has(> div:text-is("Total Net Sales")) > div.font-mono[dir="ltr"]',
      'div:has(> div:text-is("إجمالي صافي المبيعات")) > div[dir="ltr"]',
      'div:has(> div:text-is("Total Net Sales")) > div[dir="ltr"]',
      'div:has(> div:has-text("إجمالي صافي المبيعات")) > div.font-mono[dir="ltr"]',
      'div:has(> div:has-text("Total Net Sales")) > div.font-mono[dir="ltr"]',
    ],
    appSourceHint: 'src/components/aether/CoresHubStudio.tsx',
  }),
} as const

export const GATE_PAGES: readonly string[] = [
  '/erp',
  '/erp/cores',
  '/erp/weekday-comparison',
  '/erp/before-after',
  '/erp/warehouse-chain',
  '/erp/aggregator-radar',
  '/erp/finance',
  '/erp/receivables',
  '/erp/executive-pnl',
  '/erp/feryal-ai',
  '/erp/decisions',
  '/erp/planning',
  '/erp/seasons',
  '/erp/booth-feasibility',
  '/erp/demand-forecast',
] as const
