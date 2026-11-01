-- Residency hard-stop rule for the governance gatekeeper + HR expiry circular.

create or replace function erp_gov_residency_hard_stop_marker() returns text
language sql immutable as $$ select '0040_governance_residency_hard_stop'::text $$;

alter table compliance_enforcement_rules
  drop constraint if exists compliance_enforcement_rules_rule_type_check;

alter table compliance_enforcement_rules
  add constraint compliance_enforcement_rules_rule_type_check
  check (rule_type in ('expired_driver_license', 'max_working_hours', 'cash_ceiling_kwd', 'expired_residency'));

do $$
declare
  t record;
  v_circ uuid;
begin
  for t in select id, created_by from tenants loop
    if exists (
      select 1 from compliance_enforcement_rules
      where tenant_id = t.id and rule_code = 'CIRC-KW-2026-06'
    ) then
      continue;
    end if;

    insert into regulatory_circulars (
      tenant_id, authority_name, regulation_code, title_ar, target_department, ai_recommendation_ar, status, created_by
    ) values (
      t.id,
      'القوى العاملة',
      'CIRC-KW-2026-06',
      'إيقاف العمل عند انتهاء الإقامة أو البطاقة الصحية',
      'الموارد البشرية',
      'أوقف الحضور والتعيين إذا انتهت إقامة الموظف أو بطاقته الصحية. الإيقاف فوري من بوابة الحوكمة.',
      'enforced',
      t.created_by
    )
    returning id into v_circ;

    insert into compliance_enforcement_rules (
      tenant_id, circular_id, rule_code, rule_type, threshold_value, is_active, created_by
    ) values (
      t.id, v_circ, 'CIRC-KW-2026-06', 'expired_residency', 0, true, t.created_by
    );
  end loop;
end $$;

revoke execute on function erp_gov_residency_hard_stop_marker() from public, anon, authenticated;
