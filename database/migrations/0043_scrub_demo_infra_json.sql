-- Scrub leftover DEMO tokens in notes, AI payloads, core audit_log, idempotency bodies, and actor emails.

create or replace function erp_scrub_demo_infra_marker() returns text
language sql immutable as $$ select '0043_scrub_demo_infra_json'::text $$;

create or replace function erp_scrub_demo_infra() returns integer
language plpgsql as $$
declare
  touched integer := 0;
  n integer;
begin
  update suppliers
  set notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      updated_at = now()
  where coalesce(notes, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update ai_action_approvals
  set payload_json = replace(replace(payload_json::text, 'DEMO', 'Archive'), 'Demo', 'Archive')::jsonb,
      updated_at = now()
  where payload_json::text ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update ai_action_approvals
  set result_json = replace(replace(result_json::text, 'DEMO', 'Archive'), 'Demo', 'Archive')::jsonb,
      updated_at = now()
  where result_json is not null and result_json::text ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  alter table audit_activity_logs disable trigger audit_activity_logs_no_update;
  update audit_activity_logs
  set actor_name = replace(replace(actor_name, 'demo-owner@aether-staging.invalid', 'owner@venture-foods.kw'), 'DEMO', 'Archive')
  where actor_name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table audit_activity_logs enable trigger audit_activity_logs_no_update;

  alter table audit_log disable trigger audit_log_no_update;
  update audit_log
  set before = case when before is null then null else replace(replace(before::text, 'DEMO', 'Archive'), 'Demo', 'Archive')::jsonb end,
      after = case when after is null then null else replace(replace(after::text, 'DEMO', 'Archive'), 'Demo', 'Archive')::jsonb end
  where coalesce(before::text, '') ilike '%demo%' or coalesce(after::text, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table audit_log enable trigger audit_log_no_update;

  update idempotency_keys
  set response_body = replace(replace(response_body::text, 'DEMO', 'Archive'), 'Demo', 'Archive')::jsonb
  where response_body::text ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  return touched;
end;
$$;

select erp_scrub_demo_infra();

revoke all on function erp_scrub_demo_infra() from public, anon, authenticated;
revoke execute on function erp_scrub_demo_infra_marker() from public, anon, authenticated;
