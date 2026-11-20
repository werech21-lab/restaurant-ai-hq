-- Live gate server-only table hardening and AI daily brief schema guarantee.
-- Ensures AI council, closed-year L2 cache, and governance tables exist with
-- ENABLE ROW LEVEL SECURITY + NO FORCE ROW LEVEL SECURITY so the non-superuser
-- table owner server connection can read and write while anon and authenticated remain blocked.

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "userId" TEXT NOT NULL,
  "questionHash" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "tokensIn" INTEGER,
  "tokensOut" INTEGER,
  "estCostMicroUsd" INTEGER,
  status TEXT NOT NULL,
  "errorCode" TEXT
);

CREATE INDEX IF NOT EXISTS ai_runs_created_at_idx ON public.ai_runs ("createdAt");

CREATE TABLE IF NOT EXISTS public.ai_daily_briefs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "questionHash" TEXT NOT NULL,
  status TEXT NOT NULL,
  reply TEXT NOT NULL,
  "agreedModels" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_daily_briefs_created_at_idx ON public.ai_daily_briefs ("createdAt");

CREATE TABLE IF NOT EXISTS public.vf_odoo_closed_year_cache (
  cache_key TEXT PRIMARY KEY,
  raw_key TEXT NOT NULL,
  rows_json JSONB NOT NULL,
  cached_at_ms BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vf_odoo_closed_year_cache_updated_at
  ON public.vf_odoo_closed_year_cache (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.council_reports (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('hourly', 'nightly')),
  kuwait_day TEXT NOT NULL,
  generated_at TEXT,
  saved_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  shown_fingerprints TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS council_reports_kuwait_day_idx ON public.council_reports (kuwait_day);
CREATE INDEX IF NOT EXISTS council_reports_saved_at_idx ON public.council_reports (saved_at);

CREATE TABLE IF NOT EXISTS public.council_decisions (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  advisor_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  branch_id TEXT,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'testing', 'rejected')),
  note TEXT,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  decided_day TEXT NOT NULL,
  expected_weekly_kwd DOUBLE PRECISION,
  outcome TEXT,
  outcome_at TEXT
);

CREATE INDEX IF NOT EXISTS council_decisions_fingerprint_idx ON public.council_decisions (fingerprint);
CREATE INDEX IF NOT EXISTS council_decisions_decided_at_idx ON public.council_decisions (decided_at);

CREATE TABLE IF NOT EXISTS public.vf_executive_governance_sync (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pos_terminal_branch_map (
  terminal_id INTEGER PRIMARY KEY,
  branch_id TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.season_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('yearly', 'monthly', 'none')),
  approximate BOOLEAN NOT NULL DEFAULT TRUE,
  previous_starts_on TEXT,
  previous_ends_on TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

ALTER TABLE public.vf_odoo_closed_year_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vf_odoo_closed_year_cache NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_daily_briefs NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.council_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_reports NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.council_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_decisions NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vf_executive_governance_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vf_executive_governance_sync NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pos_terminal_branch_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_terminal_branch_map NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.season_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_events NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vf_odoo_closed_year_cache FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_daily_briefs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.council_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.council_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.vf_executive_governance_sync FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pos_terminal_branch_map FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.season_events FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  srv_role TEXT;
  srv_table TEXT;
BEGIN
  FOREACH srv_role IN ARRAY ARRAY['postgres', current_user::text] LOOP
    IF srv_role NOT IN ('anon', 'authenticated', 'public')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = srv_role) THEN
      FOREACH srv_table IN ARRAY ARRAY[
        'vf_odoo_closed_year_cache',
        'ai_runs',
        'ai_daily_briefs',
        'council_reports',
        'council_decisions',
        'vf_executive_governance_sync',
        'pos_terminal_branch_map',
        'season_events'
      ] LOOP
        EXECUTE format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I',
          srv_table,
          srv_role
        );
      END LOOP;
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION erp_live_gate_rls_ai_briefs_marker() RETURNS void
LANGUAGE sql
SET search_path = public
AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_live_gate_rls_ai_briefs_marker() FROM PUBLIC, anon, authenticated;
