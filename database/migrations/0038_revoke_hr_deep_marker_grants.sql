-- Marker functions must not be executable by anon/authenticated (security suite).

create or replace function erp_hr_marker_grants_marker() returns text
language sql immutable as $$ select '0038_revoke_hr_deep_marker_grants'::text $$;

revoke all on function erp_hr_deep_rebuild_marker() from public, anon, authenticated;
revoke all on function erp_vf_warehouses_branches_marker() from public, anon, authenticated;
revoke all on function erp_hr_deep_tables_rls_marker() from public, anon, authenticated;
revoke all on function erp_hr_marker_grants_marker() from public, anon, authenticated;
