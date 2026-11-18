-- Decision log for advisor-council proposals: accept / test / reject, and the measured outcome
-- (before vs after on the same scope, measured nightly from Odoo POS daily rows).
-- No anon or authenticated access; only the server connection may read or write it.
-- This file is the migration. It is not applied at runtime in production.

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

ALTER TABLE public.council_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_decisions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.council_decisions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION erp_council_decisions_marker() RETURNS void
LANGUAGE sql
SET search_path = public
AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_council_decisions_marker() FROM PUBLIC, anon, authenticated;
