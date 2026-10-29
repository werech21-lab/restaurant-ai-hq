-- 0019_operational_posting: collection, kitchen consumption and delivery commission journals.
--
-- A customer collection debits the cash account and credits accounts receivable. It is posted only when both accounts
-- are saved on finance_settings. The sales invoice still does not recognise revenue.
-- A kitchen waste row or a production run issues raw materials (a negative stock movement) and debits the COGS account
-- and credits inventory for that cost. The waste row recorded before this migration has no warehouse and is not rewritten.
-- Settling a delivery order posts the commission written on the order: debit commission expense, credit cash.
-- Nothing here calculates a commission percentage.

alter table finance_settings
  add column receivable_account_id uuid,
  add column collection_account_id uuid,
  add column commission_account_id uuid;
alter table finance_settings
  add constraint finance_settings_receivable_fk foreign key (tenant_id, receivable_account_id) references accounts (tenant_id, id),
  add constraint finance_settings_collection_fk foreign key (tenant_id, collection_account_id) references accounts (tenant_id, id),
  add constraint finance_settings_commission_fk foreign key (tenant_id, commission_account_id) references accounts (tenant_id, id),
  add constraint finance_settings_collection_pair check (
    (receivable_account_id is null and collection_account_id is null)
    or (receivable_account_id is not null and collection_account_id is not null)
  );

alter table journal_entries drop constraint journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in (
    'manual', 'reversal', 'supplier_invoice', 'goods_receipt', 'purchase_return',
    'supplier_credit_note', 'supplier_payment', 'sales_cogs',
    'customer_collection', 'kitchen_issue', 'delivery_commission'
  ));

create or replace function journal_entries_source_guard() returns trigger
language plpgsql as $$
declare
  v_source text;
begin
  if new.reverses_id is not null then
    select source_type into v_source from journal_entries where tenant_id = new.tenant_id and id = new.reverses_id;
    if v_source in ('goods_receipt', 'purchase_return') then
      raise exception 'An entry made by a goods receipt or a purchase return cannot be reversed' using errcode = 'restrict_violation';
    end if;
    if v_source in (
      'supplier_invoice', 'supplier_credit_note', 'supplier_payment', 'sales_cogs',
      'customer_collection', 'kitchen_issue', 'delivery_commission'
    ) and coalesce(current_setting('erp.source_void', true), '') <> new.reverses_id::text then
      raise exception 'An entry made by a source document can only be reversed by voiding the document' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_source_guard() from public, anon, authenticated;

alter table stock_movements drop constraint stock_movements_reference;
alter table stock_movements drop constraint stock_movements_reference_type_check;
alter table stock_movements add constraint stock_movements_reference_type_check
  check (reference_type in ('manual', 'invoice', 'transfer', 'restock', 'purchase_receipt', 'purchase_return', 'kitchen_issue'));
alter table stock_movements add constraint stock_movements_reference check (
  (reference_type = 'manual' and reference_id is null)
  or (reference_type in ('invoice', 'transfer', 'restock', 'purchase_receipt', 'purchase_return', 'kitchen_issue') and reference_id is not null)
);

alter table kitchen_waste add column warehouse_id uuid;
alter table kitchen_waste
  add constraint kitchen_waste_warehouse_fk foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id);

create table kitchen_productions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  recipe_id uuid not null,
  warehouse_id uuid not null,
  batches integer not null check (batches between 1 and 1000000),
  produced_on date not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint kitchen_productions_tenant_id_key unique (tenant_id, id),
  constraint kitchen_productions_recipe_fk foreign key (tenant_id, recipe_id) references recipes (tenant_id, id),
  constraint kitchen_productions_warehouse_fk foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create index kitchen_productions_created_idx on kitchen_productions (tenant_id, created_at desc, id desc);
create trigger kitchen_productions_no_update before update on kitchen_productions for each row execute function prevent_update();
create trigger kitchen_productions_no_delete before delete on kitchen_productions for each row execute function prevent_delete();

alter table delivery_orders add constraint delivery_orders_tenant_id_key unique (tenant_id, id);

create table delivery_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  order_id uuid not null,
  settled_on date not null,
  commission_minor bigint not null check (commission_minor between 0 and 1000000000000),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint delivery_settlements_tenant_id_key unique (tenant_id, id),
  constraint delivery_settlements_order_once unique (tenant_id, order_id),
  constraint delivery_settlements_order_fk foreign key (tenant_id, order_id) references delivery_orders (tenant_id, id)
);
create index delivery_settlements_created_idx on delivery_settlements (tenant_id, created_at desc, id desc);
create trigger delivery_settlements_no_update before update on delivery_settlements for each row execute function prevent_update();
create trigger delivery_settlements_no_delete before delete on delivery_settlements for each row execute function prevent_delete();

create or replace function delivery_settlements_match() returns trigger
language plpgsql as $$
declare
  v_commission bigint;
  v_status text;
begin
  select commission_minor, status into v_commission, v_status
    from delivery_orders where tenant_id = new.tenant_id and id = new.order_id;
  if v_status is distinct from 'recorded' then
    raise exception 'Only a recorded delivery order can be settled' using errcode = 'restrict_violation';
  end if;
  if v_commission is distinct from new.commission_minor then
    raise exception 'The settlement must use the commission written on the order' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function delivery_settlements_match() from public, anon, authenticated;
create trigger delivery_settlements_match before insert on delivery_settlements
  for each row execute function delivery_settlements_match();

alter table ai_action_approvals drop constraint ai_action_approvals_action_type_check;
alter table ai_action_approvals add constraint ai_action_approvals_action_type_check
  check (action_type in (
    'auto_reorder', 'credit_hold', 'discount_approval', 'price_adjustment', 'payment_reminder', 'lead_followup',
    'scenario_choice'
  ));
alter table erp_automation_rules drop constraint erp_automation_rules_action_type_check;
alter table erp_automation_rules add constraint erp_automation_rules_action_type_check
  check (action_type in (
    'auto_reorder', 'credit_hold', 'discount_approval', 'price_adjustment', 'payment_reminder', 'lead_followup',
    'scenario_choice'
  ));

alter table kitchen_productions enable row level security;
alter table delivery_settlements enable row level security;
revoke all on kitchen_productions, delivery_settlements from anon, authenticated;
grant select on kitchen_productions, delivery_settlements to authenticated;

create policy kitchen_productions_select on kitchen_productions for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy delivery_settlements_select on delivery_settlements for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));

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
     'discount_approval', p_user),
    (p_tenant, 'operations.cost_scenarios', 'سيناريوهات تكلفة التشغيل',
     'يرصد فرق تكلفة المواد والهدر وعمولة التوصيل، ويعرض ثلاثة خيارات مالية. لا يُنفَّذ شيء قبل اعتماد بشري.',
     'ai.scan.requested',
     '{"minImpactMinor": 1, "cooldownDays": 7}'::jsonb,
     'scenario_choice', p_user)
  on conflict (tenant_id, rule_key) do nothing;
end;
$$;
revoke all on function erp_seed_ai_rules(uuid, uuid) from public, anon, authenticated;

select erp_seed_ai_rules(t.id, t.created_by) from tenants t;
