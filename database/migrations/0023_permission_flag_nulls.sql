-- 0023_permission_flag_nulls: a missing permission flag must not remove access.
--
-- Comparing a missing JSON value to 'false' is unknown, and that unknown made every iam permission fail the policy.
-- Only an explicit false turns an ability off.

create or replace function auth_has_permission(p_tenant uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from tenant_members m
    join role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.status = 'active'
      and rp.permission = p_permission
      and not (
        (p_permission = 'finance.journal.post' and coalesce(m.permission_flags->>'can_post_journal' = 'false', false))
        or (p_permission in ('procurement.order.approve', 'procurement.request.approve') and coalesce(m.permission_flags->>'can_approve_po' = 'false', false))
        or (p_permission = 'finance.invoice.approve' and coalesce(m.permission_flags->>'can_approve_invoice' = 'false', false))
        or (p_permission = 'ai.action.approve' and coalesce(m.permission_flags->>'can_execute_ai' = 'false', false))
        or (p_permission like 'iam.%' and coalesce(m.permission_flags->>'can_manage_users' = 'false', false))
        or (p_permission in (
          'inventory.stock.adjust', 'inventory.item.create', 'inventory.item.update',
          'inventory.warehouse.create', 'inventory.warehouse.update'
        ) and coalesce(m.permission_flags->>'can_manage_inventory' = 'false', false))
      )
  )
$$;

revoke all on function auth_has_permission(uuid, text) from public, anon;
grant execute on function auth_has_permission(uuid, text) to authenticated;
