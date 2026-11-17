# AetherBI Overnight Audit, Polish & Verification Report (`overnight-report.md`)

---

## 1. Executive Summary & Verification Scoreboard

- **Repository:** `werech21-lab/restaurant-ai-hq`
- **Branch:** `fix/aetherbi-followup-2026-11-16` (PR `#3`, tracking `origin/fix/aetherbi-followup-2026-11-16`)
- **Base Commit (Phase 13 Green):** `b5485414fd0fcab1a77bffcae7666260778c48c9`
- **Resume Start Commit (Phase 14 WIP):** `d61b35c6cc32f31d1595838741a2e6424614ea33`
- **Final Code `HEAD` SHA:** `c3a5f8a3ba81a8f313dd2358e1b1f6b074e7306d` *(note: the immediately following `overnight(report/final)` commit adds `docs/phases/overnight-report.md` only, with zero code changes)*
- **Date Recorded:** `2026-11-17` (`Asia/Kuwait`, `UTC+3`)

### 1.1 Before vs. After Gate Scoreboard

| Verification Gate | Baseline (`d61b35c`) | Final (`c3a5f8a`) | Delta / Notes |
| --- | --- | --- | --- |
| `npx tsc --noEmit` | Exit `0` (`0` errors post-`prisma generate`) | **Exit `0`** (`0` errors) | Strict nullable narrowing preserved across all `376` changed files; zero `any` or `@ts-ignore` added |
| `npm run lint -- --max-warnings=0` | `0` errors, `3` `@next/next/no-img-element` warnings | **Exit `0` (`0` errors, `0` warnings)** | All `3` `@next/next/no-img-element` warnings (`payroll/[id]/print`, `settings/apps`, `download`) eliminated |
| `npx vitest run` (Full Repo) | **`115` files / `1,399` tests** passed | **`132` files / `1,666` tests** passed (`0` failed, `0` skipped) | **`+17` new test suites, `+267` net new tests** (`+16` in `phase-14-partial-and-batch.test.ts` + `251` across `17` new suites) |
| `npm run build` (`prisma generate && next build`) | Exit `0` (`3` lint warnings) | **Exit `0` (`109/109` routes, `21/21` static pages prerendered, `0` warnings)** | Next.js `15.5.28` production build clean; RSC client-boundary & string-constant imports extracted into server-safe modules |
| `git diff b548541..HEAD -- prisma/dev.db` | `0` bytes | **`0` bytes** (completely untouched) | Local SQLite database never modified, seeded, or opened for writes |
| Temp DB Leftovers (`aetherbi-vitest-*`, `vf-vitest-run-*`) | `0` in `C:\tmp` & `os.tmpdir()` | **`0` in `C:\tmp` & `os.tmpdir()`** | Ephemeral per-worker PGlite/SQLite test directories cleaned after every run |
| Protected Modules & Baseline (`d61b35c`) Test Edits | `0` | **`0` modified** (`12,785` insertions, `0` deletions in `d61b35c..HEAD -- '**/__tests__/**'`) | Every Phase 1–13 invariant, canteen/exclusion matcher, POS query builder, PIN gate, and Feryal 2-of-3 consensus module intact |

### 1.2 Chronological Commit Log (`b548541..c3a5f8a` — `22` Commits)

```text
d61b35c fix(odoo): surface partial sub-query failures as null with warning and fail batch sync on query errors
e0d357f overnight(plan/baseline): add 109-route overnight execution plan and baseline audit
0d52858 overnight(phase-a/partial-and-batch): complete N2 partial-null propagation across all consumers and batch sync guards
8d884be overnight(phase-a/docs): record final phase-14 diff stat and commit SHA
97991cc overnight(design-system/formatters): add canonical 3-decimal KWD, int, pct and Asia/Kuwait formatters
146036b overnight(design-system/primitives): add executive tokens and shared KpiCard, ChartCard, DataTable, StateBlock primitives
7412ddc overnight(phase-b/tier1-data): fix school-canteens & 3-decimal AOV data contracts and add 90-case canteen/exclusion matrix
e87c35b overnight(phase-b/tier1-chrome-overview): polish shared chrome, /erp FullJourney360 & /dashboard with 3-decimal KWD and RTL/a11y guards
e8c593f overnight(phase-b/tier1-sales-cores): polish CoresHub, BrandSales, DeliveryRadar & Comparison studios with 3-decimal KWD and StateBlocks
4463a49 overnight(phase-b/tier1-finance-settings): polish P&L, Scorecard, Receivables, Ledger, Reports & Odoo settings with 3-decimal KWD and Kuwait TZ
2386694 overnight(phase-b/tier1-feryal-ops): polish Feryal AI, AI Brief, Governance, Cost Intelligence, Warehouse Chain & SLA studios
9e97d89 overnight(phase-b/tier2-data): enforce Tier 2 exclusions, non-company items & canteen stock locations + 109-route RBAC suite
8043078 overnight(phase-b/tier2-panel-fin-pos): polish 16 panel finance/sales/purchases/inventory/warehouses + POS & KDS routes
f56f798 overnight(phase-b/tier2-erp-ops): polish UnlinkedSourceNotice, AlertsCenter, GovernanceDesk & 11 ERP ops/inventory/procurement routes
3dc48dd overnight(phase-b/tier2-erp-intel): polish 17 ERP intelligence, planning, booth, events, CRM & smart-dropzone routes
f8f8065 overnight(phase-b/tier2-panel-hr-ess): polish 6 panel HR, compliance radar, smart-ingest, audit & ESS routes
3e30e7e overnight(phase-b/tier3-rsc-foundation): extract server-safe cx & erp-ui class helpers for Next.js 15 RSC compatibility
cd15bf2 overnight(phase-b/tier3-settings): polish 11 panel settings, profile, directory, saas, deploy, automations & app-builder routes
1a0eeb3 overnight(phase-b/tier3-print-public): polish 4 print routes, shared invoice/statement sheets & 5 public/auth entry routes
5ec0164 overnight(phase-b/tier3-admin-iam): polish 9 Admin/IAM/Org/Archive/Roles/Users routes & legacy ERP module UIs
7b02920 overnight(phase-c/dead-code): remove 16 zero-reference legacy orphan modules & unused imports
c3a5f8a overnight(phase-c/kuwait-formatting-polish): enforce Asia/Kuwait midnight boundaries, canonical formatters & 55/55 ERP shell H1/main parity
```

---

## 2. Phase A (Phase 14 Completion) & Design System Foundation Summary

### 2.1 Phase A — Blocker N2 (Partial Sub-Query Honesty) & Item B (Fail-Closed Batch Sync)

Full line-level details are recorded in `docs/phases/phase-14-checklist.md` (code commit `0d52858`, docs commit `8d884be`):

- **Blocker N2 (`src/lib/odoo-live-connector.ts`, `src/lib/odoo/live-sync-core.ts`, `src/lib/aether/global-filter-engine.ts`, `src/lib/aether/cores-hub-engine.ts`, and all studio/report consumers):**
  - Every `safeSubQuery` failure records its section key into per-pull `unavailableSections: string[]` without logging raw Odoo RPC payloads, URLs, or credentials, setting `partial: true`, `diagnosticCode: 'PARTIAL_LIVE'`, `warningAr: "بعض الأرقام غير متاحة الآن"`, and `warningEn: "Some figures are temporarily unavailable"` (`partial: false`, `unavailableSections: []`, `'OK_LIVE'` on clean runs).
  - Unavailable sections (`hourly`, `channels.{today,week,month,year}`, `brands.{today,week,month,year}`, `year`, `journeyPulse`, `receivables`, `stockTransfers`, `products`, `pos.category`, `excluded.month`, `gl.accounts`) propagate `null` end-to-end — never coercing `null` to `0`, never falling back to `pricelistUiHints30`, never computing AOV from `null`, never defaulting Top Brand to `China Garden`, and never rendering a `2%` progress bar fill.
  - Primary POS order/session paths (`ordersByDaySessionPricelist` atomic pair, `pos.session.read`, `fetchLiveOdooPeriodCube`, `fetchLiveOdooSummary`) fail closed (`connected: false` / rejection).
  - UI surfaces render `"—"` (`UNAVAILABLE_DASH`) with localized `"غير متاح"` / `"Unavailable"` tooltips (`data-unavailable="true"`) and mount `<OdooPartialWarningBanner />` (`data-odoo-partial-warning="true"`, `role="alert"`) whenever `partial === true`.
- **Item B (`scripts/sync-odoo-live.mjs`, `scripts/odoo-journey-extract.mjs`, `scripts/build-odoo-dataset.mjs`, `src/lib/odoo/odoo-dataset.ts`, `src/lib/aether/ledger.ts`):**
  - Removed synthetic order-count estimation (`Math.round(netVal / 4.8)`).
  - Routed all sales, payment, order-line, POS master-data (`pos.config`, `pos.category`, `pos.payment.method`), and journey POS queries through `salesQuery`, aborting with a non-zero exit **before** writing `SNAPSHOT` or `JOURNEY_OUT` on any non-permission error (`HTTP 502`, network timeout, RPC fault).
  - On Odoo `AccessError`, records the model in `permissions.missingRead`, skips `reconcileAmounts` (preventing 100% bucket dumps into `'dine-in'` or `'china-garden'`), and emits `null` through `build-odoo-dataset.mjs` -> `"—"` in UI.
- **RED-First Evidence (`src/lib/__tests__/phase-14-partial-and-batch.test.ts`):**
  - Stage 1 (`b548541` -> `d61b35c`): `25 failed (25)` -> `28/28` GREEN.
  - Stage 2 (`e0d357f` -> `0d52858`, Wave 1 Gaps `A1`–`A9`): **`16 failed | 28 passed (44)`** before production edits -> **`44 passed (44)`** GREEN after fixes.

### 2.2 Wave 2 & Wave 3C RSC Foundation — Design System & Canonical Formatters

- **Canonical Formatters (`src/lib/format.ts`, `src/lib/format-kwd.ts`, commit `97991cc` + Phase C `c3a5f8a`):**
  - `formatKwd(value, localeOrOpts)`: exact 3-decimal Kuwaiti fils precision (`1,234.500 KWD` / `1,234.500 د.ك`), `null | undefined | NaN | ±Infinity -> '—'`, `-0` normalized to `0.000`, `signed` & `showUnit` options.
  - `formatInt(value, opts)` & `formatPct(value, opts)`: grouped ASCII numerals, `null -> '—'`, `-0` normalization.
  - `formatDate` / `formatKuwaitDate`, `formatDateTime` / `formatKuwaitDateTime`, and `formatMonth`: deterministic `Asia/Kuwait` (`UTC+3`, no DST) formatting across ISO timestamps, naive Odoo UTC timestamps (`"YYYY-MM-DD HH:mm:ss"`), and calendar dates (`"YYYY-MM-DD"`).
- **Executive Private-Bank Design Tokens & Typography (`src/app/globals.css`, `src/app/aether-v2.css`, `tailwind.config.js`, commit `146036b`):**
  - Semantic `--ds-*` tokens supporting both deep neutral obsidian-emerald dark mode (`#090E0C` canvas, `#101815` surface, `#141F1B` elevated, `#111A17` subtle, `#8FA39B` muted) and warm pure-white executive light mode (`#F6F7F8` canvas, `#FFFFFF` surface, `#F1F4F6` subtle) with 1px hairline borders, restrained emerald accent, and `prefers-reduced-motion` support.
  - Self-hosted `IBM Plex Sans Arabic`, `Inter`, and `Cairo` via `next/font/google` in `src/app/layout.tsx` (zero external `fonts.googleapis.com` stylesheet links), `.ds-num` `dir="ltr"` + `tabular-nums` numeric islands for RTL safety, and strict `>=12px` (`text-xs`) font floor.
- **Shared RSC-Compatible UI Primitives (`src/components/ui/*`, commits `146036b` & `3e30e7e`):**
  - `KpiCard`, `SectionCard`, `ChartCard` (`ChartTooltipContent`, `formatChartKwdTooltip`), `DataTable` (legacy + structured modes with sticky headers & inner `overflow-x-auto`), `StateBlock` (`loading`, `empty`, `error` with raw-error swallowing, `partial`, `unavailable`, `unlinked`, `forbidden`), and `PartialWarningBanner`.
  - Extracted pure server-safe `src/components/ui/cx.ts` and `src/components/erp-ui-classes.ts` (without `'use client'`) so Next.js 15 Server Components and static prerenders (`/download`, etc.) never invoke client reference stubs on the server.

---

## 3. Master 109-Route Audit & Polish Table (`109/109` `src/app/**/page.tsx` Files)

Programmatically verified 1-to-1 against `Get-ChildItem -Recurse -Filter page.tsx src/app` (**`109` routes total: `24` Tier 1 + `52` Tier 2 + `33` Tier 3; `0` missing, `0` extra**).

| # | Route File | URL | Tier | Tabs / Sections Checked | Before -> After Data Fixes | Before -> After UI / RTL / A11y Fixes | Tests Added | Remaining TODO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/app/(kds)/kds/page.tsx` | `/kds` | Tier 2 | `VentureKdsHub`, `KdsBoard`, station filters | `.catch(() => 'en')` -> `'ar'`; `formatInt` stats/qty; removed Arabic `titleEn` leak | `text-[10px]` -> `text-xs`, `min-h-11` touch targets, `SectionCard` + `StateBlock` (`loading`/`empty`/`error`/`unlinked`), `ds-focus-ring` | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: add server `requireUser()` defense-in-depth; link `pos_preparation_display` when KDS hardware onboards |
| 2 | `src/app/(panel)/accounting/page.tsx` | `/accounting` | Tier 2 | `chart`, `journals`, `trial`, `entry` tabs | `moneyFor` -> 3-decimal `formatKwd`; added missing `journals` table w/ `Asia/Kuwait` `formatDateTime` | Dark-only classes -> `--ds-*` `ds-surface`, inner `overflow-x-auto`, `text-start`/`text-end`, `data-state-block="empty"` | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/finance`? |
| 3 | `src/app/(panel)/accounting/reconciliation/page.tsx` | `/accounting/reconciliation` | Tier 2 | `ReconciliationClient`, KPIs, statement match table | Raw `.toFixed(3)`/`.toFixed(0)%` -> `DataTable` `format: 'kwd'`, `formatPct`, `formatInt`, `UNAVAILABLE_DASH` tooltip | Dark `#0a0d12` -> `KpiCard`, `SectionCard`, `DataTable` (`overflow-x-auto`, sticky header, `StateBlock`) | `tier2-panel-fin-pos.test.ts` | None |
| 4 | `src/app/(panel)/app-builder/page.tsx` | `/app-builder` | Tier 3 | `AppBuilderPanel` modules grid, custom fields form & table | Count badges via `formatInt`, null options -> `—` + tooltip, sanitized errors, `LOCKED_MODULES` preserved | Bilingual AR/EN, `SectionCard` + `StateBlock`, `--ds-*` tokens, `overflow-x-auto`, inline 2-step delete confirm, `ds-focus-ring` | `tier3-settings.test.ts` | None |
| 5 | `src/app/(panel)/audit/page.tsx` | `/audit` | Tier 2 | `AuditLogView` filter bar, activity table, CSV export | `Asia/Kuwait` `formatDateTime`, `formatInt` total, `UNAVAILABLE_DASH` tooltip, fixed CSV label (`activity-log.csv`), `erp-ui-classes` RSC import | Extracted `AuditLogView`, `text-right` -> `text-start`, `SectionCard` + `StateBlock` (`empty`/`error`), `aria-label`s, zero `سجل التدقيق` | `tier2-panel-hr-ess.test.ts`, `tier3-print-public.test.ts` | None |
| 6 | `src/app/(panel)/automation/page.tsx` | `/automation` | Tier 3 | Re-export of `/automations` (`VentureAutomationHub`) | Zero placeholder rules; links cleanly to `/erp/governance` & `/settings/notifications` | Verified identical AR/EN & `--ds-*` rendering via re-export | `tier3-settings.test.ts` | `TODO(Abdullah)`: redirect `/automation` -> `/automations`? |
| 7 | `src/app/(panel)/automations/page.tsx` | `/automations` | Tier 3 | `VentureAutomationHub` & `AutomationsPanel` | Stripped Arabic `titleEn` leak, replaced banned buzzword w/ `authorized`, null supplier -> `—` + tooltip, sanitized errors | Removed nested `<main>` inside `Shell`, `PageHeader` + `SectionCard` + `StateBlock`, AR/EN parity, `overflow-x-auto`, `ds-focus-ring` | `tier3-settings.test.ts` | `TODO(Abdullah)`: consolidate w/ `/automation` / `/erp/ai`? |
| 8 | `src/app/(panel)/bi-analytics/page.tsx` | `/bi-analytics` | Tier 1 | 4 BI KPIs, Category Margin, 30-Day Cash Flow, `RadarButton` | 2-dec `formatMoney` -> 3-decimal `formatKwd`, `formatPct`, `formatInt`; `try/catch` DB error fallback & sanitized `RadarButton` errors | Full AR/EN via `getLocale()`/`tx()`, `KpiCard`, `SectionCard`, `StateBlock`, `<thead>` + `overflow-x-auto`, `dir="ltr" tabular-nums` | `tier1-finance-settings.test.ts` | None |
| 9 | `src/app/(panel)/central-kitchen/page.tsx` | `/central-kitchen` | Tier 2 | Central kitchen launcher cards & scope header | Dynamic active scope label; zero invented figures | Legacy dark `cardClass` -> `--ds-*` `ds-surface`, explicit `dir`, `min-h-11` `ds-focus-ring` links | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/kitchen`? |
| 10 | `src/app/(panel)/crm/page.tsx` | `/crm` | Tier 2 | `VentureCrmHub`, `CrmBoard`, `QuoteActions` | `moneyFor`/`formatMoney`/`dateFor` -> 3-dec `formatKwd` & `Asia/Kuwait` `formatDate`, `UNAVAILABLE_DASH`; `visibleProductWhere` kept | `#0a0d12`+`bg-white` clash -> `SectionCard` + `StateBlock` (`unlinked`/`empty`), AR/EN parity, `overflow-x-auto` quotes table | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/crm` & `/erp/sales-crm`? |
| 11 | `src/app/(panel)/crm/quotes/[id]/print/page.tsx` | `/crm/quotes/[id]/print` | Tier 3 | Quotation A4/Thermal `InvoiceSheet`, missing-ID state | `formatMoney` -> 3-dec `formatKwd`, `Asia/Kuwait` `formatDateTime` (`UTC+3`), missing quote -> `StateBlock` (`empty`) | Bilingual AR/EN headers, `dir="ltr" tabular-nums`, `print:hidden` toolbar, `@page { size: A4 }`, `next/image` logo/QR | `tier3-print-public.test.ts` | None |
| 12 | `src/app/(panel)/dashboard/page.tsx` | `/dashboard` | Tier 1 | `AetherBiExecutiveDashboard` & `UnlinkedSourceNotice` | Hardcoded `locale="ar"` -> dynamic `useI18n()`; cleaned Arabic leak in `titleEn="Unlinked from Source — Legacy Static Dashboard"` | `PageSkeleton` -> `<StateBlock state="loading" />`, responsive `p-4 sm:p-6`, `PanelHeaderBar` single `LanguageSwitch`+`ThemeToggle` | `tier1-chrome-overview.test.ts` | None |
| 13 | `src/app/(panel)/delivery-hub/page.tsx` | `/delivery-hub` | Tier 2 | `DeliveryHubPanel` KPIs, create form, open orders table | `money()` -> 3-dec `formatKwd`, `formatInt`, `Asia/Kuwait` `formatDateTime` on open orders | Translated English-only headers to AR/EN, `SectionCard`, `DataTable` (`overflow-x-auto`), `StateBlock` empty, `htmlFor` labels | `tier2-panel-fin-pos.test.ts` | None |
| 14 | `src/app/(panel)/deploy/page.tsx` | `/deploy` | Tier 3 | `DeployView` PWA card (`InstallButton`) & Docker runbook | Removed demo-data phrasing & raw env secret names (`AUTH_SECRET`/`DATABASE_URL`) | Bilingual AR/EN `DeployView`, `SectionCard` + `StateBlock`, `ps-5`, `dir="ltr"` code block, `ds-focus-ring` | `tier3-settings.test.ts` | None |
| 15 | `src/app/(panel)/directory/page.tsx` | `/directory` | Tier 3 | `DirectoryView` Staff PBX, Brand hotlines, Branch extensions | Filtered DB `employees`/`warehouses` + directory lists via `isExcludedOdooEntity`; missing fields -> `—` + tooltip | Search filter, AR/EN parity, `SectionCard` + `StateBlock`, `--ds-*` contrast, `dir="ltr" tabular-nums`, `overflow-x-auto` | `tier3-settings.test.ts` | None |
| 16 | `src/app/(panel)/hr/compliance-radar/page.tsx` | `/hr/compliance-radar` | Tier 2 | `ComplianceRadarClient` expiry bands, GRO dispatch, table | `isExcludedOdooEntity` filter & recomputed totals, dynamic GRO recipient label, `Asia/Kuwait` `formatDate`, `formatInt`, `UNAVAILABLE_DASH` | `text-[11px]` -> `text-xs`, `SectionCard` + `StateBlock` (`empty`/`error`), `--ds-*` tokens, `aria-pressed`, `overflow-x-auto` | `tier2-panel-hr-ess.test.ts` | `TODO(Abdullah)`: filter excluded entities inside `hr-compliance.service.ts` query? |
| 17 | `src/app/(panel)/hr/page.tsx` | `/hr` | Tier 2 | `EnterpriseHrCommandHub` (`employees`/`payroll`/`attendance`/`eosb`), modals, WPS | Kuwait `year`/`month` & `formatDate`, `isExcludedOdooEntity`, 3-dec `formatKwd`, `formatInt`, removed fake wizard defaults & `Mubarak Al-Kabeer` | `KpiCard`, `SectionCard`, `DataTable`, `SlidingPillTabs`, `StateBlock`; fixed `#0a0d12` & `HrDigitalDossier` contrast; `Esc` + `aria-modal` | `tier2-panel-hr-ess.test.ts` | `TODO(Abdullah)`: consolidate `/hr` vs `/erp/hr`? |
| 18 | `src/app/(panel)/hr/payroll/[id]/print/page.tsx` | `/hr/payroll/[id]/print` | Tier 3 | `PayrollSheet` A4 payslip, missing-ID state | `formatMoney` -> 3-dec `formatKwd`, `formatInt` days, `Asia/Kuwait` `formatDate`, null -> `—` + tooltip, missing -> `StateBlock` (`empty`) | Replaced raw `<img>` w/ `next/image` (`0` build warnings), `@page { size: A4; margin: 12mm; }`, `print:hidden`, AR/EN headers | `tier3-print-public.test.ts` | None |
| 19 | `src/app/(panel)/hr/smart-folder-upload/page.tsx` | `/hr/smart-folder-upload` | Tier 2 | `SmartFolderUploadClient` batch dropzone & dossier assignment | `isExcludedOdooEntity` filter, `formatInt`/`formatPct`, `Asia/Kuwait` `formatDate` expiry + tooltip, sanitized `assign` errors | Fixed light/dark badge contrast, `SectionCard` + `StateBlock`, `role="progressbar"`, `aria-label`s, `overflow-x-auto` | `tier2-panel-hr-ess.test.ts` | None |
| 20 | `src/app/(panel)/inventory/page.tsx` | `/inventory` | Tier 2 | `InventoryPanel` (`products`, `categories`, `movements`, `fefo`) | `moneyFor`/`datetimeFor` -> 3-dec `formatKwd`, `Asia/Kuwait` `formatDateTime`, `formatInt`, `UNAVAILABLE_DASH` | Fixed Arabic `titleEn` leak (`StateBlock` `unlinked`), `--ds-*` `role="tablist"`, `overflow-x-auto`, `dir="ltr" ds-num` | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/inventory` & link `stock.lot` if FEFO used |
| 21 | `src/app/(panel)/payments/page.tsx` | `/payments` | Tier 2 | `PaymentCreateForms`, `InvoicePayLinkButton`, vouchers table | `moneyFor`/`datetimeFor` -> 3-dec `formatKwd` & `Asia/Kuwait` `formatDateTime`; input `step="0.01"` -> `step="0.001"` | Translated Arabic-only forms to AR/EN, `SectionCard` + `PaymentsEmptyBlock` (`StateBlock`), `overflow-x-auto`, `ds-focus-ring` | `tier2-panel-fin-pos.test.ts` | None |
| 22 | `src/app/(panel)/profile/page.tsx` | `/profile` | Tier 3 | `ProfileView`, `ProfileForm`, role permissions matrix | Password/PIN/role/status untouched; sanitized action messages; bilingual module labels via `moduleNavLabel` | AR/EN `ProfileView` + `ProfileForm`, `SectionCard` + `StateBlock`, `overflow-x-auto` matrix (`text-start`), `ds-focus-ring` | `tier3-settings.test.ts` | None |
| 23 | `src/app/(panel)/purchases/[id]/print/page.tsx` | `/purchases/[id]/print` | Tier 3 | Purchase Order A4/Thermal `InvoiceSheet`, missing-ID state | `formatMoney` -> 3-dec `formatKwd`, `Asia/Kuwait` `formatDateTime` (`UTC+3`), localized status, missing -> `StateBlock` (`empty`) | Bilingual AR/EN PO headers, `dir="ltr" tabular-nums`, `print:hidden` + A4 print tokens, `next/image` logo/QR | `tier3-print-public.test.ts` | None |
| 24 | `src/app/(panel)/purchases/page.tsx` | `/purchases` | Tier 2 | `VenturePurchasesHub`, PO & supplier panels | `moneyFor`/`dateFor` -> 3-dec `formatKwd` & `Asia/Kuwait` `formatDate`; preserved `visiblePurchaseWhere` | Fixed Arabic `titleEn` leak (`SectionCard` + `StateBlock` `unlinked`), `aria-pressed`, `ds-focus-ring`, `--ds-*` tokens | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/procurement`? |
| 25 | `src/app/(panel)/purchases/suppliers/[id]/page.tsx` | `/purchases/suppliers/[id]` | Tier 2 | Supplier `StatementView`, ledger lines, missing-ID state | 3-dec `formatKwd` & `Asia/Kuwait` dates in `StatementView`, EN movement kind translation, null -> `—` + tooltip | Bilingual AR/EN `getLocale()`, `text-right` -> `text-start`, `StateBlock` empty state, `print:hidden` controls | `tier2-panel-fin-pos.test.ts`, `tier3-print-public.test.ts` | None |
| 26 | `src/app/(panel)/recipes/page.tsx` | `/recipes` | Tier 2 | `VentureRecipesHub` & `RecipesPanel` BOM lines | `.toFixed(1)%` & `money()` -> `DataTable` `format: 'kwd'` (3-dec) & `formatPct`; preserved `visibleProductWhere` | Fixed Arabic `titleEn` leak, upgraded `RecipesPanel` to `SectionCard` + `DataTable` (`overflow-x-auto`), `aria-label`s | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/recipes` & link Odoo `mrp.bom` if used |
| 27 | `src/app/(panel)/reports/page.tsx` | `/reports` | Tier 1 / 2 | `DepartmentalReportsHub` (`VF-POS-*`, `VF-FIN-*`) + `LiveDbReportsSection` | 3-dec `formatKwd`, `formatInt`, `formatPct`, `Asia/Kuwait` `formatKuwaitDateTime`, `school-canteens` in `VF-POS-02`, RSC `erp-ui-classes` | `text-[11px]` -> `text-xs`, `PartialWarningBanner`, `StateBlock`, `text-start`/`text-end`, `KpiCard`, numeric cell formatting | `tier1-finance-settings.test.ts`, `tier1-data-contracts.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 28 | `src/app/(panel)/roles/page.tsx` | `/roles` | Tier 3 | `RolesPanel` (`Matrix`, `RoleEditor`, `CreateRole`) | Bilingual `generateMetadata()`, `formatInt` user counts, `emptyPermissions` matrix intact, zero user role mutations | Light+dark `SectionCard` & `StateBlock` (`empty`), `text-right` -> `text-start`, `aria-label` checkboxes, inline 2-step delete | `tier3-admin-iam.test.ts` | None |
| 29 | `src/app/(panel)/saas/page.tsx` | `/saas` | Tier 3 | `SaasView` & `SaasPanel` corporate summary, brands, branches | Removed invented `500,000 د.ك` / `166` / `9,662` / `10 فروع`; uses real DB non-excluded counts (`null` -> `—`), `Asia/Kuwait` `formatDate` | Bilingual AR/EN `SaasView`, `KpiCard`, `SectionCard`, `StateBlock`, `--ds-*` light/dark surfaces, `overflow-x-auto` | `tier3-settings.test.ts` | None |
| 30 | `src/app/(panel)/sales/[id]/print/page.tsx` | `/sales/[id]/print` | Tier 3 | Sales Invoice A4/Thermal `InvoiceSheet` (`?layout=thermal`) | `formatMoney` -> 3-dec `formatKwd`, `Asia/Kuwait` `formatDateTime` (`UTC+3`), localized status, missing -> `StateBlock` (`empty`) | Preserved `pendingPay` & `?layout=thermal`, AR/EN headers, `dir="ltr" tabular-nums`, A4/80mm print CSS, `next/image` | `tier3-print-public.test.ts` | None |
| 31 | `src/app/(panel)/sales/customers/[id]/page.tsx` | `/sales/customers/[id]` | Tier 2 | Customer `StatementView`, running balance, missing-ID state | 3-dec `formatKwd` & `Asia/Kuwait` dates in `StatementView`, EN movement kind translation, null -> `—` + tooltip | Bilingual AR/EN `getLocale()`, `text-right` -> `text-start`, `StateBlock` empty state, `print:hidden` controls | `tier2-panel-fin-pos.test.ts`, `tier3-print-public.test.ts` | None |
| 32 | `src/app/(panel)/sales/page.tsx` | `/sales` | Tier 2 | `SalesCommandCenter`, invoices, customers, payment links | `moneyFor`/`dateFor` -> 3-dec `formatKwd` & `Asia/Kuwait` `formatDate`; preserved `visibleInvoiceWhere` & `scopeWarehouseIds` | Fixed Arabic `titleEn` leak (`SectionCard` + `StateBlock` `unlinked`), `aria-pressed`, `ds-focus-ring`, `--ds-*` tokens | `tier2-panel-fin-pos.test.ts` | None |
| 33 | `src/app/(panel)/settings/aetherbi/page.tsx` | `/settings/aetherbi` | Tier 1 / 3 | `DomainPanel` DNS table, health check, embed snippet | Sanitized `checkDomainAction()` health output (removed raw `/api/health` body dump) | Fixed dark-on-dark contrast via `SectionCard`, `try/catch` clipboard copy, `overflow-x-auto` table, full AR/EN parity | `tier1-finance-settings.test.ts` | None |
| 34 | `src/app/(panel)/settings/aetherbi-connect/page.tsx` | `/settings/aetherbi-connect` | Tier 1 / 3 | `ConnectPanel` snippet, connection status, visits & leads | Added `try/catch` DB fallback (`null -> "—"` via `formatInt` + `"غير متاح"`/`"Unavailable"` tooltip) | Fixed dark-on-dark contrast via `SectionCard`, `try/catch` clipboard copy, full AR/EN parity, `ds-focus-ring` | `tier1-finance-settings.test.ts` | None |
| 35 | `src/app/(panel)/settings/apps/page.tsx` | `/settings/apps` | Tier 3 | `AppsView` Windows desktop launcher & mobile QR card | Null/failed QR -> `StateBlock state="unavailable"` | Replaced raw `<img>` w/ `next/image` `<Image unoptimized width={176} height={176} />` (`0` warnings), AR/EN `SectionCard` | `tier3-settings.test.ts` | None |
| 36 | `src/app/(panel)/settings/notifications/page.tsx` | `/settings/notifications` | Tier 3 | `NotificationWizard` Telegram, WhatsApp Bridge & Meta Cloud | Enforced `type="password"` on all `3` secret inputs (`token`, `whatsappBridgeSecret`, `metaAccessToken`), masked `••••` badges, sanitized errors | Bilingual AR/EN, `SectionCard` + `StateBlock`, `--ds-*` inputs, `ds-focus-ring`, `aria-label`s | `tier3-settings.test.ts` | None |
| 37 | `src/app/(panel)/settings/odoo-data-center/page.tsx` | `/settings/odoo-data-center` | Tier 1 / 3 | `OdooDataCenterClient` 8 KPIs, indexes, field coverage | Fixed raw `errorKey` leak -> `t(errorKey)`, formatted `querySpeedMs`/counts/`samples` w/ `formatInt` & `averagePercent` w/ `formatPct` | Fixed dark-on-dark contrast via `KpiCard` + `SectionCard`, `StateBlock` (`loading`/`error`/`empty`), Next `Link`, AR/EN parity | `tier1-finance-settings.test.ts` | `TODO(Abdullah)`: fold into `/erp/odoo-sync`? |
| 38 | `src/app/(panel)/settings/odoo-sync/page.tsx` | `/settings/odoo-sync` | Tier 1 / 3 | `OdooSyncPanel` snapshot summary, live pull, dump upload | Masked `session_id` w/ `type="password"`, sanitized errors, removed `backups/odoo-full-dump` path leak, `Asia/Kuwait` `exportedAt` | `text-[11px]` -> `text-xs`, bilingual AR/EN, light+dark `SectionCard`, accessible input contrast & `aria-label`s | `tier1-finance-settings.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/odoo-sync`? |
| 39 | `src/app/(panel)/settings/page.tsx` | `/settings` | Tier 3 | `SettingsPage` fiscal summary, sub-nav, `Settings.tsx` | `formatPct(company.taxRate)`, null `taxNumber` -> `—` + tooltip | Responsive `flex-wrap` sub-nav, `SectionCard` + `StateBlock`, fixed `Settings.tsx` light/dark contrast, `dir` + `ds-focus-ring` | `tier3-settings.test.ts` | None |
| 40 | `src/app/(panel)/settings/payments/page.tsx` | `/settings/payments` | Tier 3 | `GatewayForm` (`MYFATOORAH`, `STRIPE`, `TAP`) | Enforced `type="password"` on `apiKey` & `webhookSecret` (`2` secret inputs), unset -> `—` + tooltip, sanitized errors | Bilingual AR/EN provider & method labels, `SectionCard` + `StateBlock`, `--ds-*` tokens, `ds-focus-ring`, `aria-label`s | `tier3-settings.test.ts` | None |
| 41 | `src/app/(panel)/smart-ingest/[module]/page.tsx` | `/smart-ingest/[module]` | Tier 2 | `SmartDepartmentFolderUpload` across all 6 panel modules | Removed dev copy (`Dark Obsidian`, `safeStorageKey`), 3-dec `formatKwd`, `Asia/Kuwait` `formatDate`, `isExcludedOdooEntity` guard | Fixed light-mode invisible text (`bg-slate-950/5 text-white`), `SectionCard` + `StateBlock`, `role="progressbar"`, `overflow-x-auto` | `tier2-panel-hr-ess.test.ts` | None |
| 42 | `src/app/(panel)/stock-count/page.tsx` | `/stock-count` | Tier 2 | `StockCountView` low-stock KPI & valuation table | Extracted `StockCountView` w/ `KpiCard` (`int`), `DataTable` (`format: 'kwd'` 3-dec, `formatQty`), RSC `erp-ui-classes` import | `DataTable` `overflow-x-auto`, `StateBlock` empty state, `--ds-*` contrast, `dir`, `ds-focus-ring` | `tier2-panel-fin-pos.test.ts`, `tier3-print-public.test.ts` | None |
| 43 | `src/app/(panel)/users/page.tsx` | `/users` | Tier 3 | `UsersPanel`, `UserDialog` (zero credential/bulk mutations) | `Asia/Kuwait` `formatDateTime`, `formatInt` total, `UNAVAILABLE_DASH` tooltip; zero password/PIN/role mutations or bulk actions | Light+dark `SectionCard` & `StateBlock` (`empty`), `overflow-x-auto` (`text-start`), inline 2-step delete confirm (no `alert`/`confirm`) | `tier3-admin-iam.test.ts` | None |
| 44 | `src/app/(panel)/warehouses/page.tsx` | `/warehouses` | Tier 2 | `VentureWarehousesHub`, `WarehouseForms`, transfers table | `datetimeFor` -> `Asia/Kuwait` `formatDateTime`; preserved `visibleProductWhere`, `ALLOWED_WAREHOUSE_CODES`, `isStockTransferProduct` | Fixed Arabic `titleEn` leak & `WarehouseForms` light-only `bg-white` clash via `SectionCard` + `--ds-*`, `overflow-x-auto` | `tier2-panel-fin-pos.test.ts` | None |
| 45 | `src/app/(pos)/pos/page.tsx` | `/pos` | Tier 2 | `VenturePosHub`, `PosTerminal` | Verified 3-decimal `formatKwd` (`0.000 KWD`) precision & zero invented numbers | Replaced Arabic pill leak w/ `SectionCard` + `StateBlock` (`unlinked`), `min-h-11` touch links, high contrast, `ds-focus-ring` | `tier2-panel-fin-pos.test.ts` | `TODO(Abdullah)`: keep read-only while Odoo POS runs on branch terminals? |
| 46 | `src/app/admin/ai-runs/page.tsx` | `/admin/ai-runs` | Tier 3 | `AiRunsPage`, `BriefPanel` Feryal/council telemetry | Preserved `session.role !== 'admin'` guard, `Asia/Kuwait` `formatDateTime` (`UTC+3`), `formatInt`, `UNAVAILABLE_DASH` tooltip, sanitized DB error | Bilingual AR/EN (`getLocale()` + `tx()`), light+dark `SectionCard` & `StateBlock` (`forbidden`/`error`/`empty`), `overflow-x-auto` | `tier3-admin-iam.test.ts` | `TODO(Abdullah)`: move under `/erp/admin` tab? |
| 47 | `src/app/admin/page.tsx` | `/admin` | Tier 3 | `ProductManager` (Supabase inventory manager) | 3-dec `formatKwd` for `priceMinor`, `formatInt` counts/pages, `UNAVAILABLE_DASH` tooltip; `authenticateUser` untouched | Light+dark `SectionCard` & `StateBlock` (`forbidden`/`error`/`empty`), `dir`, `aria-label` search, removed `#1c2128` dark-only card | `tier3-admin-iam.test.ts` | `TODO(Abdullah)`: consolidate under `/erp/admin`? |
| 48 | `src/app/download/page.tsx` | `/download` | Tier 3 | `DownloadView` & `InstallCard` launcher, backup, QR | Preserved `/api/download/*` & `/login` endpoints; null QR -> `StateBlock` (`unavailable`); RSC-safe `cx` in `StateBlock` | Replaced raw `<img>` w/ `next/image` (`0` warnings), AR/EN + `LanguageSwitch`, `--ds-*` tokens, `min-h-11 ds-focus-ring`, `break-all` URL | `tier3-print-public.test.ts` | `TODO(Abdullah)`: confirm public vs `aether_exec_session` access in `middleware.ts` |
| 49 | `src/app/erp/admin/page.tsx` | `/erp/admin` | Tier 3 | `AdminWorkspace` (`accounts`/`permissions`/`activity`/`security`), `AdminExecutiveDirectoryCard` | `Asia/Kuwait` `formatDateTime`, 3-dec `formatKwd`, null -> `—` + tooltip; preserved `effectiveRole !== 'admin'` & zero password hashes | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, `StateBlock`, `--ds-*` tokens, `role="tablist"`, inline 2-step demo-purge confirm | `tier3-admin-iam.test.ts` | None |
| 50 | `src/app/erp/aggregator-radar/page.tsx` | `/erp/aggregator-radar` | Tier 1 | `DeliveryRadarV5` KPIs, AR aging, 8 platforms, donut, matrix | 3-dec `formatKwd` (`null -> "—"`), localized EN strings (`Unattributed to Branch`, `Not posted yet`), `channelsUnavailable` null guards | `<h1>` -> `<h2>`, `h-9.5` -> `h-9`, `ChartCard` donut, `StateBlock` (`loading`/`empty`/`error`+retry), `aria-pressed` cards | `tier1-sales-cores.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 51 | `src/app/erp/ai/page.tsx` | `/erp/ai` | Tier 2 / 3 | `AiWorkspace`, `ExecutiveCenter`, `KpiGrid`, `InsightRow`, `RulesPanel` | `Asia/Kuwait` `formatDateTime`, 3-dec `AiMoney` (`formatKwd`), `formatInt`, `formatPct`, `KpiCard` null -> `—`, sanitized `condition_invalid` | `min-w-0` wrapper, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*` across all 11 `ai/ui` files, `StateBlock`, `ds-focus-ring` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | `TODO(Abdullah)`: merge rules into `/erp/feryal-ai` or `/erp/governance`? |
| 52 | `src/app/erp/ai-brief/page.tsx` | `/erp/ai-brief` | Tier 1 | `ReportBody`, `RunBriefButton`, `CopyIssueDraft` | Cookie-safe `locale`, `Asia/Kuwait` `formatDateTime` (`UTC+3`), 3-dec `formatKwd` + `formatInt` citations, `agreed`/`contradiction` badges | Removed nested `<main>`, `text-[11px]` -> `text-xs`, AR/EN parity, `StateBlock` (`error`/`empty`), `dir="ltr" tabular-nums` cooldown | `tier1-feryal-ops.test.ts` | None |
| 53 | `src/app/erp/alerts/page.tsx` | `/erp/alerts` | Tier 1 / 2 | `AlertsCenterV2` live governance alerts & unlinked notice | Zero fabricated alerts; 3-dec `formatKwd`, `formatInt`, `Asia/Kuwait` `formatDateTime` (`UTC+3`), `!isAuditor` action gate | `<h1 className="sr-only">` (`ROUTES_WITH_OWN_H1`), `StateBlock` (`loading`/sanitized `error`+retry/`empty`), `--ds-*` tokens | `tier1-feryal-ops.test.ts`, `tier2-erp-ops.test.ts` | None |
| 54 | `src/app/erp/archive/page.tsx` | `/erp/archive` | Tier 3 | `ArchiveWorkspace` smart archive router & ledger | Added `requirePageUser('/erp/archive')` + auditor read-only guard, 3-dec `formatKwd`, `formatInt`, `UNAVAILABLE_DASH`, sanitized errors | Removed nested `<main>`, bilingual `generateMetadata()`, `<h1>` -> `SectionCard` `<h2>`, `text-[11px]` -> `text-xs`, `StateBlock` | `tier3-admin-iam.test.ts` | None |
| 55 | `src/app/erp/before-after/page.tsx` | `/erp/before-after` | Tier 1 | `BeforeAfterStudio` + `ExecutiveComparisonControlBar` | 3-dec `formatKwd`/`formatChartKwdTooltip`, `school-canteens` in `OPERATING_BRANCH_IDS`, `Least Decline`/`أقل تراجع` badge, GL null dash | `<OdooPartialWarningBanner>`, `StateBlock` (`loading`/`empty`/`error`+retry), `dir="ltr" tabular-nums`, chart `role="region"` + axis units | `tier1-sales-cores.test.ts`, `tier1-data-contracts.test.ts` | None |
| 56 | `src/app/erp/booth-feasibility/page.tsx` | `/erp/booth-feasibility` | Tier 2 | `BoothStudyV5` presets, scenario KPIs, breakdown, contract AI | Marked hypothetical; `f0`/`f1`/`f3` -> 3-dec `formatKwd` (`+2,248.000`), `formatInt`, `formatPct`, excluded-brand filter, sanitized errors | `text-[10.5px]`/`text-[11px]` -> `text-xs`, `StateBlock` on contract check, WCAG AA contrast, `dir="ltr" tabular-nums`, zero `<h1>` | `tier2-erp-intel.test.ts`, `tier2-routes-states.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/events-intelligence`? |
| 57 | `src/app/erp/brand-sales-analytics/page.tsx` | `/erp/brand-sales-analytics` | Tier 1 | `BrandSalesAnalyticsDashboard` KPIs, donut `ChartCard`, 6-brand `DataTable` | Added `requirePageUser`, removed `"أكتوبر 2026"` copy, wired live Odoo `useGlobalFilter()` + period cube, 3-dec `formatKwd`, `brandsUnavailable` -> `—` | Removed nested `<main>`, studio `<h2>`, `StateBlock` (`loading`/`empty`/`error`+retry/`unavailable`), `DataTable` `overflow-x-auto` | `tier1-sales-cores.test.ts` | None |
| 58 | `src/app/erp/competitors/page.tsx` | `/erp/competitors` | Tier 2 / 3 | `TalabatGeoZoneRadar` & `CompetitorsIntelligenceStudio` | Bilingual `requiredSourceAr`/`requiredSourceEn` across both unlinked notices (zero Arabic leak in EN, zero synthetic rankings) | Canonical `TopFilterBar` `<h1 className="sr-only">`, removed nested `<main>`, `min-w-0` wrapper, light+dark `--ds-*` tokens, zero studio `<h1>` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 59 | `src/app/erp/compliance/page.tsx` | `/erp/compliance` | Tier 2 / 3 | `ComplianceWorkspace` rules, simulation, blocked attempts | Preserved `requirePageUser`, `Asia/Kuwait` `formatDate` (replacing UTC slice), 3-dec `formatKwd`, `formatInt`, sanitized `compliance_blocked` | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*` tokens, `StateBlock`, `role="tablist"` | `tier2-erp-ops.test.ts`, `tier3-admin-iam.test.ts` | None |
| 60 | `src/app/erp/contracts/page.tsx` | `/erp/contracts` | Tier 2 / 3 | `ContractsAdvisor` contract list & AI risk analysis | Preserved `requirePageUser`, `Asia/Kuwait` `formatDate`, 3-dec `formatKwd`, `formatInt`, `UNAVAILABLE_DASH` tooltip | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*` tokens, `StateBlock` (`loading`/`error`/`forbidden`/`empty`) | `tier2-erp-ops.test.ts`, `tier3-admin-iam.test.ts` | None |
| 61 | `src/app/erp/cores/page.tsx` | `/erp/cores` | Tier 1 | `CoresHubStudio` (`sales`, `menu`, `marketing` tabs) | 3-dec `formatKwd`/`formatChartKwdTooltip` & `round3` AOV, fixed `brandByBranch` cell `.netKwd`, `branches/brands/menuUnavailable` -> `—` | `<h1>` -> `<h2>`, `15`x `text-[11px]` -> `text-xs`, `StateBlock`, modal `Esc`, `dir="ltr" tabular-nums`, RTL `start-3 ps-9 pe-3` | `tier1-sales-cores.test.ts`, `tier1-data-contracts.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 62 | `src/app/erp/cost-intelligence/page.tsx` | `/erp/cost-intelligence` | Tier 1 | `CostIntelligenceV2` PO KPIs, vendor & product tables | 3-dec `formatKwd`, `formatInt`, `formatPct`, `formatQty`, `Asia/Kuwait` `formatDate`, `isNonCompanyCatalogItem` filter, `PartialWarningBanner` | `<h1 className="sr-only">` + studio `<h2>`, `KpiCard` + `StateBlock` (`loading`/`error`/`unlinked`/`empty`+Retry), `dir="ltr" tabular-nums` | `tier1-feryal-ops.test.ts`, `tier2-routes-states.test.ts` | None |
| 63 | `src/app/erp/crm/page.tsx` | `/erp/crm` | Tier 2 | `CrmWorkspace` (`customers`, `pipeline`, `quotations`, `profile`) | 3-dec `CrmMoney` (`formatKwd` + null tooltip), `Asia/Kuwait` `formatCrmDateTime`, sanitized form/picker/profile errors | Canonical `TopFilterBar` `<h1 className="sr-only">`, removed nested `<main>`, studio `<h2>`, light+dark `--ds-*` (`SectionCard`, `StateBlock`, `CrmModal` `Esc`), `overflow-x-auto` | `tier2-erp-intel.test.ts` | `TODO(Abdullah)`: consolidate w/ `/crm` & `/erp/sales-crm`? |
| 64 | `src/app/erp/delivery/page.tsx` | `/erp/delivery` | Tier 2 / 3 | `DeliveryWorkspace` partners, orders, settlements | `Asia/Kuwait` `todayKuwait()` (`formatDate`), 3-dec `formatKwd`, `formatInt`, `UNAVAILABLE_DASH` tooltip | `min-w-0` wrapper, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*`, `StateBlock` (`loading`/`error`/`forbidden`/`empty`), `overflow-x-auto` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 65 | `src/app/erp/delivery-control/page.tsx` | `/erp/delivery-control` | Tier 2 / 3 | `DeliveryControlV2` unlinked dispatch studio | Stripped `"غير مربوط بمصدر — "` from `titleEn`, added bilingual `requiredSourceEn` | Canonical `TopFilterBar` `<h1 className="sr-only">`, removed nested `<main>`, `min-w-0` wrapper, `p-3.5 sm:p-5`, zero studio `<h1>`, light+dark `--ds-*` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 66 | `src/app/erp/delivery-sla/page.tsx` | `/erp/delivery-sla` | Tier 1 | `DeliverySlaStudio` unlinked SLA notice | Preserved honest `<UnlinkedSourceNotice />` (zero invented SLA metrics), cleaned Arabic prefix in `titleEn` + `requiredSourceEn` | `min-w-0 overflow-x-hidden`, `p-3.5 sm:p-5`, clean EN pill (`Unlinked from Source`) | `tier1-feryal-ops.test.ts` | None |
| 67 | `src/app/erp/demand-forecast/page.tsx` | `/erp/demand-forecast` | Tier 2 / 3 | `DemandForecastV2` unlinked AI demand studio | Stripped `"غير مربوط بمصدر — "` from `titleEn`, added bilingual `requiredSourceEn` | `<h1 className="sr-only">` (`ROUTES_WITH_OWN_H1`) & `min-w-0` wrapper, `p-3.5 sm:p-5`, zero studio `<h1>` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 68 | `src/app/erp/events-intelligence/page.tsx` | `/erp/events-intelligence` | Tier 2 | `BoothStudyV5` & `VentureEventsHub` | Inherits 3-dec `formatKwd`, null honesty, excluded-brand filter & bilingual `requiredSourceAr`/`En` | `min-w-0 p-3.5 sm:p-5`, zero studio `<h1>`, WCAG AA contrast, `dir="ltr" tabular-nums` | `tier2-erp-intel.test.ts` | `TODO(Abdullah)`: redirect to `/erp/booth-feasibility`? |
| 69 | `src/app/erp/events-projects/page.tsx` | `/erp/events-projects` | Tier 2 | `VentureEventsHub` seasonal & outdoor events | Bilingual `requiredSourceAr`/`requiredSourceEn` on `UnlinkedSourceNotice` (zero Arabic leak in EN) | Canonical `TopFilterBar` `<h1 className="sr-only">`, removed nested `<main>`, `min-w-0 p-3.5 sm:p-5`, zero studio `<h1>` | `tier2-erp-intel.test.ts` | `TODO(Abdullah)`: merge as tab in `/erp/booth-feasibility`? |
| 70 | `src/app/erp/executive-pnl/page.tsx` | `/erp/executive-pnl` | Tier 1 | `ExecutivePnlStudio` GL P&L, income statement, brand/branch shares | 3-dec `formatKwd`, `formatPct`, `formatInt`, `formatKuwaitDate`; `brands.month`/`year` failure -> `"—"`/`"غير متاح"` & no `2%` bar | Light+dark `ds-surface`, `StateBlock` (`loading`/`unlinked`/`empty`), `PartialWarningBanner`, `role="progressbar"`, `ds-focus-ring` | `tier1-finance-settings.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 71 | `src/app/erp/feryal/page.tsx` | `/erp/feryal` | Tier 1 | Server `307` redirect to `/erp/feryal-ai` | Verified query-preserving server redirect (`?prompt=...&branch=...`) | Pure server redirect (zero nested `<main>`) | `tier1-feryal-ops.test.ts` | None |
| 72 | `src/app/erp/feryal-ai/page.tsx` | `/erp/feryal-ai` | Tier 1 | `FeryalGovernanceStudio`, `FeryalSidebarNotebooks`, `GovernanceBellDrawer` | `school-canteens` branch queries & ranking, 3-dec `formatKwd`, `Asia/Kuwait` midnight chat grouping & memory dates (`23:30 UTC -> 2026-11-16`), 2-of-3 consensus badges | Studio `<h1>` -> `<h2>`, `text-[11px]` -> `text-xs`, `StateBlock` loading/error/empty, `Esc` drawer, `role="tablist"` | `tier1-feryal-ops.test.ts`, `tier1-data-contracts.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 73 | `src/app/erp/finance/page.tsx` | `/erp/finance` | Tier 1 / 3 | `VentureAccountingHub` (`7` tabs) & `FinanceHub` | Fixed Arabic leaks in EN (`No Odoo GL data`, `Incomplete GL`, `Unposted`), 3-dec `formatKwd`, `receivables.unavailable` -> `—` | Light+dark quick-access bar, `h2` when `embeddedInErp`, `role="tablist"`, auditor RBAC cost redaction preserved | `tier1-finance-settings.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 74 | `src/app/erp/food-safety/page.tsx` | `/erp/food-safety` | Tier 2 | `FoodSafetyHub` HACCP & site catalog | Deduplicated `listFoodSafetySites` IDs + `isExcludedOdooEntity` guard, fixed mixed EN title + `requiredSourceEn`, dynamic `getLocale()` | `requirePageUser('/erp/food-safety')`, `<h1 className="sr-only">` (`ROUTES_WITH_OWN_H1`), removed nested `<main>`, `p-3.5 sm:p-5` | `tier2-erp-ops.test.ts`, `tier2-routes-states.test.ts` | None |
| 75 | `src/app/erp/governance/page.tsx` | `/erp/governance` | Tier 1 / 2 | `GovernanceDesk` violations, inquiries, circulars, tasks | `requirePageUser` + auditor permission strip, 3-dec `formatKwd`, `formatInt`, `Asia/Kuwait` `formatDate` (`due`/`deadline`/`asOf`), sanitized errors; PIN gate untouched | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*`, `StateBlock` (`loading`/`error`/`forbidden`/`empty`+retry), `role="tablist"` | `tier1-feryal-ops.test.ts`, `tier2-erp-ops.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 76 | `src/app/erp/hr/page.tsx` | `/erp/hr` | Tier 2 | `HrWorkspace` employees, attendance, leaves, payroll, expenses | 3-dec `formatKwd`, `formatInt`, `Asia/Kuwait` `formatDate`/`formatDateTime`; credentials/PIN/roles untouched | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, `text-[11px]` -> `text-xs`, `overflow-x-auto`, `StateBlock`, `Esc` modal | `tier2-erp-ops.test.ts` | `TODO(Abdullah)`: consolidate w/ `/hr`? |
| 77 | `src/app/erp/iam/accept/page.tsx` | `/erp/iam/accept` | Tier 3 | `AcceptInvitation` token form | Kept `acceptInvitationSchema`, `/api/v1/iam/invitations/accept`, token & session logic 100% untouched | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*`, `ds-focus-ring`, `dir="ltr"` token/`tenantId` | `tier3-admin-iam.test.ts` | `TODO(Abdullah)`: confirm public vs admin-gated access for external invitees |
| 78 | `src/app/erp/iam/page.tsx` | `/erp/iam` | Tier 3 | `IamWorkspace`, `MemberDialog`, `RoleDialog`, `InvitationDialog` | `Asia/Kuwait` `formatDateTime`, `formatInt`, `IamUnavailableDash` + tooltip, zero token leaks on existing invitations | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `IamPagedTable` + `IamModal`, `StateBlock`, `ds-focus-ring` | `tier3-admin-iam.test.ts` | None |
| 79 | `src/app/erp/intelligence/page.tsx` | `/erp/intelligence` | Tier 2 / 4 | `IntelligenceWorkspace` (`hr.expense` custody alerts) | Cleaned Arabic prefix from `titleEn` (`Unlinked Source — Petty Cash & Custody Anomaly Alerts`), zero static alert amounts | Migrated `<h1>` -> `SectionCard` `<h2>`, removed `'/erp/intelligence'` from `ROUTES_WITH_OWN_H1` (single `TopFilterBar` `<h1>`), `ds-focus-ring` | `tier2-erp-intel.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 80 | `src/app/erp/inventory/page.tsx` | `/erp/inventory` | Tier 2 / 3 | `InventoryWorkspace` (`8` `inventory/ui` files) & `InventoryHub` | 3-dec `formatKwd` / `SuiteMoney`, `formatInt`, `formatPct`, `Asia/Kuwait` `formatDateTime`, `UNAVAILABLE_DASH` tooltip | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, `KpiCard` + `StateBlock`, `overflow-x-auto`, light+dark `Modal` | `tier2-erp-ops.test.ts`, `tier3-admin-iam.test.ts` | `TODO(Abdullah)`: consolidate w/ `/inventory`? |
| 81 | `src/app/erp/kds/page.tsx` | `/erp/kds` | Tier 2 | `VentureKdsHub` inside `ErpShell` | Dynamic `getLocale()` passed to `<VentureKdsHub />`, `requirePageUser('/erp/kds')` | Removed nested `<main>`, `<StateBlock state="loading" />` Suspense fallback, `min-h-11` navigation bar | `tier2-erp-ops.test.ts` | `TODO(Abdullah)`: keep shell view + `/kds` wall kiosk? |
| 82 | `src/app/erp/kitchen/page.tsx` | `/erp/kitchen` | Tier 2 | `KitchenWorkspace` production runs, recipes, waste | 3-dec `formatKwd`, `formatInt`, `Asia/Kuwait` `formatDate`/`todayKuwait()`, `UNAVAILABLE_DASH` on nulls | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, `min-h-11` high-contrast touch controls, `StateBlock` | `tier2-erp-ops.test.ts` | None |
| 83 | `src/app/erp/ledger/page.tsx` | `/erp/ledger` | Tier 1 / 4 | `LedgerWorkspace` (`Accounts`, `Journals`, `Periods`, `Trial Balance`) | `Asia/Kuwait` `formatKuwaitDateTime` across `LedgerWorkspace`, `JournalEntryDialog`, `PeriodDialog`, `common.dateTimeText` | Replaced outer `<main>` -> `<div>` (`0` nested `<main>`), `StateBlock` (`loading`/`error`/`empty`/`forbidden`), `dir="ltr" tabular-nums` | `tier1-finance-settings.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 84 | `src/app/erp/market/page.tsx` | `/erp/market` | Tier 2 / 3 | `CompetitorsIntelligenceStudio` | Stripped Arabic prefix from `titleEn`, added bilingual `requiredSourceEn`, zero synthetic competitor metrics | `<h1 className="sr-only">` (`ROUTES_WITH_OWN_H1`) & `min-w-0` wrapper, zero studio `<h1>`, light+dark `--ds-*` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 85 | `src/app/erp/marketing/page.tsx` | `/erp/marketing` | Tier 2 / 3 | `MarketingHub` (`suite/ui/MarketingHub.tsx`) | 3-dec `SuiteMoney` (`formatKwd`), `formatInt`, `UNAVAILABLE_DASH` tooltip | `min-w-0` wrapper, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*`, `StateBlock`, `overflow-x-auto` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 86 | `src/app/erp/menu-engineering/page.tsx` | `/erp/menu-engineering` | Tier 1 | `CoresHubStudio` (`initialTab="menu"`) | 3-dec `formatKwd`, `menuUnavailable` -> `StateBlock` (`unavailable`), `isNonCompanyCatalogItem` (`0` croissant/avocado) | `<h1>` -> `<h2>`, `text-[11px]` -> `text-xs`, RTL search `start-3 ps-9 pe-3`, `overflow-x-auto` SKU table | `tier1-sales-cores.test.ts`, `tier2-routes-states.test.ts` | None |
| 87 | `src/app/erp/odoo-sync/page.tsx` | `/erp/odoo-sync` | Tier 1 / 4 | `AdminPosTerminalMappingPanel` + `OdooSync` | `formatKwd`/`formatInt`, `Asia/Kuwait` `formatKuwaitDateTime`, sanitized errors via `t(errorKey)`, preserved `effectiveRole !== 'admin'` | Replaced outer `<main>` -> `<div>` (`0` nested `<main>`), `StateBlock` (`loading`/`error`/`empty`), `type="password"`, `ds-focus-ring` | `tier1-finance-settings.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 88 | `src/app/erp/operations/page.tsx` | `/erp/operations` | Tier 2 | `OperationsWorkspace` (`contracts`, `documents`, `quality`) | 3-dec `formatKwd`, `Asia/Kuwait` `formatDate`, sanitized `errorKey` errors | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `SectionCard`/`StateBlock`, `role="tablist"`, `overflow-x-auto` | `tier2-erp-ops.test.ts` | None |
| 89 | `src/app/erp/org/page.tsx` | `/erp/org` | Tier 3 | `OrgWorkspace`, `BrandDialog`, `BranchDialog` | `Asia/Kuwait` `formatDateTime` & default branch TZ `Asia/Kuwait`, `formatInt` counts, `OrgUnavailableDash` tooltip | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `OrgPagedTable` + `OrgModal`, `StateBlock`, `ds-focus-ring` | `tier3-admin-iam.test.ts` | None |
| 90 | `src/app/erp/page.tsx` | `/erp` | Tier 1 | `FullJourney360` hero KPIs, combo chart, branches, GL, AR, 10-KWD | `f0`/`f1`/`f2` -> 3-dec `formatKwd`, `formatInt`, `formatPct`, `UNAVAILABLE_DASH` + tooltip, partial/unavailable `StateBlock`s | `text-[11.5px]` -> `text-xs`, `dir="ltr" tabular-nums`, preserved `grid-cols-2 lg:grid-cols-4`, `p-3.5 sm:p-5`, auditor cost masking | `tier1-chrome-overview.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 91 | `src/app/erp/planning/page.tsx` | `/erp/planning` | Tier 2 | `StrategicPlanningStudio` (`30d/90d/6m/12m` horizons, phases) | 3-dec `formatKwd`, `formatInt`, `formatPct`, `Asia/Kuwait` `formatDateTime`, `sanitizeStrategicPhases` exclusion filter, honest `Incomplete GL` | `text-[11px]`/`11.5px` -> `text-xs`, `StateBlock state="empty"` on disconnect, `dir="ltr" tabular-nums`, zero `<h1>` | `tier2-erp-intel.test.ts`, `tier2-routes-states.test.ts` | None |
| 92 | `src/app/erp/prep-sla/page.tsx` | `/erp/prep-sla` | Tier 1 | `OrderPrepSlaStudio` unlinked kitchen SLA notice | Preserved honest `<UnlinkedSourceNotice />` (zero invented SLA metrics), cleaned Arabic prefix in `titleEn` + `requiredSourceEn` | `<StateBlock state="loading" />` Suspense fallback, `min-w-0 overflow-x-hidden`, `p-3.5 sm:p-5` | `tier1-feryal-ops.test.ts` | None |
| 93 | `src/app/erp/procurement/page.tsx` | `/erp/procurement` | Tier 2 | `ProcurementWorkspace` (`15` `procurement/ui` files) | 3-dec `formatMinorKwd` (`formatKwd`), `formatInt`, `formatPct`, `Asia/Kuwait` `formatDate`/`dateTimeText`; P2P schemas untouched | Removed nested `<main>`, `<h1>` -> `SectionCard` `<h2>`, light+dark `PagedTable` (`StateBlock` + `overflow-x-auto`), `Esc` `Modal` | `tier2-erp-ops.test.ts` | `TODO(Abdullah)`: consolidate w/ `/purchases`? |
| 94 | `src/app/erp/projects/page.tsx` | `/erp/projects` | Tier 2 / 3 | `ProjectsHub` (`suite/ui/ProjectsHub.tsx`) | 3-dec `SuiteMoney` (`formatKwd`), `Asia/Kuwait` Gantt dates (`kuwaitTodayMidnightMs`/`formatDate`), `formatInt`, `UNAVAILABLE_DASH` | `min-w-0` wrapper, `<h1>` -> `SectionCard` `<h2>`, light+dark `--ds-*`, `StateBlock`, `SuiteModal` (`Esc`), `overflow-x-auto` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | None |
| 95 | `src/app/erp/receivables/page.tsx` | `/erp/receivables` | Tier 1 | `ReceivablesAgingStudio` KPIs, aging buckets, AR account table | `fInt`/`f3` -> 3-dec `formatKwd`, `formatInt`, `Asia/Kuwait` `formatKuwaitDateTime`, `ar.unavailable` -> `StateBlock` (`unavailable`) + `"—"` | `<PartialWarningBanner />`, `StateBlock` (`loading`/`unavailable`/`empty`), `dir="ltr" tabular-nums`, light+dark contrast | `tier1-finance-settings.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 96 | `src/app/erp/recipes/page.tsx` | `/erp/recipes` | Tier 2 | `VentureRecipesHub` inside `ErpShell` | Dynamic `getLocale()` passed to `<VentureRecipesHub />`, `requirePageUser('/erp/recipes')` | Removed nested `<main>`, `<StateBlock state="loading" />` Suspense fallback, `min-w-0 overflow-x-hidden` | `tier2-erp-ops.test.ts` | `TODO(Abdullah)`: consolidate w/ `/recipes`? |
| 97 | `src/app/erp/regulations/page.tsx` | `/erp/regulations` | Tier 2 | `RegulationsComplianceStudio` Kuwait authority KPIs & notice | `sanitizeRegulations` exclusion filter, 4 `<KpiCard value={null} />` (`"—"` + tooltip) above `UnlinkedSourceNotice`, clean EN `titleEn` | `overflow-x-hidden`, preserved `grid-cols-2 lg:grid-cols-4` & `p-3.5 sm:p-5`, zero studio `<h1>` | `tier2-erp-ops.test.ts`, `tier2-routes-states.test.ts` | None |
| 98 | `src/app/erp/sales-analysis/page.tsx` | `/erp/sales-analysis` | Tier 1 | `CoresHubStudio` (`initialTab="sales"`) | 3-dec `formatKwd`/`formatChartKwdTooltip`, `round3` AOV, `hourly`/`channels`/`branches`/`brandsUnavailable` -> `"—"` | `<h1>` -> `<h2>`, `text-xs` floor, accessible `InteractiveHoverCharts` (`role="region"`, axis units, `Esc`), `dir="ltr"` islands | `tier1-sales-cores.test.ts` | None |
| 99 | `src/app/erp/sales-crm/page.tsx` | `/erp/sales-crm` | Tier 2 / 3 | `SalesCrmHub` + `CrmWorkspace` | 3-dec `SuiteMoney` & `CrmMoney` (`formatKwd`), `Asia/Kuwait` timestamps, `UNAVAILABLE_DASH` tooltip, sanitized errors | `min-w-0` wrapper, `<h1>` -> `SectionCard` `<h2>` across both `SalesCrmHub` & `CrmWorkspace`, light+dark `--ds-*` | `tier2-erp-intel.test.ts`, `tier3-admin-iam.test.ts` | `TODO(Abdullah)`: consolidate w/ `/erp/crm` & `/crm`? |
| 100 | `src/app/erp/sales-scorecard/page.tsx` | `/erp/sales-scorecard` | Tier 1 | `SalesScorecardStudio` KPIs, 6 brands, 7+1 branches, 8 channels | Removed `Math.round(nullableSalesKwd)` -> 3-dec `formatKwd`, `formatInt`, `formatPct`; `brands`/`channels`/`year` failure -> `"—"` (no `China Garden` default) | Light+dark `ds-surface`, `StateBlock` (`loading`/`empty`/`unlinked`), `PartialWarningBanner`, `aria-pressed`, removed `truncate` | `tier1-finance-settings.test.ts`, `phase-14-partial-and-batch.test.ts` | None |
| 101 | `src/app/erp/smart-dropzone/page.tsx` | `/erp/smart-dropzone` | Tier 2 / 4 | `SmartDropzonePortal` 7-dept counters, dropzone, ledger table | Rewired to `src/components/SmartDropzonePortal.tsx` (+ cleaned `modules/smart-dropzone/ui`), 3-dec `formatKwd`, `Asia/Kuwait` `formatDateTime`, sanitized errors | Canonical `TopFilterBar` `<h1 className="sr-only">`, removed nested `<main>`, studio `<h2>`, removed all `text-[10px]`/`text-[11px]` -> `text-xs`, `SectionCard` + `StateBlock`, `overflow-x-auto` | `tier2-erp-intel.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 102 | `src/app/erp/social-reviews/page.tsx` | `/erp/social-reviews` | Tier 2 | `SocialReviewsStudio` unlinked guest/social reviews | Stripped `'غير مربوط بمصدر — '` leak from `titleEn`, added bilingual `requiredSourceAr`/`En`; `social-campaigns` `Asia/Kuwait` date + `school-canteens` | Preserved `p-3.5 sm:p-5`, zero studio `<h1>`, clean EN rendering | `tier2-erp-intel.test.ts`, `tier2-routes-states.test.ts`, `phase-c-kuwait-and-quality.test.ts` | None |
| 103 | `src/app/erp/warehouse-chain/page.tsx` | `/erp/warehouse-chain` | Tier 1 | `WarehouseDailyChainStudio` CK/branch quants, transfers, SKUs | 2-dec `f2` -> 3-dec `formatKwd`, `formatInt`, `formatPct`, `school-canteens` stock location mapping, `isNonCompanyCatalogItem` filter, `PartialWarningBanner` | Studio `<h2>`, Suspense & fetch `StateBlock`s (`loading`/`error`/`timedOut`/`unlinked`+Retry), preserved `xl:grid-cols-5` & `p-3.5 sm:p-5` | `tier1-feryal-ops.test.ts`, `tier2-routes-states.test.ts` | None |
| 104 | `src/app/erp/weekday-comparison/page.tsx` | `/erp/weekday-comparison` | Tier 1 | `WeekdayComparisonStudio` + `ExecutiveComparisonControlBar` | 3-dec `formatKwd`/`formatChartKwdTooltip` & `OdooGapPill`, `school-canteens` support, pure AR Same-Hours bar, `Least Decline`/`أقل تراجع` | `<OdooPartialWarningBanner>`, `StateBlock` (`loading`/`empty`/`error`+retry), `w-68` -> `w-72`, chart `role="region"` + axis labels | `tier1-sales-cores.test.ts`, `tier1-data-contracts.test.ts` | None |
| 105 | `src/app/ess/page.tsx` | `/ess` | Tier 2 | `EssPortalClient` PIN login, payslips, attendance, leaves, docs | `.toFixed(3) KWD` -> 3-dec `formatKwd`, UTC `.slice(11,19)` -> `Asia/Kuwait` `formatDate`/`formatDateTime`, `UNAVAILABLE_DASH` tooltip, sanitized errors | Initial `loading` + empty `StateBlock`s, rendered `profile.documents`, fixed light-vs-`#11161f` clash via `--ds-*` & `SectionCard` | `tier2-panel-hr-ess.test.ts` | `TODO(Abdullah)`: confirm kiosk `aether_exec_session` vs standalone employee access in `middleware.ts` |
| 106 | `src/app/home/page.tsx` | `/home` | Tier 3 | Server auth redirect + `HomeFallback` `<Suspense>` | Auth/redirect logic (`requireUser`, `firstAllowedHref`) kept 100% untouched | Replaced `bg-slate-50` fallback w/ `HomeFallback` (`--ds-bg-canvas` + `StateBlock state="loading"`, `role="status"`, `aria-busy`) | `tier3-print-public.test.ts` | None |
| 107 | `src/app/login/page.tsx` | `/login` | Tier 3 | `LoginForm` & `LoginHero` | Preserved session checks, `POST /api/auth/login`, field names (`email`, `password`), and redirects; sanitized error alert copy | `text-[11px]` -> `text-xs`, `--ds-*` light/dark contrast on `LoginHero`, explicit `dir`, password visibility toggle (`aria-pressed`), `min-h-11` | `tier3-print-public.test.ts` | None |
| 108 | `src/app/page.tsx` | `/` | Tier 3 | Root server auth check & role-home redirect | `verifyExecSessionToken`, `/login`, and `resolveRoleDefaultHome` verified & kept 100% untouched | Pure server redirect (zero client markup) | `tier3-print-public.test.ts` | None |
| 109 | `src/app/pay/[token]/page.tsx` | `/pay/[token]` | Tier 3 | `PayView` & `PayCheckout` (`PENDING`/`PAID`/`EXPIRED`/`notFound`/`error`) | Preserved `getPublicPayment` & `checkoutPaymentAction`, 3-dec `formatKwd`, `Asia/Kuwait` `formatDateTime` (`UTC+3`), null -> `—`, zero secret leaks | `StateBlock` (`empty`/`error`/`unavailable`), full AR/EN + `LanguageSwitch`, `--ds-*` tokens, `min-h-11 ds-focus-ring`, 360px card | `tier3-print-public.test.ts` | `TODO(Abdullah)`: confirm public customer access in `middleware.ts` (`PUBLIC_PREFIX_PATHS`) |

---

## 4. Per-Branch & School Canteens (`41` NPIS Hawally, `42` FAIPS Ahmadi) Checklist

Verified dynamically against `src/lib/odoo/pos-registry.json` across `company-pos`, `excluded-entities`, `odooConsoleExtractor`, `odoo-live-connector` (`fetchLiveOdooSnapshot`, `fetchLiveOdooPeriodCube`, `fetchLiveOdooWarehouseChain`, `fetchLiveOdooPurchaseOrders`), `global-filter-engine`, `cores-hub-engine`, `erp-comparison-engine`, `before-after-engine`, `enterprise-reports-registry` (`VF-POS-01` & `VF-POS-02`), `buildBriefFactPack`, `feryal-odoo-agent`, and `feryal-council-facts` (`90` parameterized tests across `overnight-canteens-exclusions-matrix.test.ts` [`70/70`] + `tier1-data-contracts.test.ts` [`20/20`], plus Tier 2 stock/planning/campaign guards in `tier2-routes-states.test.ts` [`9/9`]).

### 4.1 Verification Checklist (`[x]`)

- [x] All `7` active restaurant branches (`promenade`, `360-mall`, `ardiya`, `assima`, `salmiya`, `al-kout`, `avenues`) match `src/lib/odoo/pos-registry.json` `1-to-1` across filter options, `OdooLiveSyncEnvelope`, `OdooPeriodCube`, `GlobalWorkspace`, `CoresHub`, `Comparison`, `BeforeAfter`, `VF-POS-02`, and Feryal structured facts (`0.001 KWD` fils precision).
- [x] Pinned school canteens **`41` (`NPIS Hawally`)** and **`42` (`FAIPS Ahmadi`)** map to `'school-canteens'` (`مقاصف المدارس`) when active and free of veto tokens, remain compatible with brand filters (`isBrandBranchCompatible`), appear in `VF-POS-02`, `Comparison`, `BeforeAfter`, `social-campaigns`, `warehouse-chain` (`byBranchOnHand['school-canteens']`), and Feryal queries, and sanitize raw district substrings via `sanitizePosTerminalDisplayName`.
- [x] Archived pinned registers `#16` (`E-Mall Promenade`) and `#35` (`Delivery Ardiya Temp`) remain excluded unless `active === true` (`ARCHIVED_PINNED_REGISTER_POLICY = 'active_only_todo_abdullah'`).
- [x] All `4` excluded entities (**`Heisenberg`** + POS category `#150`, **`Qurain`**, **closed `Hawally` restaurant**, **`Jahra`**) — including Arabic variants, English typos, and joined alphanumeric strings (`Jahra01`, `Hawally2`, `AlJahra`, `HeisenbergKW`, `QRN01`, `JHR2`) — contribute **`0` matches, `0.000 KWD`, and `0` orders** across every live snapshot, cube, stock quant, PO summary, strategic roadmap, regulation list, directory, and Feryal answer.
- [x] Non-company / demo catalog items (`croissant`, `avocado`, `كرواسون`, `كرواسان`, `أفوكادو`, `افوكادو`, migration-0033 SKUs `RIFDC012`..`RIFDC016` & `RW01486`..`RW01490`, `DEMO_PRODUCT_CODES`) are blocked across POS, warehouse chain, purchase orders, campaigns, and booth studies (`0` demo items surfaced).

### 4.2 Active Operating Branches & School Canteens Matrix (`8` Operating Units)

| Branch ID | EN / AR Label | Approved `pos.config` IDs | Options & Filter Scope | Live Envelope & PeriodCube (`0.001` KWD) | CoresHub & Chart/Tooltip Series | Comparison & Before/After | Reports (`VF-POS-02`) | Feryal Best/Worst & Council Facts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `promenade` | Promenade Mall / مجمع البروميناد | `8, 9, 10, 11` (`16` active-only) | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `360-mall` | 360 Mall / مجمع 360 | `17, 18` | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `ardiya` | Ardiya / العارضية | `3, 23` (`35` active-only; `dine-in` -> `takeaway-direct`) | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `assima` | Assima Mall / مجمع العاصمة | `14, 15` | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `salmiya` | Salmiya / السالمية | `19, 20` | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `al-kout` | Al-Kout Mall / مجمع الكوت | `21, 22` | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `avenues` | The Avenues / الأفنيوز | `34` | PASS | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |
| `school-canteens` | School canteens / مقاصف المدارس | Pinned `41` (**NPIS Hawally**) & `42` (**FAIPS Ahmadi**) | PASS (closed-district canteen exemption; active-only; vetoed on Heisenberg/Qurain/Jahra tokens) | PASS (`3`-dec Net, Orders, AOV) | PASS | PASS | PASS | PASS |

### 4.3 Excluded Entities & Non-Company Items Ban Matrix (`0` Matches & `0.000 KWD`)

| Excluded Target | Tested Variants & IDs | Register / Domain / Tree Filter | Live Snapshot, Cube, Reports & Feryal Contribution |
| --- | --- | --- | --- |
| **Heisenberg** | `Heisenberg`, `HeisenbergKW`, `Hizenberg`, `Heizenberg`, `Heisenburg`, `Haisenberg`, `هايزنبرغ`, `هايزن بريج`, `هايزن`, POS category `#150` (+ child categories) | Blocked (`isExcludedOdooEntity`, `isExcludedRecordId('pos_category', 150)`, `appendOdooNameExclusion`, `console.ts`, canteen veto) | `0` matches · `0.000 KWD` · `0` orders |
| **Qurain** | `Qurain`, `Qurain WH`, `Al-Qurain`, `Kurain`, `QRN`, `QRN01`, `القرين`, `قرين`, `بالقرين` | Blocked across all matchers, register allow-list, tree stripper & canteen veto | `0` matches · `0.000 KWD` · `0` orders |
| **Closed Hawally Restaurant** | `Hawally`, `Hawally2`, `Hawally Restaurant`, `Hawally School Street Branch`, `HWL`, `فرع حولي`, `حولي`, `بحولي`, `حولي - شارع المدارس` | Blocked everywhere while preserving pinned `#41` (`NPIS Hawally` / `مقصف مدرسة NPIS حولي`) & sanitizing UI terminal labels | `0` matches · `0.000 KWD` · `0` orders |
| **Jahra** | `Jahra`, `Jahra01`, `AlJahra`, `Jahara`, `JHR`, `JHR2`, `الجهراء`, `جهراء`, `الجهرة`, `بالجهراء`, `Delivery (Jahra)`, `Tasty Snacks(Jahra)` | Blocked across all matchers, register allow-list, tree stripper & canteen veto | `0` matches · `0.000 KWD` · `0` orders |
| **Demo / Non-Company Products** | `croissant`, `avocado`, `كرواسون`, `كرواسان`, `أفوكادو`, `افوكادو`, migration-0033 SKUs (`RIFDC012`..`RIFDC016`, `RW01486`..`RW01490`), `DEMO_PRODUCT_CODES` (`EL-1001`..`PT-4003`) | `0` hits across `>200` production files/scripts; `ODOO.menu = []`; `demoCatalogReadsHidden` enforced | `0` demo items surfaced |

---

## 5. Phase C Deep Quality Pass Summary (Commits `7b02920` & `c3a5f8a`)

### 5.1 Dead Code Removal (`16` Zero-Reference Orphan Files Deleted) & Preserved Candidates

- **Deleted `16` provably unreferenced legacy files** (independently verified `0` static or dynamic references across `src/`, `scripts/`, `tests/`, and `e2e/`):
  1. `src/components/Agents.tsx`
  2. `src/components/Branches.tsx`
  3. `src/components/CEORoom.tsx`
  4. `src/components/Delivery.tsx`
  5. `src/components/ErpHub.tsx`
  6. `src/components/InstallAppBanner.tsx`
  7. `src/components/Kitchen.tsx`
  8. `src/components/PanelSpotlight.tsx`
  9. `src/components/assistant-widget.tsx`
  10. `src/components/brand-logo.tsx`
  11. `src/components/notification-bell.tsx`
  12. `src/components/aether/DecisionBriefStrip.tsx`
  13. `src/components/aether/DeliveryEnterpriseTabs.tsx`
  14. `src/components/erp/ops-expansion/OpsFilterSyncBar.tsx`
  15. `src/lib/accounting/odoo-real-expenses-data.ts`
  16. `src/lib/hr/odoo-hr-dashboard-data.ts`
- **Cleaned unused imports & dead locals across `8` non-protected files:** `src/app/api/v1/hr/ingest-folder/route.ts`, `src/components/erp/feryal-governance-studio.tsx`, `src/components/erp/shell.tsx`, `src/components/hr-digital-dossier.tsx`, `src/modules/smart-dropzone/ui/SmartDropzonePortal.tsx`, `src/services/accounting.service.ts`, `src/services/apps.service.ts`, `src/services/bi.service.ts`, and `src/services/universal-folder-ingestor.service.ts`.
- **Intentionally Preserved Candidate Files (`5` items left untouched with documented rationale):**
  1. `src/instrumentation.ts` — Next.js 15 runtime instrumentation entrypoint (`register()`), invoked automatically by framework convention.
  2. `src/lib/aether/warehouse-chain-engine.ts` & `src/lib/ensure-official-admin.ts` — documented backwards-compatibility re-export shims.
  3. `src/lib/offline-pos.ts` — standalone browser `localStorage` POS offline queue helper (`enqueueSale`/`listQueued`/`removeQueued`), retained for future offline POS wiring.
  4. `src/app/api/erp/governance/route.ts` & `src/lib/scope.ts` — protected governance PIN / scope cookie symbols preserved untouched.
  5. `scripts/sync-odoo-live.mjs` UTC midnight boundary — preserved untouched per `TODO(Abdullah)` business-policy rule.

### 5.2 Canonical Formatting, `Asia/Kuwait` (`UTC+3`) Midnight Boundary & `55/55` ERP Shell Parity

- **RED-First Verification (`src/lib/__tests__/phase-c-kuwait-and-quality.test.ts`):**
  - Initial run before Phase C edits: **`6 failed | 2 passed (8)`** (catching `'2026-11-15'` instead of `'2026-11-16'` at `2026-11-15T23:30:00.000Z`, `'125.5'` instead of `'125.500'` in `charts.formatAmount`, `Math.round(nullableSalesKwd)` in `GlobalFilterContext`, local `getHours`/`getDate` in `common.tsx` & `hr.service.ts`, duplicate `<h1>` + Arabic `titleEn` in `IntelligenceWorkspace`, and the `16` orphan files).
  - Post-fix + cross-shard polish (`#178` -> `#179`): **`9 passed (9)`**.
- **`Asia/Kuwait` (`UTC+3`) `23:30 UTC = 02:30 Kuwait Next Day` Fixes (`10` live modules):**
  - `src/lib/format.ts` (`formatMonth` via `extractKuwaitParts`), `src/components/erp/common.tsx` (`dateTimeText` -> `formatDateTime`), `src/lib/feryal-learning-engine.ts` (`teachPermanentFact`, `recordDecisionOutcome`, `autoLearnFromConversationTurn`), `src/lib/feryal-chat-store.ts` (`filterAndGroupChats` `startOfToday` anchored at `+03:00`), `src/services/hr.service.ts` (`recordAttendance` Kuwait calendar date + `+03:00` check-in/out), `src/modules/governance/ui/GovernanceDesk.tsx`, `src/components/aether/FeryalSidebarNotebooks.tsx`, `src/components/erp/feryal-governance-studio.tsx`, `src/lib/aether/social-campaigns.ts`, and `src/app/api/aggregator-radar/alert/route.ts` (`getKuwaitDateString()`).
- **Canonical Formatting & `55/55` `/erp/*` Shell Parity:**
  - Migrated remaining user-facing formatters in `src/components/charts.tsx`, `src/components/aether/GlobalFilterContext.tsx`, `src/components/aether/ExecutiveCommandPalette.tsx`, `src/components/aether/InteractiveHoverCharts.tsx`, `src/components/aether/CostIntelligenceV2.tsx`, `src/components/erp/WarehouseDailyChainStudio.tsx`, `src/modules/smart-dropzone/ui/SmartDropzonePortal.tsx` (+ upgraded `text-[10px]`/`text-[11px]` -> `text-xs`), `src/lib/reports/enterprise-reports-registry.ts`, and `src/components/reports/DepartmentalReportsHub.tsx` (`formatKwd` / `formatInt` / `formatPct` cell rendering while preserving `VF-POS-02` internal row serialization).
  - Removed nested `<main>` in `/erp/ledger/page.tsx` and `/erp/odoo-sync/page.tsx` and synced `TopFilterBar.tsx` `ROUTES_WITH_OWN_H1` with `IntelligenceWorkspace.tsx` (`SectionCard` `<h2>`), achieving **`0` nested `<main>` tags and exact single-`<h1>` parity across all `55/55` `/erp/*` routes**.

---

## 6. New & Extended Test Suites Inventory (`18` Suites Touched Since `d61b35c`, `+267` Net New Tests)

### 6.1 Suite-by-Suite Coverage Table

| # | Test File | Status | Final Tests | Net New Since `d61b35c` | Primary Invariants Guarded |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/lib/__tests__/phase-14-partial-and-batch.test.ts` | Extended | `44` | `+16` *(had `28` in `d61b35c`)* | Blocker N2 `safeSubQuery` `null` + `PARTIAL_LIVE` across all sections/consumers (`A1`–`A9`) & Item B fail-closed batch sync |
| 2 | `src/lib/__tests__/format.test.ts` | New | `14` | `+14` | `formatKwd` (3-dec, `null -> '—'`, `-0`), `formatInt`, `formatPct`, `Asia/Kuwait` `formatDate`/`formatDateTime` midnight boundaries |
| 3 | `src/lib/__tests__/design-system-foundation.test.ts` | New | `11` | `+11` | `KpiCard`, `SectionCard`, `ChartCard`, `DataTable`, `StateBlock`, `PartialWarningBanner`, barrel parity, CSS tokens & `>=12px` floor |
| 4 | `src/lib/__tests__/overnight-canteens-exclusions-matrix.test.ts` | New | `70` | `+70` | Parameterized 8-branch (`7` restaurants + `school-canteens` `41`/`42`) & 4-excluded-entity (`Heisenberg`, `Qurain`, `Hawally`, `Jahra`) matrix |
| 5 | `src/lib/__tests__/tier1-data-contracts.test.ts` | New | `20` | `+20` | Cross-surface `0.001 KWD` AOV/branch parity, `school-canteens` in `VF-POS-02`/Comparison/Feryal, repo-wide `0` croissant/avocado ban |
| 6 | `src/lib/__tests__/tier1-chrome-overview.test.ts` | New | `13` | `+13` | `/erp` (`FullJourney360`), `/dashboard`, `TopFilterBar`, `GlobalFilterBar`, `OdooSyncPill`, `KpiProvenanceBadge`, AR/EN & auditor redaction |
| 7 | `src/lib/__tests__/tier1-sales-cores.test.ts` | New | `6` | `+6` | `CoresHubStudio` (`sales`/`menu`/`marketing`), `BrandSalesAnalyticsDashboard`, `DeliveryRadarV5`, `WeekdayComparisonStudio`, `BeforeAfterStudio` |
| 8 | `src/lib/__tests__/tier1-finance-settings.test.ts` | New | `9` | `+9` | `ExecutivePnlStudio`, `SalesScorecardStudio`, `ReceivablesAgingStudio`, `VentureAccountingHub`, `LedgerWorkspace`, `DepartmentalReportsHub`, Odoo settings |
| 9 | `src/lib/__tests__/tier1-feryal-ops.test.ts` | New | `14` | `+14` | `FeryalGovernanceStudio` (consensus/contradiction badges, Kuwait TZ), `ai-brief`, `CostIntelligenceV2`, `WarehouseDailyChainStudio`, SLA studios |
| 10 | `src/lib/__tests__/tier2-routes-states.test.ts` | New | `9` | `+9` | `109`-route `middleware.ts` auth matrix, `auditor` `403` mutation lockdown, Tier 2 non-company item & `school-canteens` stock location contracts |
| 11 | `src/lib/__tests__/tier2-panel-fin-pos.test.ts` | New | `6` | `+6` | `16` `(panel)` finance/sales/purchases/inventory/warehouses + `/pos` & `/kds` AR/EN SSR, 3-dec KWD, Kuwait TZ & visibility filters |
| 12 | `src/lib/__tests__/tier2-erp-ops.test.ts` | New | `10` | `+10` | `UnlinkedSourceNotice`, `AlertsCenterV2`, `GovernanceDesk`, and `11` `/erp/*` ops/HR/inventory/kitchen/procurement/regulations routes |
| 13 | `src/lib/__tests__/tier2-erp-intel.test.ts` | New | `13` | `+13` | `BoothStudyV5`, `StrategicPlanningStudio`, `SmartDropzonePortal`, `CrmWorkspace`, unlinked studios & `/erp/*` `<main>`/`<h1>` rules |
| 14 | `src/lib/__tests__/tier2-panel-hr-ess.test.ts` | New | `9` | `+9` | `/hr`, `/hr/compliance-radar`, `/hr/smart-folder-upload`, `/smart-ingest/[module]`, `/audit`, `/ess` exclusions, Kuwait TZ & 3-dec KWD |
| 15 | `src/lib/__tests__/tier3-settings.test.ts` | New | `13` | `+13` | `11` `(panel)` settings/profile/directory/saas/deploy/automations/app-builder routes, `5/5` `type="password"` secret masks, zero invented `/saas` KPIs |
| 16 | `src/lib/__tests__/tier3-print-public.test.ts` | New | `10` | `+10` | `4` print routes (`InvoiceSheet`, `PayrollSheet`, `StatementView`), `5` public/auth routes, zero `<img>`, RSC-safe `cx.ts` & `erp-ui-classes.ts` |
| 17 | `src/lib/__tests__/tier3-admin-iam.test.ts` | New | `15` | `+15` | `9` Admin/IAM/Org/Archive/Roles/Users routes (`effectiveRole === 'admin'` guards, zero user credential mutations) + `ai`/`delivery`/`suite` UIs |
| 18 | `src/lib/__tests__/phase-c-kuwait-and-quality.test.ts` | New | `9` | `+9` | `23:30 UTC -> 02:30 Kuwait next day` boundary, canonical formatting, `IntelligenceWorkspace` EN parity, `55/55` `/erp/*` `<main>`/`<h1>`, `16` deleted orphans |
| **Total** | **`18` Suites (`1` Extended + `17` New)** | **100% GREEN** | **`295`** | **`+267` net new** | **Full repository: `132` test files passed (`132/132`), `1,666` tests passed (`1,666/1,666`)** |

### 6.2 Verbatim Test-Directory Diff Stat (`b548541..HEAD` & `d61b35c..HEAD`)

*(Note: In `b548541..d61b35c`, `src/lib/__tests__/phase-13-count-atomicity.test.ts` had `+32/-26` lines solely to upgrade Phase 13's two prior `0`/`undefined` wrapped-failure expectations to Phase 14's `null` + `partial: true` + `'PARTIAL_LIVE'` contract. Across the entire overnight execution `d61b35c..HEAD`, `0` lines were deleted or weakened in any existing test file: `18 files changed, 12785 insertions(+)`.)*

```text
$ git diff --stat b548541..HEAD -- '**/__tests__/**'
 src/lib/__tests__/design-system-foundation.test.ts |  574 ++++++
 src/lib/__tests__/format.test.ts                   |  262 +++
 .../overnight-canteens-exclusions-matrix.test.ts   | 1209 ++++++++++++
 src/lib/__tests__/phase-13-count-atomicity.test.ts |   58 +-
 .../__tests__/phase-14-partial-and-batch.test.ts   | 1928 ++++++++++++++++++++
 .../__tests__/phase-c-kuwait-and-quality.test.ts   |  323 ++++
 src/lib/__tests__/tier1-chrome-overview.test.ts    |  621 +++++++
 src/lib/__tests__/tier1-data-contracts.test.ts     |  907 +++++++++
 src/lib/__tests__/tier1-feryal-ops.test.ts         | 1003 ++++++++++
 src/lib/__tests__/tier1-finance-settings.test.ts   |  647 +++++++
 src/lib/__tests__/tier1-sales-cores.test.ts        |  894 +++++++++
 src/lib/__tests__/tier2-erp-intel.test.ts          |  488 +++++
 src/lib/__tests__/tier2-erp-ops.test.ts            |  611 +++++++
 src/lib/__tests__/tier2-panel-fin-pos.test.ts      |  501 +++++
 src/lib/__tests__/tier2-panel-hr-ess.test.ts       |  603 ++++++
 src/lib/__tests__/tier2-routes-states.test.ts      | 1246 +++++++++++++
 src/lib/__tests__/tier3-admin-iam.test.ts          |  701 +++++++
 src/lib/__tests__/tier3-print-public.test.ts       |  587 ++++++
 src/lib/__tests__/tier3-settings.test.ts           |  623 +++++++
 19 files changed, 13760 insertions(+), 26 deletions(-)
```

---

## 7. Complete Consolidated `TODO(Abdullah)` Decision Registry

All business-policy, Odoo accounting, security-posture, and route-consolidation decisions were preserved without guessing:

### 7.1 Odoo Domain, POS Register & GL Ambiguities
1. **School Canteen `pos.config` IDs & `POS #43 "FAS Fahaheel"` (`src/lib/odoo/pos-registry.json:3`, `src/lib/odoo/company-pos.ts:20-21`):** Supply/confirm verified production Odoo `pos.config` IDs for `NPIS` (currently pinned `41`) and `FAIPS` (currently pinned `42`), and confirm whether `pos.config` `#43` (`"FAS Fahaheel"`) is a third active school canteen (currently excluded until confirmed).
2. **GL Account `#2839` (`src/lib/__tests__/phase-12-exclusions.test.ts:74`, `src/lib/__tests__/phase-9-company-pos.test.ts:43`):** Confirm whether GL account `#2839` (`Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS`) belongs to active `NPIS` school-canteen accounting (currently kept under the closed-branch canteen exemption) or to the closed Hawally restaurant branch.
3. **Archived Pinned Registers `#16` & `#35` (`src/lib/odoo/company-pos.ts:12-13`):** Confirm whether archived pinned registers `#16 E-Mall (Promenade)` and `#35 Delivery (Ardiya Temp)` should remain active-only (`ARCHIVED_PINNED_REGISTER_POLICY = 'active_only_todo_abdullah'`) or include historical orders.
4. **Mixed Label `"Hawally Restaurant Canteen"` Precedence (`docs/phases/phase-13-checklist.md:33`):** Confirm whether any non-NPIS label combining `"Hawally"` + `"Restaurant"` + `"Canteen"` should remain kept as a canteen record or require an explicit school code (`NPIS` / `FAIPS` / `FAS`).
5. **HR Compliance Service DB-Layer Exclusion (`src/services/hr-compliance.service.ts`):** Confirm whether excluded-entity filtering currently enforced in `ComplianceRadarClient` / `EnterpriseHrCommandHub` should also filter Prisma `Employee` queries directly inside `hr-compliance.service.ts`.

### 7.2 Batch Sync Script Semantics (`scripts/sync-odoo-live.mjs`)
1. **Refund Order Counts (`scripts/sync-odoo-live.mjs:281, 1089`):** Batch sync sums Odoo `read_group` `__count` across all orders including refunds (`amount_total < 0`), whereas the live connector counts non-refund orders (`['amount_total', '>=', 0]`). Confirm whether batch sync should switch to non-refund order counts.
2. **Negative Net Sales Clamp (`scripts/sync-odoo-live.mjs:978-1007, 1088, 1111`):** Batch sync clamps negative net amounts via `Math.max(0, ...)`, whereas the live connector preserves signed negative KWD (`posOrderNet`). Confirm whether to remove the clamp in batch sync.
3. **UTC Midnight vs. `Asia/Kuwait` (`+03:00`) Midnight (`scripts/sync-odoo-live.mjs:250-260, 1023-1034`):** Batch sync queries `pos.order.date_order` using naive `${from} 00:00:00` UTC, whereas the live connector converts `Asia/Kuwait` calendar-day bounds via `kuwaitDateBoundsToOdooUtc` (`21:00:00` prior UTC day). Confirm whether batch sync should switch to Kuwait midnight bounds.

### 7.3 Security, Auth & Edge Middleware Notes
1. **Executive Fallback Password Digests (`src/lib/auth/exec-session.ts:45-65, 440-443`):** Left 100% untouched per user-credential rules. Confirm whether compare-only `DEFAULT_*_PASSWORD_SHA256` / `DEFAULT_EXEC_APPROVAL_PIN_HASH` fallback digests should be disabled once `AETHER_*_PASSWORD` environment variables are provisioned in production.
2. **`/kds` Server-Component Defense-in-Depth (`src/app/(kds)/kds/page.tsx`):** Protected at the Edge by `src/middleware.ts`, but does not call `await requireUser()` inside the server component (unlike `/pos`, `(panel)/layout.tsx`, and `erp/layout.tsx`). Confirm adding `await requireUser()` on `(kds)/kds/page.tsx`.
3. **`/ess` Kiosk vs. Standalone Mobile Access (`src/middleware.ts`):** `/ess` (`ess_employee_session` PIN cookie) is currently gated behind `aether_exec_session` at the Edge; confirm whether `/ess` is intended strictly for executive-unlocked branch kiosks or should be added to `PUBLIC_EXACT_PATHS` for standalone employee mobile login.
4. **External Customer/Invitee Routes (`/pay/[token]`, `/download`, `/erp/iam/accept`):** Currently gated behind `aether_exec_session` in `src/middleware.ts` (and `/erp/iam/accept` behind `role === 'admin'` via `/erp/iam/` prefix in `role-access-policy.ts`); confirm whether external customers/invitees should bypass `aether_exec_session` at the Edge.

### 7.4 Duplicate-Route Consolidation Candidates (`TODO(Abdullah): consolidate?`)

| Overlapping Route Group | Current Implementations & Data Backends | Canonical / Sidebar Status | `TODO(Abdullah): consolidate?` Recommendation |
| --- | --- | --- | --- |
| `/automation` vs `/automations` | `(panel)/automation/page.tsx` is a 4-line re-export of `(panel)/automations/page.tsx` (`<VentureAutomationHub />`); modular rules also exist on `/erp/ai` | Neither in 17-item `erp-sidebar.tsx` | Redirect `/automation` -> `/automations` (`308`) or merge into `/erp/governance` / `/erp/ai` |
| `/erp/crm` vs `/crm` vs `/erp/sales-crm` | `/erp/crm` (`CrmWorkspace`, `/api/v1/crm/*`); `/crm` (`VentureCrmHub` + Prisma `CrmBoard`); `/erp/sales-crm` (`SalesCrmHub`, `/api/v1/suite/*`) | None in primary 17-item executive sidebar | Pick one canonical B2B/catering CRM surface (recommend `/erp/crm`) and redirect the other two |
| `/erp/kds` vs `/kds` | Both render `<VentureKdsHub />`: `/erp/kds` inside `<ErpShell>`, `/kds` inside chromeless wall-display `<KdsLayout>` | `/erp/prep-sla` in sidebar; `/kds` wall kiosk | Keep `/kds` as wall kiosk and `/erp/kds` as shell view (or redirect `/erp/kds` -> `/kds?shell=1`) |
| `/erp/kitchen` vs `/central-kitchen` | `/erp/kitchen` (`KitchenWorkspace`, `/api/v1/kitchen/*`); `/central-kitchen` (panel launcher); live Odoo CK transfers on `/erp/warehouse-chain` | `/erp/warehouse-chain` in sidebar | Redirect `/central-kitchen` -> `/erp/kitchen` (or `/erp/warehouse-chain`) |
| `/erp/recipes` vs `/recipes` | Both render `<VentureRecipesHub />`; `/recipes` also passes Prisma `RecipesPanel` as `legacyChildren` | Linked from kitchen/menu flows | Unify on `/erp/recipes` and redirect `/recipes` -> `/erp/recipes` |
| `/erp/inventory` vs `/inventory` | `/erp/inventory` (`InventoryHub` / `InventoryWorkspace`); `/inventory` (Prisma `InventoryPanel`); live Odoo quants on `/erp/warehouse-chain` | `/erp/warehouse-chain` in sidebar | Consolidate `/inventory` into `/erp/inventory` (with `/erp/warehouse-chain` for live Odoo `stock.quant`) |
| `/erp/hr` vs `/hr` | `/erp/hr` (`HrWorkspace`, `/api/v1/hr/*`); `/hr` (`EnterpriseHrCommandHub` + `/hr/compliance-radar` + `/hr/smart-folder-upload`) | Blocked for `auditor`/`marketing`/`supply` | Merge HR sub-tools (`compliance-radar`, `smart-folder-upload`) under one canonical HR hub |
| `/erp/finance` vs `/accounting` | `/erp/finance` (`VentureAccountingHub` live Odoo GL/AR); `/accounting` (local Prisma COA/journals/trial balance) | `/erp/executive-pnl` & `/erp/receivables` in sidebar | Keep `/erp/finance` for live Odoo GL and fold local journal tools or redirect `/accounting` |
| `/erp/odoo-sync` vs `/settings/odoo-sync` | `/erp/odoo-sync` (`AdminPosTerminalMappingPanel` + `OdooSync`); `/settings/odoo-sync` (`OdooSyncPanel` + `/settings/odoo-data-center`) | Linked from top bar / settings | Keep `/erp/odoo-sync` canonical and fold dump-import/data-center tools into tabs |
| `/erp/admin` vs `/admin` | `/erp/admin` (`AdminWorkspace`, `role === 'admin'`); `/admin` (Supabase `ProductManager`) + `/admin/ai-runs` | `/erp/admin` is canonical admin console | Move `/admin` and `/admin/ai-runs` under `/erp/admin` tabs inside `ErpShell` |
| `/erp/ai` vs `/erp/feryal-ai` (and `/erp/feryal`) | `/erp/feryal` redirects `307` -> `/erp/feryal-ai` (`FeryalGovernanceStudio`); `/erp/ai` mounts modular `AiWorkspace` | `/erp/feryal-ai` in sidebar | Keep `/erp/feryal` redirect; decide whether `/erp/ai` rules belong inside `/erp/feryal-ai` or `/erp/governance` |
| `/erp/booth-feasibility` vs `/erp/events-intelligence` vs `/erp/events-projects` | `/erp/booth-feasibility` & `/erp/events-intelligence` both mount `<BoothStudyV5 />`; `/erp/events-projects` mounts `<VentureEventsHub />` | `/erp/booth-feasibility` in sidebar | Redirect `/erp/events-intelligence` -> `/erp/booth-feasibility` and optionally merge `/erp/events-projects` as a tab |
| `/erp/procurement` vs `/purchases` | `/erp/procurement` (`ProcurementWorkspace`, `/api/v1/procurement/*`); `/purchases` (`VenturePurchasesHub`); live Odoo POs on `/erp/cost-intelligence` | `/erp/cost-intelligence` in sidebar | Consolidate manual P2P onto `/erp/procurement` and redirect `/purchases` |

---

## 8. Verbatim `git diff --stat b548541..HEAD` Summary (`c3a5f8a`)

Verified zero `.env*`, credential, API-key, or PIN strings anywhere in `b548541..HEAD` or in this report.

```text
$ git diff --shortstat b548541..c3a5f8a
 376 files changed, 56810 insertions(+), 16457 deletions(-)

$ git diff --dirstat=files,0 b548541..c3a5f8a
   0.5% docs/phases/
   0.7% scripts/
   0.5% src/app/(kds)/kds/
   0.5% src/app/(panel)/accounting/reconciliation/
   0.2% src/app/(panel)/accounting/
   0.5% src/app/(panel)/app-builder/
   0.5% src/app/(panel)/audit/
   0.5% src/app/(panel)/automations/
   0.5% src/app/(panel)/bi-analytics/
   0.2% src/app/(panel)/central-kitchen/
   0.2% src/app/(panel)/crm/quotes/[id]/print/
   0.5% src/app/(panel)/crm/
   0.2% src/app/(panel)/dashboard/
   0.5% src/app/(panel)/delivery-hub/
   0.7% src/app/(panel)/deploy/
   0.5% src/app/(panel)/directory/
   0.5% src/app/(panel)/hr/compliance-radar/
   0.5% src/app/(panel)/hr/payroll/[id]/print/
   0.5% src/app/(panel)/hr/smart-folder-upload/
   0.5% src/app/(panel)/hr/
   0.5% src/app/(panel)/inventory/
   0.5% src/app/(panel)/payments/
   0.7% src/app/(panel)/profile/
   0.2% src/app/(panel)/purchases/[id]/print/
   0.2% src/app/(panel)/purchases/suppliers/[id]/
   0.2% src/app/(panel)/purchases/
   0.5% src/app/(panel)/recipes/
   0.2% src/app/(panel)/reports/
   0.5% src/app/(panel)/roles/
   0.7% src/app/(panel)/saas/
   0.2% src/app/(panel)/sales/[id]/print/
   0.2% src/app/(panel)/sales/customers/[id]/
   0.2% src/app/(panel)/sales/
   0.5% src/app/(panel)/settings/aetherbi-connect/
   0.5% src/app/(panel)/settings/aetherbi/
   0.5% src/app/(panel)/settings/apps/
   0.5% src/app/(panel)/settings/notifications/
   0.5% src/app/(panel)/settings/odoo-data-center/
   0.5% src/app/(panel)/settings/odoo-sync/
   0.5% src/app/(panel)/settings/payments/
   0.2% src/app/(panel)/settings/
   0.2% src/app/(panel)/smart-ingest/[module]/
   0.5% src/app/(panel)/stock-count/
   0.5% src/app/(panel)/users/
   0.5% src/app/(panel)/warehouses/
   0.2% src/app/(pos)/pos/
   0.2% src/app/admin/ai-runs/
   0.5% src/app/admin/
   0.2% src/app/api/aggregator-radar/alert/
   0.2% src/app/api/v1/hr/ingest-folder/
   0.7% src/app/download/
   0.2% src/app/erp/admin/
   1.0% src/app/erp/ai-brief/
   0.2% src/app/erp/ai/
   0.2% src/app/erp/alerts/
   0.2% src/app/erp/archive/
   0.2% src/app/erp/brand-sales-analytics/
   0.2% src/app/erp/competitors/
   0.2% src/app/erp/compliance/
   0.2% src/app/erp/contracts/
   0.2% src/app/erp/cost-intelligence/
   0.2% src/app/erp/crm/
   0.2% src/app/erp/delivery-control/
   0.2% src/app/erp/delivery-sla/
   0.2% src/app/erp/delivery/
   0.2% src/app/erp/demand-forecast/
   0.2% src/app/erp/events-projects/
   0.2% src/app/erp/feryal-ai/
   0.2% src/app/erp/finance/
   0.2% src/app/erp/food-safety/
   0.2% src/app/erp/governance/
   0.2% src/app/erp/hr/
   0.2% src/app/erp/iam/accept/
   0.2% src/app/erp/iam/
   0.2% src/app/erp/intelligence/
   0.2% src/app/erp/inventory/
   0.2% src/app/erp/kds/
   0.2% src/app/erp/kitchen/
   0.2% src/app/erp/ledger/
   0.2% src/app/erp/market/
   0.2% src/app/erp/marketing/
   0.2% src/app/erp/odoo-sync/
   0.2% src/app/erp/operations/
   0.2% src/app/erp/org/
   0.2% src/app/erp/prep-sla/
   0.2% src/app/erp/procurement/
   0.2% src/app/erp/projects/
   0.2% src/app/erp/recipes/
   0.2% src/app/erp/regulations/
   0.2% src/app/erp/sales-crm/
   0.2% src/app/erp/smart-dropzone/
   0.2% src/app/erp/warehouse-chain/
   0.5% src/app/ess/
   0.5% src/app/home/
   0.7% src/app/login/
   0.7% src/app/pay/[token]/
   0.5% src/app/
   0.5% src/components/accounting/
   5.3% src/components/aether/
   0.2% src/components/automation/
   0.2% src/components/crm/
   0.2% src/components/dashboard/
   1.5% src/components/erp/iam/
   1.0% src/components/erp/ops-expansion/
   5.0% src/components/erp/
   0.2% src/components/events/
   0.7% src/components/hr/
   0.2% src/components/kds/
   0.2% src/components/pos/
   0.2% src/components/purchases/
   0.2% src/components/radar/
   0.2% src/components/recipes/
   0.2% src/components/reports/
   0.2% src/components/sales/
   2.6% src/components/ui/
   0.2% src/components/warehouses/
   7.9% src/components/
   5.0% src/lib/__tests__/
   0.2% src/lib/accounting/
   1.5% src/lib/aether/
   0.2% src/lib/events/
   0.2% src/lib/hr/
   0.7% src/lib/odoo/
   0.2% src/lib/reports/
   1.8% src/lib/
   0.2% src/modules/admin/ui/
   2.9% src/modules/ai/ui/
   0.2% src/modules/brand-sales-analytics/ui/
   2.9% src/modules/crm/ui/
   0.2% src/modules/delivery/ui/
   1.5% src/modules/finance/ui/
   0.2% src/modules/food-safety/domain/
   0.2% src/modules/food-safety/ui/
   1.3% src/modules/governance/ui/
   0.2% src/modules/hr/ui/
   2.1% src/modules/inventory/ui/
   0.2% src/modules/kitchen/ui/
   0.2% src/modules/odoo/ui/
   0.2% src/modules/operations/ui/
   1.0% src/modules/org/ui/
   3.9% src/modules/procurement/ui/
   0.2% src/modules/smart-dropzone/ui/
   0.2% src/modules/suite/domain/
   2.1% src/modules/suite/ui/
   1.3% src/services/
```


---

## 9. Final `/audit` + `/refactor` Pass (`984525f..HEAD`)

- **Starting `HEAD`:** `984525f8b1754ea3101e5a307917622b63a44373`
- **Code & Test Commit:** `f08d048a0acbe67967c686faccf46991c5e7dd23` (`refactor(audit/final): enforce radar & hr-summary auth, dedupe dropzone, sync SQL & fail-closed totals`)

### 9.1 Items Fixed (`file:line` & RED -> GREEN Test Proof)

All 10 test cases in `src/lib/__tests__/final-audit-refactor.test.ts` were executed **RED-first** against unmodified `984525f` (`Test Files: 1 failed (1)`, `Tests: 10 failed (10)`) before applying any production edit, then verified **GREEN** (`10 passed (10)`).

| ID | File & Lines | Issue & Surgical Fix | Exact Test Name (`src/lib/__tests__/final-audit-refactor.test.ts`) |
|---|---|---|---|
| **S1a** | `src/app/api/aggregator-radar/alert/route.ts:24-32,126-157` | `GET` trusted spoofable `x-vercel-cron: 1` and `?cron=true` to run `executeDailyForensicDispatch` without `CRON_SECRET`, and skipped `permissions.govAggregatorRead` on non-cron reads. Enforced constant-time `timingSafeEqual` check on `Authorization: Bearer ${CRON_SECRET}`, explicit `401` on unauthorized cron probes, and `authenticate(request, permissions.govAggregatorRead)` on non-cron `GET`. | `S1. Security /audit: /api/aggregator-radar/alert rejects spoofed cron & unauthenticated manualTrigger > rejects GET ?cron=true and spoofed x-vercel-cron header without valid CRON_SECRET bearer token` |
| **S1b** | `src/app/api/aggregator-radar/alert/route.ts:164-184` & `src/app/api/aggregator-radar/smtp/route.ts:62-70` | `POST /api/aggregator-radar/alert` trusted `x-vercel-cron: 1` and swallowed `authenticate(request, permissions.govAggregatorManage)` errors inside `catch` whenever `body.manualTrigger === true`, allowing unauthorized callers to relay email text. Removed `x-vercel-cron` trust and returned `toErrorResponse(authError, request)` unconditionally. Also sanitized raw `error.message` reflection in `POST /api/aggregator-radar/smtp`. | `S1. Security /audit: /api/aggregator-radar/alert rejects spoofed cron & unauthenticated manualTrigger > rejects POST with manualTrigger=true when caller is unauthenticated or auditor instead of swallowing auth error` |
| **S2** | `src/app/api/erp/hr-summary/route.ts:44-53` | Newly added branch endpoint `GET /api/erp/hr-summary` returned `200 OK` with `hr.employee` counts to `auditor` sessions, whereas `auditor` is forbidden from HR data across `/hr`, `/erp/hr`, and `/api/v1/hr`. Added route-level `403` (`Read-only auditor session`) guard without touching protected `middleware.ts` or `permissions.ts`. | `S2. Security /audit: /api/erp/hr-summary blocks read-only auditor session with HTTP 403 > denies auditor access to HR employee counts on GET /api/erp/hr-summary` |
| **M2** | `src/components/SmartDropzonePortal.tsx:1` & `src/modules/smart-dropzone/ui/SmartDropzonePortal.tsx:1-871` | Eliminated the parallel duplicate copy of `SmartDropzonePortal`: moved the single canonical `871`-line implementation into `src/modules/smart-dropzone/ui/SmartDropzonePortal.tsx` and restored `src/components/SmartDropzonePortal.tsx` to a 1-line re-export (`export { default } from '@/modules/smart-dropzone/ui/SmartDropzonePortal'`). | `M2. Single SmartDropzonePortal implementation (zero parallel duplicate) > re-exports the canonical module implementation from src/components/SmartDropzonePortal.tsx` |
| **L1** | `src/lib/odoo/non-company-products.ts:15-54` *(plus unavoidable param-count update `4 -> 9` in branch-added `src/lib/__tests__/tier1-data-contracts.test.ts:492` & `src/lib/__tests__/tier2-routes-states.test.ts:512`)* | Synced `nonCompanyItemSql()` with `isNonCompanyCatalogItem()` via a single shared `NON_COMPANY_NAME_TERMS` tuple (`croissant`, `كرواسون`, `كرواسان`, `avocado`, `أفوكادو`, `افوكادو`) plus bracketed `NON_COMPANY_ITEM_SKUS` (`%[SKU]%`). Updated `toHaveLength(4)` -> `toHaveLength(9)` in the two Wave 3A/3B tests because `nonCompanyItemSql()` now binds all 6 name terms + bracketed SKUs instead of only 2 croissant terms. | `L1. nonCompanyItemSql() stays in 100% parity with isNonCompanyCatalogItem() > blocks croissant, avocado, all Arabic spelling variants, and bracketed non-company SKUs in SQL just like JS` |
| **L2a** | `src/components/aether/DeliveryRadarV5.tsx:75-88,263-358,413-438` | Preserved explicit `null` on channel cell `netKwd`/`orders` via `readChannelCell` and failed `totalAgg`, `sharePct`, `totalAggregatorSalesKwd`, `totalAggregatorOrders`, and `directSalesSummary` closed to `null` (`"غير متاح"` / `"—"`) whenever any contributing channel row is `null`. | `L2. Fail-closed totals when a single contributing row is null (never summed with ?? 0) > DeliveryRadarV5 renders unavailable total instead of partial sum when one aggregator channel is null` |
| **L2b** | `src/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard.tsx:136-214` | Preserved explicit `null` from `liveCube` / `activeBucket.byBrand` cells and failed `totalBrandSalesKwd`, row `sharePct`, and `topBrand` closed to `null` (`"—"`) whenever any contributing brand row has `salesKwd === null`. | `L2. Fail-closed totals when a single contributing row is null (never summed with ?? 0) > BrandSalesAnalyticsDashboard renders unavailable total instead of partial sum when one brand row is null` |
| **L2c** | `src/components/aether/FullJourney360.tsx:277-345` | Preserved `null` on `workspace.unattributedSalesKwd` / `unattributedOrders` and failed `denom` + every branch card's `sharePct` closed to `null` (`"—"`) whenever any mapped branch row or unattributed figure has `salesKwd === null`. | `L2. Fail-closed totals when a single contributing row is null (never summed with ?? 0) > FullJourney360 fails branch sharePct closed to em-dash instead of inflating shares when one branch row is null` |
| **L3** | `src/components/aether/BeforeAfterStudio.tsx:124-128,703-707` & `src/components/erp/ops-expansion/WeekdayComparisonStudio.tsx:86-90,121-129` | Exported and hardened `fmtSignedPp` (and KPI `pct` delta pills) to return `'—'` (`UNAVAILABLE_DASH`) instead of `'0.0 pp'` on `NaN`, `±Infinity`, `null`, or `undefined`. | `L3. fmtSignedPp returns em-dash on non-finite values instead of 0.0 pp > formats NaN, Infinity, null, and undefined as em-dash while preserving signed finite pp` |
| **L4** | `src/lib/governance-routing.ts:5,20-25` | Replaced UTC `new Date().toISOString().slice(0, 10)` with `kuwaitTodayIso()` (`formatKuwaitDate` in `Asia/Kuwait` `UTC+3`) so `00:00`–`03:00` Kuwait time stamps Kuwait's calendar day on routed contracts and delivery orders without altering PIN or routing authority. | `L4. governance-routing.ts uses Asia/Kuwait calendar day between 00:00 and 03:00 Kuwait time > stamps 2026-11-17 (not UTC 2026-11-16) at 2026-11-16T22:30:00Z (01:30 Asia/Kuwait)` |

---

### 9.2 Items Intentionally Not Changed & Why

1. **`AETHER_ADMIN_PASSWORD` in `src/lib/venture-foods-team.ts:130` (`TODO(Abdullah)`):** Referenced by `src/lib/auth/exec-session.ts`. Because Hard Rules prohibit modifying Vercel/Supabase/CI environment settings or changing any existing account's effective credential value, removing the fallback constant from code without provisioning a new production environment variable first would change runtime authentication behavior. Left untouched as `TODO(Abdullah)` per the prompt's explicit safety clause (credential value never printed or logged).
2. **Founder-Only Infrastructure & Domain Decisions (`TODO(Abdullah)`):** Making the GitHub repository private, rotating AI & Odoo keys, confirming `NPIS`/`FAIPS` `pos.config`, `#43 FAS Fahaheel`, archived `#16`/`#35`, `"Hawally Restaurant Canteen"`, `scripts/sync-odoo-live.mjs` refund `__count` / `Math.max(0, net)` / UTC midnight semantics, and duplicate-route consolidation remain untouched for founder sign-off.
3. **`L5`, `L6`, `L7`, `M3`, `M1` (Explicitly Deferred / Accepted):**
   - **`L5`:** Server-side page guards on client-shell routes (`/kds`, `/ess`, etc.) remain `TODO(Abdullah)` per *"do not change access rules"*.
   - **`L6`:** Pre-existing `0/0/0` fields inside `connected: false` daily-section envelopes remain untouched; UI components treat `connected: false` as unavailable.
   - **`L7` & `M3`:** Login desktop seam and remaining raw hex / `text-[Npx]` visual polish are deferred to the upcoming V35 design pass.
   - **`M1`:** Accepted Phase 14 count-atomicity assertion in `phase-13-count-atomicity.test.ts` left as reviewed.
4. **Intentional Server-UTC Helpers (`src/components/erp/actions.tsx:10` `todayUtc` & `src/modules/governance/services/governance-service.ts:47,83`):** Documented in code as paired with server-side UTC schema checks; kept untouched per YAGNI/KISS.

---

### 9.3 Real Command Output From All 7 Gates

#### Gate 1 — `npx tsc --noEmit`
```text
=== Gate 1: npx tsc --noEmit ===
TSC_EXIT=0
```

#### Gate 2 — `npx vitest run` (Baseline at `984525f`: `132` files / `1,666` tests -> Final: `133` files / `1,676` tests)
```text
 Test Files  133 passed (133)
      Tests  1676 passed (1676)
   Start at  06:28:51
   Duration  470.30s (tests 81%, import 17%, transform 1%, setup 1%)

VITEST_EXIT=0
```

#### Gate 3 — `npx eslint src scripts --max-warnings=0`
```text
=== Gate 3: npx eslint src scripts --max-warnings=0 ===
ESLINT_EXIT=0
```

#### Gate 4 — `npm run build`
```text
> restaurant-ai-hq@0.1.0 build
> prisma generate && next build

✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 1.48s
   ▲ Next.js 15.5.28
   Creating an optimized production build ...
 ✓ Compiled successfully in 106s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (21/21)
   Finalizing page optimization ...
   Collecting build traces ...

BUILD_EXIT=0
```

#### Gate 5 — `/tmp` Vitest Leftovers & `prisma/dev.db` Zero-Diff Check
```text
=== Gate 5: Temp DB leftovers & prisma/dev.db diff ===
TMP_LEFTOVER_COUNT=0
PRISMA_DEV_DB_DIFF_BYTES=0
POST_BUILD_DB_DIFF_BYTES=0
```

#### Gate 6 — `git grep` Audit for Fabricated / Demo Constants & Non-Company Products
```text
--- 6a. Non-test production src/ & scripts/ Math.random / 4.8 / croissant / avocado ---
git grep -n -E "Math\.random\(|/\s*4\.8\b" -- src/ scripts/ ':!src/**/__tests__/**'
PROD_RANDOM_48_EXIT=1 (0 matches in non-test src/ & scripts/)

git grep -n -i -E "croissant|avocado|كرواسون|كرواسان|أفوكادو|افوكادو" -- src/ scripts/ ':!src/**/__tests__/**'
PROD_DEMO_PRODUCTS_EXIT=1 (0 matches in non-test src/ & scripts/)

--- 6b. Hardcoded old invented KWD/headcount strings in non-test src/ ---
git grep -n -E "500,000\s*د\.ك|166\s*موظفاً|9,662\s*سجلاً" -- src/ ':!src/**/__tests__/**'
PROD_DEMO_KWD_EXIT=1 (0 matches in non-test src/)
```
- **Reviewed Hits in `src/**/__tests__/**`:** Every remaining match across the repository resides exclusively inside unit/integration test assertions and negative-filter test fixtures (`phase-14-partial-and-batch.test.ts:820,912,927`, `tier1-data-contracts.test.ts:447-473,902`, `zero-invented-data-acceptance.test.ts:485`, `phase-1-data-cleanup.test.ts:18,57`, `tier1-sales-cores.test.ts:870-871`, `tier2-erp-intel.test.ts:439`, `tier2-erp-ops.test.ts:193`, `tier2-panel-fin-pos.test.ts:473,485`, `tier2-routes-states.test.ts:401-1075`, `final-audit-refactor.test.ts:505-527`) verifying that `/ 4.8`, `Math.random()`, and `croissant`/`avocado` are blocked and absent from live paths. **Zero live fabricated numbers exist.**

#### Gate 7 — Protected Paths & User Account / Credential Integrity Check
```text
git diff --name-status b548541 -- src/lib/odoo/excluded-entities.ts src/lib/odoo/pos-registry.json src/lib/odoo/pos-order-query.ts src/lib/odoo/company-pos.ts src/lib/governance-pin.ts src/components/erp/ExecutivePinModal.tsx 'src/server/ai/**' src/lib/db.ts src/lib/erp-auth.ts src/lib/permissions.ts src/lib/auth/permissions.ts src/middleware.ts 'prisma/**' 'supabase/**' '.github/**' src/lib/ensure-venture-foods-team.ts src/lib/ensure-official-admin.ts src/lib/venture-foods-team.ts src/lib/auth/exec-session.ts
(empty — 0 diff lines across b548541..HEAD and 984525f..HEAD; zero user passwords, PINs, roles, or statuses modified)
```

---

### 9.4 Verbatim `git diff --stat 984525f..f08d048` (and Full-Branch Summary)

```text
 src/app/api/aggregator-radar/alert/route.ts        |  54 +-
 src/app/api/aggregator-radar/smtp/route.ts         |  10 +-
 src/app/api/erp/hr-summary/route.ts                |  11 +
 src/components/SmartDropzonePortal.tsx             | 872 +--------------------
 src/components/aether/BeforeAfterStudio.tsx        |  10 +-
 src/components/aether/DeliveryRadarV5.tsx          | 138 ++--
 src/components/aether/FullJourney360.tsx           |  41 +-
 .../erp/ops-expansion/WeekdayComparisonStudio.tsx  |  11 +-
 src/lib/__tests__/final-audit-refactor.test.ts     | 703 +++++++++++++++++
 src/lib/__tests__/tier1-data-contracts.test.ts     |   2 +-
 src/lib/__tests__/tier2-routes-states.test.ts      |   4 +-
 src/lib/governance-routing.ts                      |   7 +-
 src/lib/odoo/non-company-products.ts               |  34 +-
 .../ui/BrandSalesAnalyticsDashboard.tsx            |  94 ++-
 .../smart-dropzone/ui/SmartDropzonePortal.tsx      | 480 +++++++-----
 15 files changed, 1282 insertions(+), 1189 deletions(-)
```

- **Full-Branch Summary (`b548541..f08d048`, prior to this report commit):** `381 files changed, 57699 insertions(+), 16715 deletions(-)`
