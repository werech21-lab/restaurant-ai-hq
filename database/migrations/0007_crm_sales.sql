-- 0007_crm_sales: customers, the sales pipeline and quotations, linked to inventory items and finance invoices.
--
-- Decisions (from the product owner):
--   * A quotation becomes an invoice only through the explicit convert action, never by accepting it.
--   * Conversion creates the invoice and submits it by the normal finance rules: issued (stock deducted) when the total is
--     at or under the approval limit, otherwise pending approval (stock deducted when it is approved).
--   * Each quotation line picks its warehouse. The invoice due date is 30 days after the issue date.
--   * credit_limit_minor is enforced when converting: open balance plus the new invoice total may not exceed it.
--     A null limit means no limit.
--   * Lead stages: new, contacted, qualified and proposal move freely. won and lost are final.
--   * Only an active customer can be invoiced. A quotation for a lead or prospect cannot be converted until the customer is activated.
--
-- Table names: the repo already had `customers` and `deals`, which finance references. They are extended in place
-- (deals is renamed to crm_leads_pipeline) instead of creating parallel tables. Money columns end in _minor like every other table.

-- ---- customers ----
alter table customers drop constraint customers_status_check;
update customers set status = 'blocked' where status = 'inactive';
alter table customers add constraint customers_status_check check (status in ('lead', 'prospect', 'active', 'blocked'));
alter table customers
  add column customer_type text not null default 'company' check (customer_type in ('company', 'individual')),
  add column tax_id text check (tax_id is null or char_length(tax_id) between 1 and 40),
  add column address text check (address is null or char_length(address) <= 500),
  -- null means no credit limit. 0 means no credit at all.
  add column credit_limit_minor bigint check (credit_limit_minor is null or credit_limit_minor between 0 and 1000000000000);
create index customers_tenant_status_idx on customers (tenant_id, status, name, id);
create index customers_tenant_tax_idx on customers (tenant_id, tax_id) where tax_id is not null;

-- ---- leads pipeline (was deals) ----
alter table deals rename to crm_leads_pipeline;
alter table crm_leads_pipeline rename column value_minor to expected_revenue_minor;
alter table crm_leads_pipeline rename constraint deals_pkey to crm_leads_pipeline_pkey;
alter table crm_leads_pipeline rename constraint deals_tenant_id_key to crm_leads_pipeline_tenant_id_key;
alter index deals_customer_idx rename to crm_leads_customer_idx;
alter index deals_stage_idx rename to crm_leads_stage_idx;
alter trigger deals_updated_at on crm_leads_pipeline rename to crm_leads_pipeline_updated_at;

alter table crm_leads_pipeline drop constraint deals_stage_check;
update crm_leads_pipeline set stage = 'new' where stage = 'lead';
alter table crm_leads_pipeline
  add constraint crm_leads_stage_check check (stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  add column probability smallint not null default 0 check (probability between 0 and 100),
  add column assigned_to uuid,
  add column notes text check (notes is null or char_length(notes) <= 2000);
alter table crm_leads_pipeline alter column stage set default 'new';
update crm_leads_pipeline set probability = 100 where stage = 'won';
alter table crm_leads_pipeline
  add constraint crm_leads_revenue_max check (expected_revenue_minor <= 1000000000000),
  add constraint crm_leads_closed_probability check (
    (stage <> 'won' or probability = 100) and (stage <> 'lost' or probability = 0)
  ),
  add constraint crm_leads_assignee_fk foreign key (tenant_id, assigned_to) references tenant_members (tenant_id, user_id);
create index crm_leads_assignee_idx on crm_leads_pipeline (tenant_id, assigned_to) where assigned_to is not null;
create index crm_leads_close_idx on crm_leads_pipeline (tenant_id, expected_close_date, id) where expected_close_date is not null;
create index crm_leads_stage_created_idx on crm_leads_pipeline (tenant_id, stage, created_at desc, id desc);
create trigger crm_leads_pipeline_no_delete before delete on crm_leads_pipeline for each row execute function prevent_delete();

-- A won or lost lead is final: its stage cannot change again.
create or replace function crm_leads_final_stage() returns trigger
language plpgsql as $$
begin
  if old.stage in ('won', 'lost') and new.stage is distinct from old.stage then
    raise exception 'A % lead cannot change stage', old.stage using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger crm_leads_final_stage_guard before update on crm_leads_pipeline
  for each row execute function crm_leads_final_stage();

-- ---- quotations ----
create table sales_quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  quote_number text not null check (char_length(quote_number) between 1 and 40),
  customer_id uuid not null,
  customer_name text not null check (char_length(customer_name) between 1 and 200),
  lead_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  valid_until date not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  tax_minor bigint not null check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  invoice_id uuid,
  sent_at timestamptz,
  accepted_at timestamptz,
  converted_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint sales_quotations_tenant_id_key unique (tenant_id, id),
  constraint sales_quotations_tenant_number_key unique (tenant_id, quote_number),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, lead_id) references crm_leads_pipeline (tenant_id, id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id),
  constraint sales_quotations_total check (total_minor = subtotal_minor + tax_minor),
  constraint sales_quotations_converted_invoice check ((status = 'converted') = (invoice_id is not null)),
  constraint sales_quotations_sent_at check (status = 'draft' or sent_at is not null),
  constraint sales_quotations_accepted_at check (status not in ('accepted', 'converted') or accepted_at is not null),
  constraint sales_quotations_converted_at check ((status = 'converted') = (converted_at is not null))
);
create unique index sales_quotations_invoice_key on sales_quotations (tenant_id, invoice_id) where invoice_id is not null;
create index sales_quotations_tenant_created_idx on sales_quotations (tenant_id, created_at desc, id desc);
create index sales_quotations_tenant_valid_idx on sales_quotations (tenant_id, valid_until, id);
create index sales_quotations_tenant_total_idx on sales_quotations (tenant_id, total_minor, id);
create index sales_quotations_tenant_status_idx on sales_quotations (tenant_id, status, created_at desc);
create index sales_quotations_customer_idx on sales_quotations (tenant_id, customer_id, created_at desc);
create index sales_quotations_lead_idx on sales_quotations (tenant_id, lead_id) where lead_id is not null;
create trigger sales_quotations_updated_at before update on sales_quotations for each row execute function set_updated_at();
create trigger sales_quotations_no_delete before delete on sales_quotations for each row execute function prevent_delete();

create table sales_quotation_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  quotation_id uuid not null,
  position integer not null check (position >= 1),
  inventory_item_id uuid,
  warehouse_id uuid,
  description text not null check (char_length(description) between 1 and 300),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 1000000000),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  -- Net of the line (quantity x unit price). Tax is not rounded per line: it is summed unrounded and rounded once per quotation.
  line_net_minor bigint generated always as (quantity::bigint * unit_price_minor) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint sales_quotation_lines_position_key unique (quotation_id, position),
  constraint sales_quotation_lines_stock_pair check ((inventory_item_id is null) = (warehouse_id is null)),
  foreign key (tenant_id, quotation_id) references sales_quotations (tenant_id, id),
  foreign key (tenant_id, inventory_item_id) references items (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create index sales_quotation_lines_quotation_idx on sales_quotation_lines (tenant_id, quotation_id);
create index sales_quotation_lines_item_idx on sales_quotation_lines (tenant_id, inventory_item_id) where inventory_item_id is not null;
create trigger sales_quotation_lines_updated_at before update on sales_quotation_lines for each row execute function set_updated_at();

-- Lines may only change while their quotation is a draft.
create or replace function sales_quotation_lines_draft_only() returns trigger
language plpgsql as $$
declare
  v_quotation uuid := coalesce(new.quotation_id, old.quotation_id);
  v_status text;
begin
  select status into v_status from sales_quotations where id = v_quotation;
  if v_status is distinct from 'draft' then
    raise exception 'Quotation lines can only change while the quotation is a draft' using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger sales_quotation_lines_draft_guard before insert or update or delete on sales_quotation_lines
  for each row execute function sales_quotation_lines_draft_only();

-- At commit, a quotation's stored subtotal and tax must equal what its lines produce (tax rounded half up once).
create or replace function sales_quotation_totals_match_lines() returns trigger
language plpgsql as $$
declare
  v_subtotal numeric;
  v_tax numeric;
begin
  select coalesce(sum(line_net_minor), 0),
         floor((coalesce(sum(line_net_minor::numeric * tax_rate_bps), 0) + 5000) / 10000)
    into v_subtotal, v_tax
    from sales_quotation_lines
    where quotation_id = new.id;
  if new.subtotal_minor <> v_subtotal or new.tax_minor <> v_tax then
    raise exception 'Quotation totals do not match the quotation lines' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;
create constraint trigger sales_quotations_totals_check after insert or update of subtotal_minor, tax_minor on sales_quotations
  deferrable initially deferred for each row execute function sales_quotation_totals_match_lines();

-- Status flow: draft -> sent -> accepted | rejected | expired, accepted -> converted. Rejected, expired and converted are final.
-- Once a quotation leaves draft its commercial fields are frozen.
create or replace function sales_quotations_guard() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status = 'sent')
    or (old.status = 'sent' and new.status in ('accepted', 'rejected', 'expired'))
    or (old.status = 'accepted' and new.status = 'converted')
  ) then
    raise exception 'A quotation cannot go from % to %', old.status, new.status using errcode = 'restrict_violation';
  end if;
  if old.status <> 'draft' and (
    new.quote_number, new.customer_id, new.customer_name, new.lead_id, new.currency, new.valid_until, new.notes,
    new.subtotal_minor, new.tax_minor, new.total_minor
  ) is distinct from (
    old.quote_number, old.customer_id, old.customer_name, old.lead_id, old.currency, old.valid_until, old.notes,
    old.subtotal_minor, old.tax_minor, old.total_minor
  ) then
    raise exception 'A quotation that is no longer a draft cannot change its amounts, dates or customer' using errcode = 'restrict_violation';
  end if;
  if old.status in ('rejected', 'expired', 'converted') and new.version is distinct from old.version then
    raise exception 'A % quotation cannot change', old.status using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger sales_quotations_guard_trigger before update on sales_quotations
  for each row execute function sales_quotations_guard();

-- ---- RLS: read-only for the signed-in user, by permission. Writes go through the API. ----
alter table sales_quotations enable row level security;
alter table sales_quotation_lines enable row level security;

revoke all on sales_quotations, sales_quotation_lines, crm_leads_pipeline from anon, authenticated;
grant select on sales_quotations, sales_quotation_lines, crm_leads_pipeline to authenticated;

drop policy deals_select on crm_leads_pipeline;
create policy crm_leads_pipeline_select on crm_leads_pipeline for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'crm.lead.read'));
create policy sales_quotations_select on sales_quotations for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'crm.quotation.read'));
create policy sales_quotation_lines_select on sales_quotation_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'crm.quotation.read'));

-- ---- permissions for tenants that already exist ----
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
join (values
  ('owner', 'crm.customer.update'), ('owner', 'crm.lead.read'), ('owner', 'crm.lead.create'), ('owner', 'crm.lead.update'),
  ('owner', 'crm.quotation.read'), ('owner', 'crm.quotation.create'), ('owner', 'crm.quotation.update'),
  ('owner', 'crm.quotation.accept'), ('owner', 'crm.quotation.convert'),
  ('accountant', 'crm.customer.update'), ('accountant', 'crm.lead.read'), ('accountant', 'crm.lead.create'),
  ('accountant', 'crm.lead.update'), ('accountant', 'crm.quotation.read'), ('accountant', 'crm.quotation.create'),
  ('accountant', 'crm.quotation.update'), ('accountant', 'crm.quotation.accept'), ('accountant', 'crm.quotation.convert'),
  ('approver', 'crm.lead.read'), ('approver', 'crm.quotation.read'),
  ('viewer', 'crm.lead.read'), ('viewer', 'crm.quotation.read')
) as p (role_name, permission) on p.role_name = r.name
on conflict (role_id, permission) do nothing;

-- New tenants get the same permissions. Replaces the function from 0006.
create or replace function erp_bootstrap_tenant(p_name text, p_slug text, p_owner uuid) returns uuid
language plpgsql as $$
declare
  v_tenant uuid;
  v_owner_role uuid;
  v_accountant_role uuid;
  v_approver_role uuid;
  v_viewer_role uuid;
begin
  insert into tenants (name, slug, created_by) values (p_name, p_slug, p_owner) returning id into v_tenant;

  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'owner', 'Full access', p_owner) returning id into v_owner_role;
  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'accountant', 'Prepares invoices and records payments', p_owner) returning id into v_accountant_role;
  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'approver', 'Approves and voids invoices', p_owner) returning id into v_approver_role;
  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'viewer', 'Read only', p_owner) returning id into v_viewer_role;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_owner_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.invoice.approve', 'finance.invoice.void', 'finance.payment.create',
    'crm.customer.read', 'crm.customer.create', 'crm.customer.update',
    'crm.lead.read', 'crm.lead.create', 'crm.lead.update',
    'crm.quotation.read', 'crm.quotation.create', 'crm.quotation.update', 'crm.quotation.accept', 'crm.quotation.convert',
    'inventory.item.read', 'inventory.item.create', 'inventory.item.update',
    'inventory.warehouse.read', 'inventory.warehouse.create', 'inventory.warehouse.update',
    'inventory.stock.read', 'inventory.stock.adjust'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_accountant_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.payment.create', 'crm.customer.read', 'crm.customer.create', 'crm.customer.update',
    'crm.lead.read', 'crm.lead.create', 'crm.lead.update',
    'crm.quotation.read', 'crm.quotation.create', 'crm.quotation.update', 'crm.quotation.accept', 'crm.quotation.convert',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_approver_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.approve', 'finance.invoice.void', 'crm.customer.read',
    'crm.lead.read', 'crm.quotation.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_viewer_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'crm.customer.read', 'crm.lead.read', 'crm.quotation.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read'
  ]) as permission;

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);

  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);

  insert into profiles (id) values (p_owner) on conflict (id) do nothing;

  return v_tenant;
end;
$$;

revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;
