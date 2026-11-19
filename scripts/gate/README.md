# AetherBI Deployment Gate (`scripts/gate`)

Read-only Playwright deployment verification gate that checks the 4 owner deploy conditions against any AetherBI deployment URL using the QA (`auditor`) login.

## What It Checks

1. **Banned strings absent everywhere (all 15 pages):**
   - `قيود غير مكتملة`
   - `غير متاح بعد`
   - `قيد المطابقة`
   - `بعض الأرقام غير متاحة`
   - `لا توجد بيانات`
   - `غير مربوط بمصدر`
2. **Receivables consistency & non-zero credits:**
   - `/erp` (card + line under card + badge/tie-out), `/erp/finance` (GL tab + Receivables tab), and `/erp/receivables` show the exact same receivables figure matching `EXPECTED_RECEIVABLES` (default `30310.675` KWD).
   - Unapplied credits cards/lines are non-zero.
3. **2026 YTD company total (`/erp/cores` with Year filter):**
   - Headline Total Net Sales is within `±0.5%` (configurable via `YTD_TOLERANCE_PCT`) of `EXPECTED_YTD` (default `1743500` KWD).
4. **Page health:**
   - No HTTP status `>= 400` on page loads or page requests (retries once on 5xx).
   - No browser console errors or uncaught page errors.

After login, the script enforces **GET-only** navigation and blocks any non-`GET`/`HEAD`/`OPTIONS` requests. It never logs passwords, cookies, or Vercel bypass tokens.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GATE_BASE_URL` | **Yes** | — | Target deployment origin, e.g. `https://aetherbi-preview.vercel.app` |
| `AETHER_QA_EMAIL` | **Yes** | — | QA read-only (`auditor`) account email |
| `AETHER_QA_PASSWORD` | **Yes** | — | QA read-only (`auditor`) account password (never echoed) |
| `GATE_SHARE_URL` | No | — | Optional Vercel Deployment Protection share link opened first to set the bypass cookie |
| `GATE_OUT_DIR` | No | `./gate-out/<YYYYMMDD-HHmmss>/` | Directory for full-page PNGs, `.txt` visible text dumps, `summary.json`, and `SUMMARY.md` |
| `EXPECTED_RECEIVABLES` | No | `30310.675` | Expected open customer receivables figure in KWD (3 decimals) |
| `EXPECTED_YTD` | No | `1743500` | Expected 2026 YTD company net sales total in KWD |
| `YTD_TOLERANCE_PCT` | No | `0.5` | Allowed percentage tolerance around `EXPECTED_YTD` (`±%`) |
| `GATE_TIMEOUT_MS` | No | `135000` | Per-page navigation timeout in ms (with `125000` ms settle budget to accommodate 120s cold Odoo syncs; warm pages settle immediately) |

Missing any required variable causes the script to fail closed immediately with exit code `1`.

## Run Command

```bash
GATE_BASE_URL="https://your-preview.vercel.app" \
GATE_SHARE_URL="https://your-preview.vercel.app/?_vercel_share=..." \
AETHER_QA_EMAIL="qa-readonly@venturefoodskw.com" \
AETHER_QA_PASSWORD="..." \
npm run gate
```

Or invoke directly with `tsx`:

```bash
npx tsx scripts/gate/run-gate.ts
```

> **Note:** Ensure Playwright Chromium is installed locally (`npx playwright install chromium`) before running against a live deployment. Do not commit `gate-out/` artifacts.

## Outputs & Exit Codes

All artifacts are written to `GATE_OUT_DIR`:
- `01-erp.png` / `01-erp.txt` … `15-erp-demand-forecast.png` / `15-erp-demand-forecast.txt`
- `07-erp-finance-receivables-tab.png` / `.txt` and `02b-erp-cores-ytd.png` / `.txt`
- `summary.json` — machine-readable per-page and condition results
- `SUMMARY.md` — human-readable summary table (`Page | Result | Key Numbers | Failure Reasons`) plus any missing `data-testid` notes

**Exit code:** `0` if and only if every page and all 4 deploy conditions pass; `1` otherwise.

## Selectors

All DOM selectors live in [`scripts/gate/selectors.ts`](./selectors.ts). Preferred `[data-testid="..."]` selectors are always tried first, falling back to accessible labels and existing `data-*` attributes without editing app source code. Any missing `data-testid` encountered at runtime is listed in `SUMMARY.md`.
