# Advisor Council Cron & Migration `0052` — Owner-Only Production Runbook

> **Status on `feat/aetherbi-redo-2026-11-18` (Safe Default — OFF):**
> - `/api/cron/council?scope=hourly` and `/api/cron/council?scope=nightly` have been **removed** from `vercel.json` so Vercel will not schedule or invoke them automatically upon deploy.
> - `GET /api/cron/council` (`src/app/api/cron/council/route.ts`) is **double-gated**:
>   1. `Authorization: Bearer <CRON_SECRET>` (`401` if `CRON_SECRET` is unset or mismatched).
>   2. `isCouncilCronEnabled()` (`src/server/council/store.ts`) — requires `COUNCIL_CRON_ENABLED=true` (case-insensitive, trimmed). When unset or not `'true'`, the endpoint returns HTTP `200` `{ "ok": true, "skipped": true, "reason": "COUNCIL_CRON_DISABLED" }` without reading Odoo or writing to Postgres.
> - Migration `database/migrations/0052_council_reports_and_seasons.sql` has **NOT** been applied to any remote database.

Do **not** enable the council crons in production until all four owner checks below are completed in order.

---

## Step 1 — Verify Vercel Pro Plan Limits (Hourly Crons & `maxDuration = 300`)

Before re-adding hourly schedules to `vercel.json`, verify the Vercel project (`aetherbi.com`) plan in **Vercel Dashboard → Settings → Billing / Functions**:

1. **Cron frequency:** `/api/cron/council?scope=hourly` (`7 * * * *`) runs 24 times/day. **Vercel Pro** (or Enterprise) is required for sub-daily / hourly cron schedules; Vercel Hobby rejects crons that run more than once per day.
2. **Function execution timeout:** `src/app/api/cron/council/route.ts` declares `export const maxDuration = 300` (5 minutes) because the `nightly` scope reads the 28-day + prior-28-day Odoo period cubes, 5-week `pos.payment` hourly matrix, 14-day `hr.attendance`, `stock.quant`, warehouse transfers, and model probe (all strictly read-only on Odoo). **Vercel Pro** is required to allow `maxDuration = 300` on Node.js Serverless Functions.
3. **Database write volume awareness:** Every active invocation inserts one snapshot row into `public.council_reports` (`24` hourly rows + `1` nightly row = `25` rows/day). Confirm storage retention expectations before enabling hourly runs.

---

## Step 2 — Apply `0052_council_reports_and_seasons.sql` on Production Postgres (`BYPASSRLS` / Table-Owner Role)

`src/server/council/store.ts` **never** runs DDL in `NODE_ENV=production`. The owner must apply `database/migrations/0052_council_reports_and_seasons.sql` once against production Postgres.

### What `database/migrations/0052_council_reports_and_seasons.sql` creates

1. **Table `public.council_reports`** (`id TEXT PRIMARY KEY`, `scope TEXT CHECK (scope IN ('hourly', 'nightly'))`, `kuwait_day TEXT`, `generated_at TEXT`, `saved_at TEXT`, `payload TEXT`, `shown_fingerprints TEXT DEFAULT '[]'`) + indexes `council_reports_kuwait_day_idx` and `council_reports_saved_at_idx`.
2. **Table `public.season_events`** (`id TEXT PRIMARY KEY`, `kind TEXT`, `name_ar TEXT`, `name_en TEXT`, `starts_on TEXT`, `ends_on TEXT`, `recurrence TEXT CHECK (recurrence IN ('yearly', 'monthly', 'none'))`, `approximate BOOLEAN DEFAULT TRUE`, `previous_starts_on TEXT`, `previous_ends_on TEXT`, `notes TEXT`, `updated_at TEXT`, `updated_by TEXT`).
3. **Strict RLS & privilege lockdown:**
   - `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on both `public.council_reports` and `public.season_events` (with zero permissive policies for `anon` or `authenticated`).
   - `REVOKE ALL ON TABLE ... FROM PUBLIC, anon, authenticated` on both tables.
   - Sentinel function `erp_council_reports_seasons_marker()` (used by `scripts/migrate-lib.mjs` baseline/status checks) with `REVOKE ALL ... FROM PUBLIC, anon, authenticated`.

### Important `BYPASSRLS` requirement

Because both tables use `FORCE ROW LEVEL SECURITY` with no `CREATE POLICY` rows, the server-side `DATABASE_URL` role used by `src/server/council/store.ts` at runtime **must have `BYPASSRLS`** (for example, Supabase's `postgres` / `service_role` direct/pooler admin connection). A non-`BYPASSRLS` table owner is subject to `FORCE ROW LEVEL SECURITY` and would see zero rows / fail inserts unless an explicit policy is granted to that role.

### Owner execution & verification (on trusted workstation)

1. Inspect pending migration status first (read-only):
   ```bash
   psql "$PROD_DIRECT_DATABASE_URL" -c "SELECT proname FROM pg_proc WHERE proname = 'erp_council_reports_seasons_marker';"
   ```
2. Apply `database/migrations/0052_council_reports_and_seasons.sql` in a single transaction via Supabase SQL Editor (connected as `postgres`) or `psql`:
   ```bash
   psql "$PROD_DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0052_council_reports_and_seasons.sql
   ```
3. Verify the runtime `DATABASE_URL` role has `rolbypassrls = true`:
   ```bash
   psql "$PROD_DIRECT_DATABASE_URL" -c "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;"
   ```

---

## Step 3 — Configure `CRON_SECRET` and `COUNCIL_CRON_ENABLED=true` in Vercel Environment Variables

In **Vercel Dashboard → Project → Settings → Environment Variables** (Production):

1. **`CRON_SECRET`** — If not already set for existing crons, generate a cryptographically random secret (at least 32 bytes hex) and add it to **Production** (never commit secrets to git or `.env*` files). Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on scheduled cron invocations.
2. **`COUNCIL_CRON_ENABLED=true`** — Set explicitly to `true` when ready to activate `/api/cron/council`. Setting `COUNCIL_CRON_ENABLED=false` (or removing it) immediately pauses council cron execution without requiring a code change.

### Manual smoke test after redeploying env vars

```bash
# Should return HTTP 200 with { "ok": true, "scope": "hourly", ... } when COUNCIL_CRON_ENABLED=true
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://aetherbi.com/api/cron/council?scope=hourly"
```

---

## Step 4 — Optional `vercel.json` Snippet to Re-Enable Automatic Schedules

Once Steps 1–3 are verified in production, add one or both entries back into the `"crons"` array in `vercel.json` (`41 21 * * *` UTC = `00:41` Asia/Kuwait, after the Kuwait day closes):

```json
{
  "path": "/api/cron/council?scope=hourly",
  "schedule": "7 * * * *"
},
{
  "path": "/api/cron/council?scope=nightly",
  "schedule": "41 21 * * *"
}
```

> **Daily-only option (lower DB & Odoo load):** You may add **only** `/api/cron/council?scope=nightly` (`41 21 * * *`) if you want once-per-night council snapshots without hourly runs.
