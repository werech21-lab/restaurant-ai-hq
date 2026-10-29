-- 0026_legal_admin_governance_iot_investigations
-- Government violation tracker, device registry, recorded discipline notes,
-- HQ appointments, fact-finding cases, and executive task dispatch.
--
-- 0024 is the HR suite, so this file is 0026.
-- Fines are whole fils. Device addresses are registry labels and are never opened.
-- A violation cannot reach closed_verified without an employee statement and a closure proof.

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
    'gov.telemetry.read', 'gov.telemetry.record', 'gov.radar.read', 'gov.radar.manage',
    'gov.violation.read', 'gov.violation.manage', 'gov.monitor.read', 'gov.monitor.manage',
    'gov.inquiry.read', 'gov.inquiry.manage', 'gov.task.read', 'gov.task.dispatch',
    'hr.appointment.read', 'hr.appointment.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

create table gov_violations_tracker (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  violation_number text not null check (char_length(violation_number) between 1 and 40),
  issuing_authority text not null check (issuing_authority in ('بلدية الكويت', 'القوى العاملة', 'التجارة', 'المرور', 'الإطفاء')),
  branch_id uuid,
  violation_type_ar text not null check (char_length(violation_type_ar) between 1 and 200),
  fine_amount_minor bigint not null check (fine_amount_minor >= 0 and fine_amount_minor <= 1000000000000),
  assigned_employee_id uuid,
  assigned_employee_name text not null check (char_length(assigned_employee_name) between 1 and 200),
  sla_deadline date not null,
  workflow_stage text not null default 'assigned' check (workflow_stage in (
    'assigned', 'statement_submitted', 'in_remediation', 'proof_uploaded', 'closed_verified', 'escalated_neglect'
  )),
  employee_statement_ar text,
  action_log_json jsonb not null default '[]'::jsonb,
  closure_proof_doc_url text,
  is_neglected_flag boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint gov_violations_tracker_tenant_id_key unique (tenant_id, id),
  constraint gov_violations_tracker_number_key unique (tenant_id, violation_number),
  constraint gov_violations_statement_len check (employee_statement_ar is null or char_length(employee_statement_ar) between 1 and 2000),
  constraint gov_violations_proof_len check (closure_proof_doc_url is null or char_length(closure_proof_doc_url) between 1 and 300),
  constraint gov_violations_close_requires_proof check (
    workflow_stage <> 'closed_verified'
    or (
      employee_statement_ar is not null
      and char_length(btrim(employee_statement_ar)) > 0
      and closure_proof_doc_url is not null
      and char_length(btrim(closure_proof_doc_url)) > 0
    )
  )
);

create table connected_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  device_type text not null check (device_type in ('biometric_terminal', 'ai_camera_cctv', 'work_phone_mdm')),
  device_name text not null check (char_length(device_name) between 1 and 120),
  branch_id uuid,
  ip_or_stream_url text not null check (char_length(ip_or_stream_url) between 1 and 200),
  status text not null check (status in ('online', 'offline')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint connected_devices_tenant_id_key unique (tenant_id, id)
);

create table iot_ai_monitoring_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  device_id uuid not null,
  branch_id uuid,
  employee_name text not null check (char_length(employee_name) between 1 and 200),
  violation_category text not null check (violation_category in (
    'uniform_violation', 'hygiene_gloves_mask', 'unauthorized_phone_use', 'workstation_abandonment', 'biometric_mismatch'
  )),
  ai_confidence_score integer not null check (ai_confidence_score between 0 and 100),
  snapshot_evidence_ref text not null check (char_length(snapshot_evidence_ref) between 1 and 200),
  auto_action_taken_ar text not null check (char_length(auto_action_taken_ar) between 1 and 500),
  status text not null default 'detected' check (status in ('detected', 'converted_to_investigation', 'penalized', 'dismissed')),
  detected_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint iot_ai_monitoring_events_tenant_id_key unique (tenant_id, id),
  constraint iot_ai_monitoring_events_device_fk foreign key (tenant_id, device_id) references connected_devices (tenant_id, id)
);

create table hr_service_requests_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  request_code text not null check (char_length(request_code) between 1 and 40),
  employee_name text not null check (char_length(employee_name) between 1 and 200),
  branch_id uuid,
  request_type text not null check (request_type in (
    'passport_handover', 'equipment_clearance', 'contract_signing', 'salary_certificate', 'residency_renewal'
  )),
  action_direction text not null check (action_direction in ('pickup_from_hq', 'deliver_to_hq')),
  appointment_date date not null,
  appointment_time_slot text not null check (appointment_time_slot in (
    '08:00-08:30', '09:00-09:30', '10:00-10:30', '11:00-11:30', '12:00-12:30', '13:00-13:30'
  )),
  hq_counter_or_officer text not null check (char_length(hq_counter_or_officer) between 1 and 120),
  status text not null default 'booked' check (status in ('booked', 'confirmed', 'completed_handover', 'missed_appointment')),
  notes_ar text not null default '' check (char_length(notes_ar) <= 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_service_requests_appointments_code_key unique (tenant_id, request_code),
  constraint hr_service_requests_branch_fk foreign key (tenant_id, branch_id) references branches (tenant_id, id)
);

create table legal_investigations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  case_number text not null check (char_length(case_number) between 1 and 40),
  source_type text not null check (source_type in ('gov_violation', 'ai_camera_violation', 'manager_referral', 'financial_discrepancy')),
  source_reference_id uuid,
  subject_employee_name text not null check (char_length(subject_employee_name) between 1 and 200),
  investigator_name text not null check (char_length(investigator_name) between 1 and 200),
  incident_summary_ar text not null check (char_length(incident_summary_ar) between 1 and 2000),
  questions_and_statements_json jsonb not null default '[]'::jsonb,
  evidence_files_json jsonb not null default '[]'::jsonb,
  legal_finding_ar text,
  recommended_disciplinary_action_ar text,
  manager_final_decision text,
  status text not null default 'open_summons' check (status in (
    'open_summons', 'hearing_in_progress', 'awaiting_manager_ruling', 'closed_enforced'
  )),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint legal_investigations_tenant_id_key unique (tenant_id, id),
  constraint legal_investigations_case_key unique (tenant_id, case_number),
  constraint legal_investigations_finding_len check (legal_finding_ar is null or char_length(legal_finding_ar) between 1 and 2000),
  constraint legal_investigations_decision_len check (manager_final_decision is null or char_length(manager_final_decision) between 1 and 500),
  constraint legal_investigations_action_check check (
    recommended_disciplinary_action_ar is null
    or recommended_disciplinary_action_ar in ('لفت نظر', 'إنذار كتابي', 'خصم راتب', 'إحالة للشؤون القانونية')
  ),
  constraint legal_investigations_ruling_check check (
    status <> 'closed_enforced'
    or (manager_final_decision is not null and char_length(btrim(manager_final_decision)) > 0)
  )
);

create table executive_alerts_and_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  alert_category text not null check (alert_category in ('employee_neglect', 'repeated_violation', 'operational_error', 'sla_breach')),
  severity text not null check (severity in ('critical', 'high', 'medium')),
  title_ar text not null check (char_length(title_ar) between 1 and 200),
  ai_recommendation_ar text not null check (char_length(ai_recommendation_ar) between 1 and 500),
  assigned_to_employee text,
  task_instruction_ar text not null check (char_length(task_instruction_ar) between 1 and 500),
  due_date date,
  employee_completion_report_ar text,
  status text not null default 'alert_pending' check (status in ('alert_pending', 'task_dispatched', 'in_progress', 'completed_verified')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint executive_alerts_and_tasks_tenant_id_key unique (tenant_id, id),
  constraint executive_tasks_report_len check (employee_completion_report_ar is null or char_length(employee_completion_report_ar) between 1 and 2000),
  constraint executive_tasks_assignee_len check (assigned_to_employee is null or char_length(assigned_to_employee) between 1 and 200),
  constraint executive_tasks_dispatch_check check (
    status = 'alert_pending'
    or (assigned_to_employee is not null and due_date is not null)
  ),
  constraint executive_tasks_completion_check check (
    status <> 'completed_verified'
    or (employee_completion_report_ar is not null and char_length(btrim(employee_completion_report_ar)) > 0)
  )
);

create index gov_violations_tracker_tenant_idx on gov_violations_tracker (tenant_id, sla_deadline);
create index connected_devices_tenant_idx on connected_devices (tenant_id, device_name);
create index iot_ai_monitoring_events_tenant_idx on iot_ai_monitoring_events (tenant_id, detected_at desc);
create index hr_service_requests_appointments_tenant_idx on hr_service_requests_appointments (tenant_id, appointment_date, appointment_time_slot);
create index legal_investigations_tenant_idx on legal_investigations (tenant_id, created_at desc);
create index executive_alerts_and_tasks_tenant_idx on executive_alerts_and_tasks (tenant_id, created_at desc);

create trigger gov_violations_tracker_updated_at before update on gov_violations_tracker for each row execute function set_updated_at();
create trigger connected_devices_updated_at before update on connected_devices for each row execute function set_updated_at();
create trigger iot_ai_monitoring_events_updated_at before update on iot_ai_monitoring_events for each row execute function set_updated_at();
create trigger hr_service_requests_appointments_updated_at before update on hr_service_requests_appointments for each row execute function set_updated_at();
create trigger legal_investigations_updated_at before update on legal_investigations for each row execute function set_updated_at();
create trigger executive_alerts_and_tasks_updated_at before update on executive_alerts_and_tasks for each row execute function set_updated_at();

alter table gov_violations_tracker enable row level security;
alter table connected_devices enable row level security;
alter table iot_ai_monitoring_events enable row level security;
alter table hr_service_requests_appointments enable row level security;
alter table legal_investigations enable row level security;
alter table executive_alerts_and_tasks enable row level security;

revoke all on gov_violations_tracker, connected_devices, iot_ai_monitoring_events, hr_service_requests_appointments,
  legal_investigations, executive_alerts_and_tasks from anon, authenticated;
grant select on gov_violations_tracker, connected_devices, iot_ai_monitoring_events, hr_service_requests_appointments,
  legal_investigations, executive_alerts_and_tasks to authenticated;

create policy gov_violations_tracker_select on gov_violations_tracker for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.violation.read'));
create policy connected_devices_select on connected_devices for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.monitor.read'));
create policy iot_ai_monitoring_events_select on iot_ai_monitoring_events for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.monitor.read'));
create policy hr_service_requests_appointments_select on hr_service_requests_appointments for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.appointment.read'));
create policy legal_investigations_select on legal_investigations for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.inquiry.read'));
create policy executive_alerts_and_tasks_select on executive_alerts_and_tasks for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.task.read'));

do $$
declare
  t record;
  v_branch uuid;
  v_emp uuid;
  v_name text;
  v_late uuid;
  v_cam uuid;
  v_phone uuid;
  v_bio uuid;
begin
  for t in select id, created_by from tenants loop
    if exists (select 1 from gov_violations_tracker where tenant_id = t.id) then
      continue;
    end if;

    select id into v_branch from branches where tenant_id = t.id order by created_at limit 1;
    select id, full_name into v_emp, v_name from hr_employees where tenant_id = t.id and status = 'active' order by employee_code limit 1;
    if v_name is null then
      v_name := 'فهد العازمي';
    end if;

    insert into gov_violations_tracker (
      tenant_id, violation_number, issuing_authority, branch_id, violation_type_ar, fine_amount_minor,
      assigned_employee_id, assigned_employee_name, sla_deadline, workflow_stage, action_log_json, created_by
    ) values (
      t.id, 'KW-MUN-2026-0142', 'بلدية الكويت', v_branch, 'لوحة إعلانية دون ترخيص على واجهة الفرع', 150000,
      v_emp, v_name, current_date + 3, 'assigned', '[]'::jsonb, t.created_by
    );

    insert into gov_violations_tracker (
      tenant_id, violation_number, issuing_authority, branch_id, violation_type_ar, fine_amount_minor,
      assigned_employee_name, sla_deadline, workflow_stage, employee_statement_ar, action_log_json, is_neglected_flag, created_by
    ) values (
      t.id, 'KW-LAB-2026-0088', 'القوى العاملة', v_branch, 'تجاوز ساعات العمل اليومية المعتمدة', 75000,
      'نورة القحطاني', current_date - 1, 'escalated_neglect',
      'أفيد بأن الوردية امتدت بسبب نقص المناوب، وأطلب اعتماد بديل قبل نهاية الأسبوع.',
      '[{"at":"2026-10-28T08:00:00.000Z","action":"statement","noteAr":"قُدّمت الإفادة وتجاوزت المهلة"}]'::jsonb,
      true, t.created_by
    ) returning id into v_late;

    insert into gov_violations_tracker (
      tenant_id, violation_number, issuing_authority, branch_id, violation_type_ar, fine_amount_minor,
      assigned_employee_name, sla_deadline, workflow_stage, employee_statement_ar, closure_proof_doc_url, action_log_json, created_by
    ) values (
      t.id, 'KW-TRD-2026-0019', 'التجارة', v_branch, 'عرض سعر دون بيان الوحدة', 25000,
      'يوسف الشمري', current_date + 5, 'proof_uploaded',
      'تم تصحيح بطاقة السعر وإعادة طباعة البيان على الرف.',
      'archive:kw-commerce-receipt-0019',
      '[{"at":"2026-10-27T09:00:00.000Z","action":"proof","noteAr":"رُفع إيصال التصحيح"}]'::jsonb,
      t.created_by
    );

    insert into gov_violations_tracker (
      tenant_id, violation_number, issuing_authority, branch_id, violation_type_ar, fine_amount_minor,
      assigned_employee_name, sla_deadline, workflow_stage, employee_statement_ar, closure_proof_doc_url, action_log_json, created_by
    ) values (
      t.id, 'KW-FIRE-2026-0003', 'الإطفاء', v_branch, 'طفاية منتهية في ممر المطبخ', 40000,
      'مشاعل الهاجري', current_date - 10, 'closed_verified',
      'استُبدلت الطفاية وسُلّم محضر الفحص.',
      'archive:kw-fire-certificate-0003',
      '[{"at":"2026-10-18T11:00:00.000Z","action":"close","noteAr":"أُغلق المحضر بعد الإثبات"}]'::jsonb,
      t.created_by
    );

    insert into gov_violations_tracker (
      tenant_id, violation_number, issuing_authority, branch_id, violation_type_ar, fine_amount_minor,
      assigned_employee_name, sla_deadline, workflow_stage, employee_statement_ar, action_log_json, created_by
    ) values (
      t.id, 'KW-TRF-2026-0221', 'المرور', v_branch, 'وقوف مركبة التوريد في مسار غير مخصص', 20000,
      'خالد المطيري', current_date + 2, 'in_remediation',
      'تم نقل نقطة التوريد إلى الموقف الخلفي.',
      '[{"at":"2026-10-28T07:30:00.000Z","action":"remediate","noteAr":"بدأت المعالجة"}]'::jsonb,
      t.created_by
    );

    insert into connected_devices (tenant_id, device_type, device_name, branch_id, ip_or_stream_url, status, created_by)
    values (t.id, 'biometric_terminal', 'بصمة بوابة السالمية', v_branch, 'registry:salmiya-bio-1', 'online', t.created_by)
    returning id into v_bio;
    insert into connected_devices (tenant_id, device_type, device_name, branch_id, ip_or_stream_url, status, created_by)
    values (t.id, 'ai_camera_cctv', 'سجل كاميرا المطبخ', v_branch, 'registry:kitchen-cam-2', 'online', t.created_by)
    returning id into v_cam;
    insert into connected_devices (tenant_id, device_type, device_name, branch_id, ip_or_stream_url, status, created_by)
    values (t.id, 'work_phone_mdm', 'هاتف مشرف الفرع', v_branch, 'registry:supervisor-phone-1', 'offline', t.created_by)
    returning id into v_phone;

    insert into iot_ai_monitoring_events (
      tenant_id, device_id, branch_id, employee_name, violation_category, ai_confidence_score,
      snapshot_evidence_ref, auto_action_taken_ar, status, created_by
    ) values
      (t.id, v_cam, v_branch, 'فاطمة العتيبي', 'uniform_violation', 91, 'archive:uniform-salmiya-01', 'ملاحظة مشرف: الزي بلا شارة الاسم. بانتظار المراجعة البشرية.', 'detected', t.created_by),
      (t.id, v_cam, v_branch, 'سارة الكندري', 'hygiene_gloves_mask', 88, 'archive:gloves-kitchen-02', 'ملاحظة مشرف: القفازات غير ظاهرة أثناء التجهيز.', 'detected', t.created_by),
      (t.id, v_phone, v_branch, 'يوسف الشمري', 'unauthorized_phone_use', 76, 'archive:phone-counter-03', 'سُجّل استخدام الهاتف على الكاشير وأُحيل للمشرف.', 'penalized', t.created_by),
      (t.id, v_bio, v_branch, 'خالد المطيري', 'biometric_mismatch', 64, 'archive:bio-mismatch-04', 'نُوقشت بصمة الدخول مع الموظف وأُغلقت كملاحظة دون جزاء.', 'dismissed', t.created_by),
      (t.id, v_cam, v_branch, 'نورة القحطاني', 'workstation_abandonment', 83, 'archive:station-leave-05', 'تُرك خط التحضير دون تغطية لعشر دقائق.', 'detected', t.created_by);

    insert into legal_investigations (
      tenant_id, case_number, source_type, source_reference_id, subject_employee_name, investigator_name,
      incident_summary_ar, questions_and_statements_json, evidence_files_json, status, created_by
    ) values (
      t.id, 'INV-2026-014', 'gov_violation', v_late, 'نورة القحطاني', 'لجنة التقصي الداخلية',
      'مخالفة قوى عاملة تجاوزت مهلة المعالجة وما زالت الإفادة دون إثبات إغلاق.',
      '[{"questionAr":"لماذا امتدت الوردية؟","answerAr":"لنقص المناوب في فرع السالمية."}]'::jsonb,
      '["archive:shift-roster-088"]'::jsonb,
      'hearing_in_progress', t.created_by
    );

    insert into legal_investigations (
      tenant_id, case_number, source_type, subject_employee_name, investigator_name,
      incident_summary_ar, status, created_by
    ) values (
      t.id, 'INV-2026-015', 'manager_referral', 'يوسف الشمري', 'أحمد الرشيد',
      'إحالة من مدير الفرع بخصوص تكرار استخدام الهاتف أثناء الخدمة.',
      'open_summons', t.created_by
    );

    insert into executive_alerts_and_tasks (
      tenant_id, alert_category, severity, title_ar, ai_recommendation_ar, task_instruction_ar, status, created_by
    ) values (
      t.id, 'employee_neglect', 'critical', 'إهمال محضر القوى العاملة KW-LAB-2026-0088',
      'كلّف المشرف بإنهاء المحضر ورفع الإثبات قبل نهاية المهلة، ثم أغلق التنبيه بعد التحقق.',
      'بانتظار تكليف المدير للموظف المسؤول عن رفع الإثبات.',
      'alert_pending', t.created_by
    );

    insert into executive_alerts_and_tasks (
      tenant_id, alert_category, severity, title_ar, ai_recommendation_ar, assigned_to_employee,
      task_instruction_ar, due_date, status, created_by
    ) values (
      t.id, 'repeated_violation', 'high', 'تكرار ملاحظات الهاتف على الكاشير',
      'افتح محضر تقصي وقارن التكرار خلال 90 يوماً قبل أي خصم.',
      'يوسف الشمري', 'قدّم بيان المناوبات التي سُجّل فيها الهاتف خلال تسعين يوماً.', current_date + 4, 'task_dispatched', t.created_by
    );

    insert into executive_alerts_and_tasks (
      tenant_id, alert_category, severity, title_ar, ai_recommendation_ar, assigned_to_employee,
      task_instruction_ar, due_date, employee_completion_report_ar, status, created_by
    ) values (
      t.id, 'sla_breach', 'medium', 'أُغلق محضر الإطفاء بعد تجاوز مهلة سابقة',
      'ارفع المخالفة المتجاوزة للمدير العام مع بيان سبب التأخير.',
      'مشاعل الهاجري', 'أرفق شهادة الاستبدال في الأرشيف.', current_date - 10,
      'رُفعت الشهادة وأُغلق المحضر KW-FIRE-2026-0003.', 'completed_verified', t.created_by
    );

    insert into hr_service_requests_appointments (
      tenant_id, request_code, employee_name, branch_id, request_type, action_direction,
      appointment_date, appointment_time_slot, hq_counter_or_officer, status, notes_ar, created_by
    ) values
      (t.id, 'HQ-2026-1101', v_name, v_branch, 'passport_handover', 'pickup_from_hq', current_date + 1, '10:00-10:30', 'شباك الوثائق - منى', 'booked', 'استلام جواز بعد التجديد.', t.created_by),
      (t.id, 'HQ-2026-1102', 'سارة الكندري', v_branch, 'equipment_clearance', 'deliver_to_hq', current_date + 1, '11:00-11:30', 'أمين العهد - بدر', 'confirmed', 'تسليم جهاز جرد الفرع.', t.created_by),
      (t.id, 'HQ-2026-1103', 'يوسف الشمري', v_branch, 'contract_signing', 'deliver_to_hq', current_date, '09:00-09:30', 'الشؤون القانونية - ليلى', 'completed_handover', 'وُقّع ملحق الراتب.', t.created_by),
      (t.id, 'HQ-2026-1104', 'نورة القحطاني', v_branch, 'salary_certificate', 'pickup_from_hq', current_date - 1, '12:00-12:30', 'شباك الرواتب - هند', 'missed_appointment', 'لم تحضر في الفترة المحجوزة.', t.created_by),
      (t.id, 'HQ-2026-1105', 'مشاعل الهاجري', v_branch, 'residency_renewal', 'pickup_from_hq', current_date + 2, '13:00-13:30', 'شباك الإقامة - فهد', 'booked', 'استلام إيصال الإقامة.', t.created_by);
  end loop;
end;
$$;
