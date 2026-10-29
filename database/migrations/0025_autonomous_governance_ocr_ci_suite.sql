-- 0025_autonomous_governance_ocr_ci_suite
-- Contract analysis, Kuwait compliance hard-stops, learning memory, archive routing,
-- employee workflow telemetry, and competitive price observations.
--
-- 0023 is already the permission-flag fix, so this file is 0025.
-- Money is whole fils. The screen shows dinars. No external model or OCR service is called.
-- A blocked attempt is stored here and in audit_activity_logs. The business write stays out of the transaction.

create or replace function erp_owner_extra_permissions() returns text[]
language sql immutable as $$
  select array[
    'org.brand.read', 'org.brand.manage', 'org.branch.read', 'org.branch.manage',
    'finance.account.read', 'finance.account.manage', 'finance.journal.read', 'finance.journal.create',
    'finance.journal.post', 'finance.journal.reverse', 'finance.period.manage',
    'procurement.supplier.read', 'procurement.supplier.manage', 'procurement.order.read', 'procurement.order.create',
    'procurement.order.update', 'procurement.order.submit', 'procurement.order.approve', 'procurement.order.cancel',
    'procurement.receipt.read', 'procurement.receipt.create', 'procurement.settings.manage',
    'procurement.request.read', 'procurement.request.create', 'procurement.request.submit', 'procurement.request.approve',
    'procurement.request.cancel', 'procurement.request.convert',
    'procurement.invoice.read', 'procurement.invoice.create', 'procurement.invoice.void',
    'procurement.payment.read', 'procurement.payment.create', 'procurement.payment.void',
    'procurement.return.read', 'procurement.return.create',
    'procurement.creditnote.read', 'procurement.creditnote.create', 'procurement.creditnote.void',
    'hr.employee.read', 'hr.employee.manage', 'hr.attendance.read', 'hr.attendance.manage',
    'hr.leave.read', 'hr.leave.approve', 'hr.payroll.read', 'hr.payroll.run',
    'hr.appraisal.read', 'hr.appraisal.manage', 'hr.expense.read', 'hr.expense.approve',
    'ops.contract.read', 'ops.contract.manage', 'ops.document.read', 'ops.document.manage',
    'ops.quality.read', 'ops.quality.manage',
    'gov.contract.read', 'gov.contract.analyze', 'gov.compliance.read', 'gov.compliance.enforce',
    'gov.memory.read', 'gov.archive.read', 'gov.archive.route',
    'gov.telemetry.read', 'gov.telemetry.record', 'gov.radar.read', 'gov.radar.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

alter table audit_activity_logs drop constraint audit_activity_logs_module_check;
alter table audit_activity_logs add constraint audit_activity_logs_module_check
  check (module in ('finance', 'inventory', 'procurement', 'sales', 'kitchen', 'delivery', 'ai', 'admin', 'hr', 'operations', 'governance'));

create table contract_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  contract_id uuid,
  document_name text not null check (char_length(document_name) between 1 and 200),
  clauses_summary_ar text not null check (char_length(clauses_summary_ar) between 1 and 2000),
  legal_financial_risks_json jsonb not null,
  party_obligations_json jsonb not null,
  penalty_clauses_ar text not null check (char_length(penalty_clauses_ar) between 1 and 2000),
  negotiation_recommendations_ar text not null check (char_length(negotiation_recommendations_ar) between 1 and 2000),
  risk_score integer not null check (risk_score between 0 and 100),
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint contract_ai_analyses_tenant_id_key unique (tenant_id, id),
  constraint contract_ai_analyses_contract_fk foreign key (tenant_id, contract_id) references enterprise_contracts (tenant_id, id)
);

create table regulatory_circulars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  authority_name text not null check (authority_name in ('المرور والنقل', 'بلدية الكويت', 'وزارة التجارة', 'القوى العاملة', 'حماية المستهلك')),
  regulation_code text not null check (char_length(regulation_code) between 1 and 40),
  title_ar text not null check (char_length(title_ar) between 1 and 200),
  target_department text not null check (target_department in ('الأسطول', 'المالية', 'الموارد البشرية', 'العمليات')),
  ai_recommendation_ar text not null check (char_length(ai_recommendation_ar) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'enforced')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint regulatory_circulars_tenant_id_key unique (tenant_id, id),
  constraint regulatory_circulars_code_key unique (tenant_id, regulation_code)
);

create table compliance_enforcement_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  circular_id uuid,
  rule_code text not null check (char_length(rule_code) between 1 and 40),
  rule_type text not null check (rule_type in ('expired_driver_license', 'max_working_hours', 'cash_ceiling_kwd')),
  threshold_value bigint not null check (threshold_value >= 0 and threshold_value <= 1000000000000),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint compliance_enforcement_rules_tenant_id_key unique (tenant_id, id),
  constraint compliance_enforcement_rules_code_key unique (tenant_id, rule_code),
  constraint compliance_enforcement_rules_circular_fk foreign key (tenant_id, circular_id) references regulatory_circulars (tenant_id, id)
);

create table compliance_blocked_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  rule_code text not null check (char_length(rule_code) between 1 and 40),
  actor_name text not null check (char_length(actor_name) between 1 and 200),
  module text not null check (module in ('hr', 'delivery', 'finance', 'operations')),
  attempted_action_ar text not null check (char_length(attempted_action_ar) between 1 and 500),
  block_message_ar text not null check (char_length(block_message_ar) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create table ai_learning_memory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  context_domain text not null check (context_domain in ('pricing', 'task_routing', 'contracts', 'compliance')),
  manager_decision_pattern text not null check (char_length(manager_decision_pattern) between 1 and 500),
  recurring_issue_detected text not null check (char_length(recurring_issue_detected) between 1 and 500),
  learned_weight_adjustment integer not null check (learned_weight_adjustment between -100 and 100),
  confidence_score integer not null check (confidence_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint ai_learning_memory_domain_key unique (tenant_id, context_domain)
);

create table smart_archive_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_type text not null check (file_type in ('pdf', 'image', 'text')),
  document_category text not null check (document_category in ('fuel_invoice', 'contract', 'knet_receipt', 'traffic_fine', 'delivery_waybill')),
  extracted_ocr_json jsonb not null,
  amount_minor bigint not null check (amount_minor >= 0 and amount_minor <= 1000000000000),
  routed_to_module text not null check (routed_to_module in ('/erp/hr', '/erp/contracts', '/erp/delivery', '/erp/finance')),
  routed_record_id uuid,
  status text not null check (status in ('pending', 'routed', 'blocked', 'held', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create table employee_behavior_telemetry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  user_name text not null check (char_length(user_name) between 1 and 200),
  role text not null check (char_length(role) between 1 and 80),
  active_path text not null check (char_length(active_path) between 1 and 200),
  action_sequence_json jsonb not null,
  dwell_time_seconds integer not null check (dwell_time_seconds between 0 and 86400),
  anomaly_flag boolean not null default false,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create table competitive_intelligence_radar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  competitor_name text not null check (char_length(competitor_name) between 1 and 120),
  market_segment text not null check (char_length(market_segment) between 1 and 80),
  item_or_service text not null check (char_length(item_or_service) between 1 and 120),
  our_price_minor bigint not null check (our_price_minor >= 0 and our_price_minor <= 1000000000000),
  competitor_price_minor bigint not null check (competitor_price_minor >= 0 and competitor_price_minor <= 1000000000000),
  promo_detected_ar text not null check (char_length(promo_detected_ar) <= 300),
  ai_executive_insight_ar text not null check (char_length(ai_executive_insight_ar) between 1 and 500),
  recommended_counter_action_ar text not null check (char_length(recommended_counter_action_ar) between 1 and 500),
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create index contract_ai_analyses_tenant_idx on contract_ai_analyses (tenant_id, analyzed_at desc);
create index regulatory_circulars_tenant_idx on regulatory_circulars (tenant_id, regulation_code);
create index compliance_enforcement_rules_tenant_idx on compliance_enforcement_rules (tenant_id, rule_code);
create index compliance_blocked_attempts_tenant_idx on compliance_blocked_attempts (tenant_id, created_at desc);
create index smart_archive_documents_tenant_idx on smart_archive_documents (tenant_id, created_at desc);
create index employee_behavior_telemetry_tenant_idx on employee_behavior_telemetry (tenant_id, recorded_at desc);
create index competitive_intelligence_radar_tenant_idx on competitive_intelligence_radar (tenant_id, scanned_at desc);

create trigger contract_ai_analyses_updated_at before update on contract_ai_analyses for each row execute function set_updated_at();
create trigger regulatory_circulars_updated_at before update on regulatory_circulars for each row execute function set_updated_at();
create trigger compliance_enforcement_rules_updated_at before update on compliance_enforcement_rules for each row execute function set_updated_at();
create trigger compliance_blocked_attempts_updated_at before update on compliance_blocked_attempts for each row execute function set_updated_at();
create trigger ai_learning_memory_updated_at before update on ai_learning_memory for each row execute function set_updated_at();
create trigger smart_archive_documents_updated_at before update on smart_archive_documents for each row execute function set_updated_at();
create trigger employee_behavior_telemetry_updated_at before update on employee_behavior_telemetry for each row execute function set_updated_at();
create trigger competitive_intelligence_radar_updated_at before update on competitive_intelligence_radar for each row execute function set_updated_at();

alter table contract_ai_analyses enable row level security;
alter table regulatory_circulars enable row level security;
alter table compliance_enforcement_rules enable row level security;
alter table compliance_blocked_attempts enable row level security;
alter table ai_learning_memory enable row level security;
alter table smart_archive_documents enable row level security;
alter table employee_behavior_telemetry enable row level security;
alter table competitive_intelligence_radar enable row level security;

revoke all on contract_ai_analyses, regulatory_circulars, compliance_enforcement_rules, compliance_blocked_attempts,
  ai_learning_memory, smart_archive_documents, employee_behavior_telemetry, competitive_intelligence_radar
  from anon, authenticated;
grant select on contract_ai_analyses, regulatory_circulars, compliance_enforcement_rules, compliance_blocked_attempts,
  ai_learning_memory, smart_archive_documents, employee_behavior_telemetry, competitive_intelligence_radar
  to authenticated;

create policy contract_ai_analyses_select on contract_ai_analyses for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.contract.read'));
create policy regulatory_circulars_select on regulatory_circulars for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.compliance.read'));
create policy compliance_enforcement_rules_select on compliance_enforcement_rules for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.compliance.read'));
create policy compliance_blocked_attempts_select on compliance_blocked_attempts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.compliance.read'));
create policy ai_learning_memory_select on ai_learning_memory for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.memory.read'));
create policy smart_archive_documents_select on smart_archive_documents for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.archive.read'));
create policy employee_behavior_telemetry_select on employee_behavior_telemetry for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.telemetry.read'));
create policy competitive_intelligence_radar_select on competitive_intelligence_radar for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.radar.read'));

-- Live rows for companies that already exist. A fresh database has no tenant, so this does nothing there.
do $$
declare
  t record;
  v_contract uuid;
  v_circ1 uuid;
  v_circ2 uuid;
  v_circ3 uuid;
  v_block uuid;
begin
  for t in select id, created_by from tenants loop
    if exists (select 1 from regulatory_circulars where tenant_id = t.id) then
      continue;
    end if;

    select id into v_contract from enterprise_contracts where tenant_id = t.id order by created_at limit 1;

    if v_contract is not null then
      insert into contract_ai_analyses (
        tenant_id, contract_id, document_name, clauses_summary_ar, legal_financial_risks_json, party_obligations_json,
        penalty_clauses_ar, negotiation_recommendations_ar, risk_score, created_by
      ) values (
        t.id, v_contract, 'عقد توريد خضار',
        'يلتزم مؤسسة النخيل بتنفيذ «عقد توريد خضار» من 2026-01-01 إلى 2026-11-15 بقيمة 2,400.000 د.ك.',
        '[{"code":"renewal","detailAr":"ينتهي العقد في 2026-11-15 خلال نافذة التنبيه (30 يوماً)."},{"code":"value","detailAr":"القيمة 2,400.000 د.ك تتجاوز ألفي دينار، فيلزم سقف زيادة سعرية مكتوب."}]'::jsonb,
        '[{"party":"company","textAr":"تسديد المستحق خلال 30 يوماً من فاتورة مطابقة للبند، من دون زيادة غير مكتوبة."},{"party":"counterparty","textAr":"مؤسسة النخيل يلتزم بالجودة والموعد، ويتحمّل تكلفة الاستبدال عند العيب."}]'::jsonb,
        'كل أسبوع تأخير في التنفيذ يخصم 1% من قيمة البند المتأخر، وبحد 10%، مع حق الإيقاف.',
        'لا تُجدَّد المدة تلقائياً. أضف سقف زيادة 5% وحق إنهاء خلال 15 يوماً إذا تكرر التأخير.',
        80, t.created_by
      );
    end if;

    insert into regulatory_circulars (tenant_id, authority_name, regulation_code, title_ar, target_department, ai_recommendation_ar, status, created_by)
    values
      (t.id, 'المرور والنقل', 'CIRC-KW-2026-01', 'منع إسناد التوصيل برخصة منتهية', 'الأسطول', 'لا يُسند طلب توصيل لسائق انتهت رخصته. الإيقاف فوري عند التعيين.', 'enforced', t.created_by)
    returning id into v_circ1;
    insert into regulatory_circulars (tenant_id, authority_name, regulation_code, title_ar, target_department, ai_recommendation_ar, status, created_by)
    values
      (t.id, 'القوى العاملة', 'CIRC-KW-2026-02', 'حد ساعات الوردية اليومية', 'الموارد البشرية', 'أوقف تسجيل الحضور إذا تجاوزت الوردية 8 ساعات.', 'enforced', t.created_by)
    returning id into v_circ2;
    insert into regulatory_circulars (tenant_id, authority_name, regulation_code, title_ar, target_department, ai_recommendation_ar, status, created_by)
    values
      (t.id, 'وزارة التجارة', 'CIRC-KW-2026-03', 'سقف المصروف النقدي', 'المالية', 'ارفض المصروف النقدي الذي يتجاوز 50.000 د.ك إلى أن يُعتمد استثناء.', 'enforced', t.created_by)
    returning id into v_circ3;
    insert into regulatory_circulars (tenant_id, authority_name, regulation_code, title_ar, target_department, ai_recommendation_ar, status, created_by)
    values
      (t.id, 'بلدية الكويت', 'CIRC-KW-2026-04', 'اشتراطات سلامة الغذاء في التحضير', 'العمليات', 'اربط فحص خط التحضير البارد بتذكرة جودة مفتوحة قبل بداية الوردية.', 'pending', t.created_by),
      (t.id, 'حماية المستهلك', 'CIRC-KW-2026-05', 'إعلان السعر للمستهلك', 'العمليات', 'اعرض سعر البيع بالدينار بجانب كل صنف قبل إغلاق الفاتورة.', 'pending', t.created_by);

    insert into compliance_enforcement_rules (tenant_id, circular_id, rule_code, rule_type, threshold_value, is_active, created_by)
    values
      (t.id, v_circ1, 'CIRC-KW-2026-01', 'expired_driver_license', 0, true, t.created_by),
      (t.id, v_circ2, 'CIRC-KW-2026-02', 'max_working_hours', 8, true, t.created_by),
      (t.id, v_circ3, 'CIRC-KW-2026-03', 'cash_ceiling_kwd', 50000, true, t.created_by);

    insert into ai_learning_memory (tenant_id, context_domain, manager_decision_pattern, recurring_issue_detected, learned_weight_adjustment, confidence_score, created_by)
    values
      (t.id, 'pricing', 'اعتماد سعر البيع عند فرق أقل من 0.500 د.ك', 'منافسون يخفضون رسوم التوصيل', 12, 64, t.created_by),
      (t.id, 'task_routing', 'توجيه فاتورة الوقود إلى عهد الموظف لا إلى قيد نقدي مباشر', 'تكرار فواتير المحطة في نهاية الأسبوع', 8, 58, t.created_by),
      (t.id, 'contracts', 'رفض التجديد التلقائي للعقود فوق 2,000.000 د.ك', 'اقتراب نهاية عقد التوريد', 15, 71, t.created_by),
      (t.id, 'compliance', 'تعميم الإيقاف فور اعتماد التعميم', 'محاولات تعيين برخصة منتهية', 20, 80, t.created_by);

    insert into smart_archive_documents (
      tenant_id, file_name, file_type, document_category, extracted_ocr_json, amount_minor, routed_to_module, status, created_by
    ) values
      (t.id, 'فاتورة-وقود-الوحدة.pdf', 'pdf', 'fuel_invoice', '{"amountMinor":18500,"counterparty":"محطة السرة","fileType":"pdf","route":"/erp/hr"}'::jsonb, 18500, '/erp/hr', 'routed', t.created_by),
      (t.id, 'عقد-توريد-خضار.pdf', 'pdf', 'contract', '{"amountMinor":2400000,"counterparty":"مؤسسة النخيل","fileType":"pdf","route":"/erp/contracts"}'::jsonb, 2400000, '/erp/contracts', 'routed', t.created_by),
      (t.id, 'ايصال-كي-نت.jpg', 'image', 'knet_receipt', '{"amountMinor":7250,"counterparty":"كي نت","fileType":"image","route":"/erp/finance"}'::jsonb, 7250, '/erp/finance', 'archived', t.created_by),
      (t.id, 'مخالفة-مرورية.pdf', 'pdf', 'traffic_fine', '{"amountMinor":15000,"counterparty":"الإدارة العامة للمرور","fileType":"pdf","route":"/erp/hr"}'::jsonb, 15000, '/erp/hr', 'routed', t.created_by),
      (t.id, 'بوليصة-شحن.pdf', 'pdf', 'delivery_waybill', '{"amountMinor":4500,"counterparty":"شركة النقل السريع","fileType":"pdf","route":"/erp/delivery"}'::jsonb, 4500, '/erp/delivery', 'routed', t.created_by);

    insert into employee_behavior_telemetry (
      tenant_id, user_name, role, active_path, action_sequence_json, dwell_time_seconds, anomaly_flag, risk_level, created_by
    ) values
      (t.id, 'فاطمة الكندري', 'owner', '/erp/hr', '["open","payroll"]'::jsonb, 90, false, 'low', t.created_by),
      (t.id, 'خالد المطيري', 'accountant', '/erp/finance', '["open","journal","blocked"]'::jsonb, 740, true, 'high', t.created_by),
      (t.id, 'سارة الهاجري', 'manager', '/erp/operations', '["open","quality"]'::jsonb, 210, false, 'medium', t.created_by);

    insert into competitive_intelligence_radar (
      tenant_id, competitor_name, market_segment, item_or_service, our_price_minor, competitor_price_minor,
      promo_detected_ar, ai_executive_insight_ar, recommended_counter_action_ar, created_by
    ) values
      (t.id, 'طلبات', 'توصيل', 'رسوم التوصيل', 1250, 900, 'توصيل مجاني فوق 5.000 د.ك',
        'سعرنا أعلى من طلبات على رسوم التوصيل بفارق 0.350 د.ك.',
        'قدّم عرضاً محدوداً بخفض 0.350 د.ك على رسوم التوصيل لأسبوع، ثم قِس حجم الطلب.', t.created_by),
      (t.id, 'مجمع سلطان', 'وجبات', 'وجبة غداء', 3500, 2750, 'خصم الغداء 15%',
        'سعرنا أعلى من مجمع سلطان على وجبة غداء بفارق 0.750 د.ك.',
        'قدّم عرضاً محدوداً بخفض 0.750 د.ك على وجبة غداء لأسبوع، ثم قِس حجم الطلب.', t.created_by),
      (t.id, 'كارفور', 'تموين', 'سلة خضار', 1800, 2100, 'لا يوجد عرض هذا الأسبوع',
        'سعرنا أقل من كارفور على سلة خضار بفارق 0.300 د.ك.',
        'ثبّت السعر الحالي لـ سلة خضار وركّز الرسالة على سرعة التوريد لا على خصم إضافي.', t.created_by);

    insert into compliance_blocked_attempts (
      tenant_id, rule_code, actor_name, module, attempted_action_ar, block_message_ar, created_by
    ) values (
      t.id, 'CIRC-KW-2026-01', 'خالد المطيري', 'delivery', 'تعيين طلب توصيل لسائق برخصة منتهية',
      'تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-01]', t.created_by
    ) returning id into v_block;

    insert into audit_activity_logs (
      tenant_id, actor_id, actor_name, actor_role, action_type, module, entity_type, entity_id, description_ar, metadata_json, created_at
    ) values (
      t.id, t.created_by, 'خالد المطيري', 'accountant', 'blocked', 'governance', 'compliance_block', v_block,
      'تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-01]', '{}'::jsonb, now()
    );
  end loop;
end;
$$;
