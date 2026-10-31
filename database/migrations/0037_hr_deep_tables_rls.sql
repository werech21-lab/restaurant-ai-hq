-- Close browser/anon access on HR deep-rebuild tables introduced in 0035.

create or replace function erp_hr_deep_tables_rls_marker() returns text
language sql immutable as $$ select '0037_hr_deep_tables_rls'::text $$;

alter table hr_contracts enable row level security;
alter table hr_custody enable row level security;
alter table hr_loans enable row level security;
alter table hr_overtimes enable row level security;
alter table hr_documents enable row level security;

revoke all on hr_contracts, hr_custody, hr_loans, hr_overtimes, hr_documents from anon, authenticated;
grant select on hr_contracts, hr_custody, hr_loans, hr_overtimes, hr_documents to authenticated;

drop policy if exists hr_contracts_select on hr_contracts;
create policy hr_contracts_select on hr_contracts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.employee.read'));

drop policy if exists hr_custody_select on hr_custody;
create policy hr_custody_select on hr_custody for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.employee.read'));

drop policy if exists hr_loans_select on hr_loans;
create policy hr_loans_select on hr_loans for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.employee.read'));

drop policy if exists hr_overtimes_select on hr_overtimes;
create policy hr_overtimes_select on hr_overtimes for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.attendance.read'));

drop policy if exists hr_documents_select on hr_documents;
create policy hr_documents_select on hr_documents for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.employee.read'));
