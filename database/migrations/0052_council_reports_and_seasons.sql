-- Advisor council snapshots (hourly + nightly) and the owner-editable seasons calendar.
-- No anon or authenticated access; only the server connection may read or write them.
-- This file is the migration. It is not applied at runtime in production.

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

ALTER TABLE public.council_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.season_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.council_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.season_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION erp_council_reports_seasons_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_council_reports_seasons_marker() FROM PUBLIC, anon, authenticated;
