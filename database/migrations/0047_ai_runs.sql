-- Feryal council run log and stored daily brief.
-- This file is the migration. It is not applied by the application at runtime.

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ai_daily_briefs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "questionHash" TEXT NOT NULL,
  status TEXT NOT NULL,
  reply TEXT NOT NULL,
  "agreedModels" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_daily_briefs_created_at_idx ON public.ai_daily_briefs ("createdAt");

ALTER TABLE public.ai_daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION erp_ai_runs_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_ai_runs_marker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_daily_briefs FROM PUBLIC, anon, authenticated;
