-- Admin POS device-to-branch mapping table with row-level security enabled.
-- No anon or authenticated access; only the database owner / server connection may read or write it.
-- This file is the migration. It is not applied at runtime in production.

CREATE TABLE IF NOT EXISTS public.pos_terminal_branch_map (
  terminal_id INTEGER PRIMARY KEY,
  branch_id TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

ALTER TABLE public.pos_terminal_branch_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_terminal_branch_map FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pos_terminal_branch_map FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION erp_pos_terminal_branch_map_rls_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_pos_terminal_branch_map_rls_marker() FROM PUBLIC, anon, authenticated;
