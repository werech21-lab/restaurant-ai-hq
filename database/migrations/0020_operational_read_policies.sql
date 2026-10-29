-- 0020_operational_read_policies: kitchen and delivery rows are readable only with the screen's permission.
--
-- Membership alone is not enough. Recipes, waste and production use inventory.item.read.
-- Delivery partners, orders and settlements use finance.journal.read.

drop policy recipes_select on recipes;
create policy recipes_select on recipes for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));

drop policy recipe_lines_select on recipe_lines;
create policy recipe_lines_select on recipe_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));

drop policy kitchen_waste_select on kitchen_waste;
create policy kitchen_waste_select on kitchen_waste for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));

drop policy kitchen_productions_select on kitchen_productions;
create policy kitchen_productions_select on kitchen_productions for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));

drop policy delivery_partners_select on delivery_partners;
create policy delivery_partners_select on delivery_partners for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.journal.read'));

drop policy delivery_orders_select on delivery_orders;
create policy delivery_orders_select on delivery_orders for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.journal.read'));

drop policy delivery_settlements_select on delivery_settlements;
create policy delivery_settlements_select on delivery_settlements for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.journal.read'));

create function erp_operational_read_marker() returns boolean
language sql stable as $$ select true $$;
revoke all on function erp_operational_read_marker() from public, anon, authenticated;
