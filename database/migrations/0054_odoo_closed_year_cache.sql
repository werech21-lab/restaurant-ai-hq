-- Dedicated durable L2 cache table for closed historical Odoo POS year windows.
-- Server-only deny-all table: RLS is enabled and forced with no anon or authenticated access.
-- This file is the migration. It is not applied by the application at runtime.

CREATE TABLE IF NOT EXISTS public.vf_odoo_closed_year_cache (
  cache_key TEXT PRIMARY KEY,
  raw_key TEXT NOT NULL,
  rows_json JSONB NOT NULL,
  cached_at_ms BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vf_odoo_closed_year_cache_updated_at
  ON public.vf_odoo_closed_year_cache (updated_at DESC);

ALTER TABLE public.vf_odoo_closed_year_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vf_odoo_closed_year_cache FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vf_odoo_closed_year_cache FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION erp_odoo_closed_year_cache_marker() RETURNS void
LANGUAGE sql
SET search_path = public
AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_odoo_closed_year_cache_marker() FROM PUBLIC, anon, authenticated;
