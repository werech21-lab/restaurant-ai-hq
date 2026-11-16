# Phase 4 — Reports and advisory

Status: green. Recorded 2026-11-16.

## Requirements

- [x] A finding links to Odoo only from `ODOO_URL`'s https origin and real record ids. `http`, credentials, and a path are rejected. Evidence: `odooWebBase` at `src/server/ai/source-links.ts:367` and `listHref` at `src/server/ai/source-links.ts:397`. Test: `phase 4 reports and advisory > builds an Odoo link only from the configured origin and real ids`.
- [x] When a deep link cannot be built, the model name and domain text are shown instead. Same test, with a null base. The rendered report still shows `pos.order`. Test: `phase 4 reports and advisory > renders every finding with a source link and labels advisory as opinion`.
- [x] A product link uses the real product id on `product.product`. Same link-builder test, id `21`.
- [x] A recommendation links to the in-app page for the same period and branch, and to the stored report anchor. Evidence: `linksForRecommendation` at `src/server/ai/source-links.ts:503`. Test: `phase 4 reports and advisory > links each recommendation to the in-app page and the stored report`.
- [x] Findings require two models and an exact Odoo value. Advisory text that adds a number not in the fact pack is dropped. Accepted advisory items are `kind: 'opinion'`. Evidence: `reviewAdvisory` in `src/server/ai/consensus.ts`. Test: `phase 4 reports and advisory > gives every report section a written recommendation and a link`.
- [x] Every report section has its own written recommendation and at least one link. Evidence: `reportSectionNotes` at `src/server/ai/source-links.ts:586`. Same section test. The rendered page shows all six headings. Evidence: `ReportBody` in `src/app/erp/ai-brief/report-body.tsx`. Render test above.
- [x] The rendered finding contains the Odoo web link and the in-app link, and no invented `/odoo/action` id. Render test above.

## Checks

- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 95 files, 1258 tests, all passed.
- `npm run build` — exit 0 (Next.js 15.5.28 compiled successfully).
