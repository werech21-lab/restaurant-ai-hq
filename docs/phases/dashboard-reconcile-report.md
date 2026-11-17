# Executive Dashboard reconcile (M1–M7) — 17 Nov 2026

Branch `fix/aetherbi-dashboard-reconcile-2026-11-17`, from `fix/aetherbi-followup-2026-11-16` @ `e8a5949`.
No merge, no deploy, no remote DB writes, no account / PIN / role / status changes. Data rules unchanged
(Heisenberg, Qurain, closed Hawally restaurant and Jahra excluded; school canteens 41/42 kept and now shown
as a branch card; non-company products dropped).

Fixture: `src/lib/__tests__/fixtures/dashboard-today-2026-11-17.json` — trimmed live `period=today` payload
(synced 06:00 Asia/Kuwait), no account names, partners, users or secrets. A SYNTHETIC per-order fixture
(`support/dashboard-fixture.ts`) with the same branch totals exercises the exact (order-allocated) path.

## Items

| # | Fix | Where |
|---|---|---|
| M1 | Pro-rata brand orders deleted. Brand orders are real: per-order read for today/week (`fetchExactBrandAllocation`), `pos.order.search_count` with `lines.product_id in brand products` for 30-day/year (`countOrdersPerBrand`) and the custom cube. Otherwise `orders: null` → `—`. Payloads from older servers (no `brandBasis`) are treated as estimates → `—`. Orders tooltip says a multi-brand order counts once per brand. | `src/lib/odoo-live-connector.ts:1355` (`buildBucketBrandScope`), `:3056` (wiring), `:3262/3284/3306/3327` (buckets), `:5050` (cube); `src/lib/odoo/brand-scope-fetch.ts`; `src/lib/aether/brand-scope.ts` (`resolveBrandHeadline`); `FullJourney360.tsx:995` |
| M2 | Per-order allocation (`allocateBrandsFromOrders`): brand-less negative lines + order rounding residual are shared to that order's brands pro rata in integer fils; brand-less positive lines stay "unbranded"; excluded / non-company lines removed. Invariant Σ brands + unbranded + excluded = order net (exact). Used only when it covers the same order net as the company total (±0.001); otherwise `brandBasis: 'product-lines'` + `brandBasisGapKwd`, shown on the headline. | `src/lib/odoo/brand-order-allocation.ts`; `odoo-live-connector.ts:1355`; `FullJourney360.tsx:910` |
| M3 | `byBrandByLocation` per bucket (today/week, exact). Branch cards and the Cores ranking use it when brand ≠ all; without it the cards read "غير متاح لهذا الفلتر" instead of all-brand numbers. Shares use the brand-filtered denominator. School canteens added as a card so cards add up to the total. Brand × branch headline uses the exact cell; brand × channel is unavailable (no pro-rata). | `brand-scope.ts` (`resolveBranchScope`); `global-filter-engine.ts:187, 1384-1407`; `cores-hub-engine.ts:739`; `FullJourney360.tsx:263-286, 1374` |
| M4 | Pulse uses the brand daily series (`byBrandDaily` of the week bucket) when it covers the window; otherwise the card shows "كل العلامات". | `brand-scope.ts` (`resolveDailySeriesForBrand`); `cores-hub-engine.ts:559`; `FullJourney360.tsx:1403` |
| M5 | `computePeriodOverPeriodDeltaPct` returns `null` for "no comparison" (and for any brand/branch/channel filter, since all series are company-wide). `today` returns `null` (no same-hours prior-week data in the payload). Badge renders `—` + "لا توجد مقارنة". | `global-filter-engine.ts:1981-2034`; `src/lib/aether/hero-delta.ts`; `FullJourney360.tsx:632` |
| M6 | Aging = positive open residuals by `date_maturity` (fallback `date`) per bucket; negative residuals (unmatched payments, 10552 POS clearing, Deliveroo/Snoonu clearing) are one "unapplied credits" line; `openReceivableKwd` stays debits − credits. Old signed buckets in older payloads are hidden with a reason. | `src/lib/odoo/receivable-aging.ts`; `odoo-live-connector.ts:2366, 2462`; `global-filter-engine.ts:1775`; `FullJourney360.tsx:1598-1608` |
| M7 | "على مستوى الشركة" badge on the AR and GL cards when brand ≠ all. | `FullJourney360.tsx:642, 1048, 1541` |

## Tests

RED run: the new test files on the base code (`e8a5949`) with only the new pure modules copied in —
32 failed / 13 passed. Key failures:
- M1 `does not report China Garden = 20 …` → `expected 20 not to be 20`
- M2 `brand line sum 160.30 vs order net 154.70 …` → `expected undefined to be 'product-lines'`
- M3 `China Garden on the live payload does not show the all-brand 154.70 cards` → `expected 154.7 to not be close to 154.7`
- M4 `pulse is labelled all-brands` → `expected undefined to be 'all-brands'`
- M5 `today-only dailySeries returns null, not 0` → `expected +0 to be null`; badge → `expected '• ±0.0%' to be '—'`
- M6 `old signed buckets … are hidden` → `expected true to be false`
- M7 `AR and GL cards render the company-wide badge` → regex not found
- Parity `brand=all reconciles to 154.70 / 24` → `DASHBOARD_BRANCH_CARD_IDS` undefined

GREEN: `npx vitest run` → **139 files / 1721 tests passed** (base: 133 / 1676).
New: `dashboard-brand-scope-parity.test.ts` (18), `dashboard-reconcile-m1-m2-brand-orders.test.ts` (10),
`dashboard-reconcile-m3-m4-scope.test.ts` (6), `dashboard-reconcile-m5-delta.test.ts` (4),
`dashboard-reconcile-m6-ar-aging.test.ts` (4), `dashboard-reconcile-m7-labels.test.ts` (3).
`tsc --noEmit` clean, `npm run lint` 0 problems, `npm run build` passes. Canteen/exclusion matrix and
zero-invented-data suites pass.

## Before / after on the live fixture (period=today)

| View | Before (`e8a5949`) | After |
|---|---|---|
| brand=all | 154.70 / 24, cards 99.35/31.55/18.35/5.45 | same — headline = Σ cards = 154.70 / 24 |
| China Garden headline | 133.55, 20 orders, AOV 6.68 | 133.55 labelled "basis: product lines", gap +5.60; orders `—`, AOV `—` |
| China Garden cards | all-brand 154.70 (64.2/20.4/11.9/3.5%) | "غير متاح لهذا الفلتر" (no exact split in this payload) |
| Pulse (brand ≠ all) | 154.7 unlabelled | 154.7 labelled "كل العلامات" |
| Delta badge | +0.0% / ±0.0% | `—` "لا توجد مقارنة" |
| AR aging | −22,182.5 / 47,244.3 / −23,879.1 | hidden with reason (old payload); new server sends due-date aging + unapplied credits |
| Open AR | 1,182.708 | 1,182.708 (unchanged, debits − credits) |

Synthetic order-allocated fixture: CG 128.383 / 20, Frank's 23.067 / 4, Noodle Bar 3.25 / 1;
Σ = 154.70; every brand's cards add up to its headline.

## Still `—` or unverified
- Real China Garden order-level net, orders and branch split for 17 Nov need the new server code
  against live Odoo (or one admin read: `pos.order.line` grouped by product/order + `search_count`).
- `today` delta stays `—` until the payload carries same-hours prior-week data.
- Brand × channel stays unavailable (no exact split).
- Cube (custom period) brand × branch still reports `linesCount` as orders on the Cores Hub; other
  screens (CoresHubStudio, BrandSalesAnalytics, comparison engine) render a `null` brand order count as 0.
