-- 0008_ai_automation: insights and alerts, executive action approvals, and automation rules for the AI module.
-- The engine is deterministic (rules over live finance, inventory and CRM data). Nothing here calls an external model.
--
-- Extra columns beyond the brief, each needed to work: rule_key and fingerprint (so a rescan updates a finding instead of
-- duplicating it), metric_unit (metric_value is fils, a count, days or basis points), title_ar and summary_ar on approvals
-- (what the executive reads), insight_id, decision_note, result_json (what execution did), version (concurrent edits).
-- Two action types beyond the four in the brief, payment_reminder and lead_followup, because no message channel exists:
-- executing one records an audit row and returns a ready-to-send Arabic message. Nothing is sent.

-- ---- inventory ledger: a restock approved by an executive is traceable to its approval ----
alter table stock_movements drop constraint stock_movements_reference;
alter table stock_movements drop constraint stock_movements_reference_type_check;
alter table stock_movements add constraint stock_movements_reference_type_check
  check (reference_type in ('manual', 'invoice', 'transfer', 'restock'));
alter table stock_movements add constraint stock_movements_reference check (
  (reference_type = 'manual' and reference_id is null)
  or (reference_type in ('invoice', 'transfer', 'restock') and reference_id is not null)
);

-- ---- insights and alerts ----
create table ai_insights_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  rule_key text not null check (char_length(rule_key) between 1 and 80),
  fingerprint text not null check (char_length(fingerprint) between 1 and 200),
  severity text not null check (severity in ('critical', 'warning', 'opportunity')),
  category text not null check (category in ('finance', 'inventory', 'crm')),
  title_ar text not null check (char_length(title_ar) between 1 and 300),
  description_ar text not null check (char_length(description_ar) between 1 and 2000),
  metric_value bigint not null,
  metric_unit text not null check (metric_unit in ('fils', 'count', 'days', 'bps')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  source_entity_type text check (source_entity_type is null or source_entity_type in ('item', 'customer', 'lead', 'invoice')),
  source_entity_id uuid,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint ai_insights_alerts_tenant_id_key unique (tenant_id, id),
  constraint ai_insights_alerts_source check ((source_entity_type is null) = (source_entity_id is null)),
  constraint ai_insights_alerts_resolved check ((status = 'resolved') = (resolved_at is not null))
);
-- One live (open or acknowledged) finding per fingerprint. A resolved one is history, so the same finding can come back.
create unique index ai_insights_alerts_live_fingerprint_idx
  on ai_insights_alerts (tenant_id, fingerprint) where status in ('open', 'acknowledged');
create index ai_insights_alerts_list_idx on ai_insights_alerts (tenant_id, detected_at desc, id desc);
create index ai_insights_alerts_status_idx on ai_insights_alerts (tenant_id, status, severity);
create index ai_insights_alerts_category_idx on ai_insights_alerts (tenant_id, category, status);
create index ai_insights_alerts_source_idx on ai_insights_alerts (tenant_id, source_entity_type, source_entity_id);
create trigger ai_insights_alerts_updated_at before update on ai_insights_alerts for each row execute function set_updated_at();
create trigger ai_insights_alerts_no_delete before delete on ai_insights_alerts for each row execute function prevent_delete();

-- A resolved finding is history and never reopens. A returning finding is a new row.
create or replace function ai_insights_alerts_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'resolved' and new.status is distinct from old.status then
    raise exception 'A resolved insight cannot change status' using errcode = 'restrict_violation';
  end if;
  if new.tenant_id is distinct from old.tenant_id or new.fingerprint is distinct from old.fingerprint
     or new.rule_key is distinct from old.rule_key then
    raise exception 'The tenant, rule and fingerprint of an insight cannot change' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger ai_insights_alerts_guard_trigger before update on ai_insights_alerts
  for each row execute function ai_insights_alerts_guard();

-- ---- executive action approvals ----
-- estimated_impact_fils is signed. Money the business gains, collects or protects is positive. Money it spends or gives
-- up (a restock, a discount) is negative.
create table ai_action_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  insight_id uuid,
  rule_key text not null check (char_length(rule_key) between 1 and 80),
  fingerprint text not null check (char_length(fingerprint) between 1 and 200),
  action_type text not null
    check (action_type in ('auto_reorder', 'credit_hold', 'discount_approval', 'price_adjustment', 'payment_reminder', 'lead_followup')),
  title_ar text not null check (char_length(title_ar) between 1 and 300),
  summary_ar text not null check (char_length(summary_ar) between 1 and 2000),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  estimated_impact_fils bigint not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed')),
  requested_by_ai_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  result_json jsonb check (result_json is null or jsonb_typeof(result_json) = 'object'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint ai_action_approvals_tenant_id_key unique (tenant_id, id),
  foreign key (tenant_id, insight_id) references ai_insights_alerts (tenant_id, id),
  -- A pending request has no decision. Anything else has a time. A person decides unless the engine withdrew its own
  -- request because the cause went away (rejected with no decider).
  constraint ai_action_approvals_decision check (
    (status = 'pending' and decided_at is null and decided_by is null and result_json is null)
    or (status <> 'pending' and decided_at is not null)
  ),
  constraint ai_action_approvals_executed check (status <> 'executed' or decided_by is not null),
  constraint ai_action_approvals_result check ((status = 'executed') = (result_json is not null))
);
create unique index ai_action_approvals_pending_fingerprint_idx
  on ai_action_approvals (tenant_id, fingerprint) where status = 'pending';
create index ai_action_approvals_list_idx on ai_action_approvals (tenant_id, status, requested_by_ai_at desc, id desc);
create index ai_action_approvals_requested_idx on ai_action_approvals (tenant_id, requested_by_ai_at desc, id desc);
create index ai_action_approvals_cooldown_idx on ai_action_approvals (tenant_id, fingerprint, decided_at desc)
  where status in ('rejected', 'executed');
create index ai_action_approvals_insight_idx on ai_action_approvals (tenant_id, insight_id) where insight_id is not null;
create trigger ai_action_approvals_updated_at before update on ai_action_approvals for each row execute function set_updated_at();
create trigger ai_action_approvals_no_delete before delete on ai_action_approvals for each row execute function prevent_delete();

-- pending -> approved | rejected | executed, approved -> executed. rejected and executed are final, and a decided
-- request keeps the payload and the impact it was decided on.
create or replace function ai_action_approvals_guard() returns trigger
language plpgsql as $$
begin
  if old.status in ('rejected', 'executed') and new.status is distinct from old.status then
    raise exception 'A % request cannot change status', old.status using errcode = 'restrict_violation';
  end if;
  if old.status = 'approved' and new.status not in ('approved', 'executed') then
    raise exception 'An approved request can only be executed' using errcode = 'restrict_violation';
  end if;
  if old.status <> 'pending' and (
       new.payload_json is distinct from old.payload_json
       or new.estimated_impact_fils is distinct from old.estimated_impact_fils
       or new.action_type is distinct from old.action_type) then
    raise exception 'A decided request keeps the payload it was decided on' using errcode = 'restrict_violation';
  end if;
  if new.tenant_id is distinct from old.tenant_id or new.fingerprint is distinct from old.fingerprint
     or new.rule_key is distinct from old.rule_key then
    raise exception 'The tenant, rule and fingerprint of a request cannot change' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger ai_action_approvals_guard_trigger before update on ai_action_approvals
  for each row execute function ai_action_approvals_guard();

-- ---- automation rules ----
-- A rule says when it runs (trigger_event), what it looks for (condition_json holds its thresholds) and what it proposes
-- (action_type). A full scan evaluates every active rule. An event runs only the rules bound to that event.
create table erp_automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  rule_key text not null check (char_length(rule_key) between 1 and 80),
  name text not null check (char_length(name) between 1 and 200),
  description_ar text not null default '' check (char_length(description_ar) <= 1000),
  trigger_event text not null check (trigger_event ~ '^[a-z_]+(\.[a-z_]+){1,3}$'),
  condition_json jsonb not null check (jsonb_typeof(condition_json) = 'object'),
  action_type text not null
    check (action_type in ('auto_reorder', 'credit_hold', 'discount_approval', 'price_adjustment', 'payment_reminder', 'lead_followup')),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint erp_automation_rules_tenant_id_key unique (tenant_id, id),
  constraint erp_automation_rules_tenant_key unique (tenant_id, rule_key)
);
create index erp_automation_rules_trigger_idx on erp_automation_rules (tenant_id, trigger_event) where is_active;
create trigger erp_automation_rules_updated_at before update on erp_automation_rules for each row execute function set_updated_at();
create trigger erp_automation_rules_no_delete before delete on erp_automation_rules for each row execute function prevent_delete();

-- ---- RLS: read-only for the signed-in user, by permission. Writes go through the API. ----
alter table ai_insights_alerts enable row level security;
alter table ai_action_approvals enable row level security;
alter table erp_automation_rules enable row level security;

revoke all on ai_insights_alerts, ai_action_approvals, erp_automation_rules from anon, authenticated;
grant select on ai_insights_alerts, ai_action_approvals, erp_automation_rules to authenticated;

create policy ai_insights_alerts_select on ai_insights_alerts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'ai.insight.read'));
create policy ai_action_approvals_select on ai_action_approvals for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'ai.action.read'));
create policy erp_automation_rules_select on erp_automation_rules for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'ai.rule.read'));

-- ---- default rules ----
-- Thresholds are seed values you can edit per tenant. Money is in fils (1,000,000 = 1,000.000 KWD).
create or replace function erp_seed_ai_rules(p_tenant uuid, p_user uuid) returns void
language plpgsql as $$
begin
  insert into erp_automation_rules (tenant_id, rule_key, name, description_ar, trigger_event, condition_json, action_type, created_by)
  values
    (p_tenant, 'inventory.low_stock', 'مخزون عند حد إعادة الطلب أو أقل',
     'يرصد الأصناف النشطة التي وصل رصيدها إلى حد إعادة الطلب أو أقل، ويقترح أمر تموين بكمية وتكلفة محسوبتين.',
     'inventory.item.reorder_level_reached',
     '{"restockMultiplier": 2, "targetCoverDays": 30, "windowDays": 30, "cooldownDays": 7}'::jsonb,
     'auto_reorder', p_user),
    (p_tenant, 'inventory.fast_depleting', 'مخزون يتناقص بسرعة',
     'يرصد الأصناف التي تكفي أقل من عدد أيام محدد بحسب متوسط الصرف، ويقترح أمر تموين.',
     'ai.scan.requested',
     '{"coverDays": 14, "restockMultiplier": 2, "targetCoverDays": 30, "windowDays": 30, "cooldownDays": 7}'::jsonb,
     'auto_reorder', p_user),
    (p_tenant, 'finance.payment_reminder', 'فواتير متأخرة عالية القيمة',
     'يرصد العملاء الذين تأخرت فواتيرهم المفتوحة بمبلغ وعدد أيام يتجاوزان الحد، ويقترح تذكير سداد.',
     'ai.scan.requested',
     '{"minOverdueDays": 7, "minOverdueMinor": 1000000, "cooldownDays": 7}'::jsonb,
     'payment_reminder', p_user),
    (p_tenant, 'finance.credit_hold', 'إيقاف ائتمان عميل متأخر',
     'يقترح إيقاف التعامل مع عميل تأخر سداده طويلًا. التنفيذ يحظر العميل في إدارة العملاء.',
     'ai.scan.requested',
     '{"minOverdueDays": 30, "minOverdueMinor": 1000000, "cooldownDays": 7}'::jsonb,
     'credit_hold', p_user),
    (p_tenant, 'finance.margin_floor', 'هامش ربح أقل من الحد الأدنى',
     'يرصد الأصناف التي يقل هامش بيعها عن الحد الأدنى، ويقترح سعر بيع يعيد الهامش إلى الحد.',
     'ai.scan.requested',
     '{"marginFloorBps": 2000, "windowDays": 30, "cooldownDays": 7}'::jsonb,
     'price_adjustment', p_user),
    (p_tenant, 'crm.stalled_leads', 'فرص عالية الاحتمال متوقفة',
     'يرصد الفرص المفتوحة عالية الاحتمال التي لم يتغير فيها شيء منذ مدة، ويقترح متابعة.',
     'ai.scan.requested',
     '{"minProbability": 60, "staleDays": 14, "cooldownDays": 7}'::jsonb,
     'lead_followup', p_user),
    (p_tenant, 'crm.discount_incentive', 'حافز سعري لفرصة متوقفة',
     'لفرصة متوقفة لها عرض سعر مسودة، يقترح خصمًا على أسعار بنود المسودة.',
     'ai.scan.requested',
     '{"discountBps": 500, "minProbability": 60, "staleDays": 14, "cooldownDays": 7}'::jsonb,
     'discount_approval', p_user)
  on conflict (tenant_id, rule_key) do nothing;
end;
$$;
revoke all on function erp_seed_ai_rules(uuid, uuid) from public, anon, authenticated;

select erp_seed_ai_rules(t.id, t.created_by) from tenants t;

-- ---- permissions for tenants that already exist ----
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
join (values
  ('owner', 'ai.insight.read'), ('owner', 'ai.insight.update'), ('owner', 'ai.scan.run'), ('owner', 'ai.action.read'),
  ('owner', 'ai.action.approve'), ('owner', 'ai.rule.read'), ('owner', 'ai.rule.update'),
  ('accountant', 'ai.insight.read'), ('accountant', 'ai.insight.update'), ('accountant', 'ai.scan.run'),
  ('accountant', 'ai.action.read'), ('accountant', 'ai.rule.read'),
  ('approver', 'ai.insight.read'), ('approver', 'ai.action.read'), ('approver', 'ai.action.approve'),
  ('viewer', 'ai.insight.read'), ('viewer', 'ai.action.read')
) as p (role_name, permission) on p.role_name = r.name
on conflict (role_id, permission) do nothing;

-- New tenants get the same permissions and the default rules. Replaces the function from 0007.
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
    'inventory.stock.read', 'inventory.stock.adjust',
    'ai.insight.read', 'ai.insight.update', 'ai.scan.run', 'ai.action.read', 'ai.action.approve', 'ai.rule.read', 'ai.rule.update'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_accountant_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.payment.create', 'crm.customer.read', 'crm.customer.create', 'crm.customer.update',
    'crm.lead.read', 'crm.lead.create', 'crm.lead.update',
    'crm.quotation.read', 'crm.quotation.create', 'crm.quotation.update', 'crm.quotation.accept', 'crm.quotation.convert',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read',
    'ai.insight.read', 'ai.insight.update', 'ai.scan.run', 'ai.action.read', 'ai.rule.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_approver_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.approve', 'finance.invoice.void', 'crm.customer.read',
    'crm.lead.read', 'crm.quotation.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read',
    'ai.insight.read', 'ai.action.read', 'ai.action.approve'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_viewer_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'crm.customer.read', 'crm.lead.read', 'crm.quotation.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read',
    'ai.insight.read', 'ai.action.read'
  ]) as permission;

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);

  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);

  insert into profiles (id) values (p_owner) on conflict (id) do nothing;

  perform erp_seed_ai_rules(v_tenant, p_owner);

  return v_tenant;
end;
$$;

revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;
