-- Row level security for the executive governance sync table.
-- This file is the migration. It is not applied by the application at runtime.

CREATE TABLE IF NOT EXISTS public.vf_executive_governance_sync (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vf_executive_governance_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vf_executive_governance_sync FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vf_executive_governance_sync FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION erp_governance_sync_rls_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_governance_sync_rls_marker() FROM PUBLIC, anon, authenticated;
