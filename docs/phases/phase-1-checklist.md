# Phase 1 — Data cleanup

Status: green. Recorded 2026-11-16.

## Requirements

- [x] Fake product names (croissant, avocado, and the Arabic spellings) are absent from production source. Evidence: `phase 1 data cleanup > keeps croissant and avocado names out of production source`. `rg` over `src` excluding `__tests__` returns no file. The only hit is the test pattern in `src/lib/__tests__/phase-1-data-cleanup.test.ts:18`.
- [x] A product is shown only when it sold in the period on an approved brand. Evidence: `isPeriodSaleProduct` at `src/lib/odoo/excluded-entities.ts:143`. Test: `phase 1 data cleanup > shows a product only when it sold in the period on an approved brand`.
- [x] Zero-sale and excluded products are dropped before a fact is stored. Evidence: `src/server/ai/facts.ts:132` (`netKwd > 0`) and `src/server/ai/facts.ts:133` (`isExcludedOdooEntity`). Test: `phase 1 data cleanup > omits an excluded or unsold product and labels a missing source`.
- [x] Central exclusion matches Heisenberg, Jahra, Qurain, and the closed mall branch by name, plus POS category id 150. Evidence: `src/lib/odoo/excluded-entities.ts:47` and `isExcludedOdooEntity` at `src/lib/odoo/excluded-entities.ts:114`. Test: `phase 1 data cleanup > matches excluded entities by stored id and Arabic or English name`.
- [x] An excluded row is removed before the total is summed. Evidence: `sumWithoutExcludedEntities` at `src/lib/odoo/excluded-entities.ts:136`. Test: `phase 1 data cleanup > drops an excluded row before the total is summed`.
- [x] A missing source is labeled, not filled in. Receivables with no Odoo read are `not_linked`, ageing is `unverified`, and a missing prior day is `not_linked`. Evidence: `src/server/ai/facts.ts:256` and `src/server/ai/facts.ts:258`. Same fact-pack test as above.
- [x] A KPI source label shows the Odoo model, the period, the metric kind, and `غير متزامن` when there is no sync time. Evidence: `src/components/erp/KpiProvenanceBadge.tsx:75` and the model span at `src/components/erp/KpiProvenanceBadge.tsx:189`. Test: `phase 1 data cleanup > labels a KPI with its Odoo model, period, and an honest unsynced state`.
- [x] A missing model is labeled `غير محدد` and is not filled with `pos.order`. Evidence: `src/components/erp/KpiProvenanceBadge.tsx:141`. Test: `phase 1 data cleanup > does not label a missing model as pos.order`.

## Checks

- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 91 files, 1238 tests, all passed.
- `npm run build` — exit 0 (Next.js 15.5.28 compiled successfully).
