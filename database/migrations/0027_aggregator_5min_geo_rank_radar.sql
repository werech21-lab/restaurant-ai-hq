-- 0027_aggregator_5min_geo_rank_radar
-- Five-minute aggregator rank observations for Talabat, Keeta, Jahez, Snoonu, and Deliveroo.
--
-- 0025 is the compliance suite and 0026 is the administrative desk, so this file is 0027.
-- Fees and revenue are whole fils. Ratings and conversion are integer basis points.
-- Rows are entered observations. Nothing in this migration contacts an external platform.

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
    'hr.appointment.read', 'hr.appointment.manage',
    'gov.aggregator.read', 'gov.aggregator.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

create table aggregator_geo_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  snapshot_interval_time timestamptz not null,
  platform_name text not null check (platform_name in ('Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo')),
  geo_zone_ar text not null check (geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء')),
  our_brand_name text not null check (char_length(our_brand_name) between 1 and 120),
  our_branch_name text not null check (char_length(our_branch_name) between 1 and 120),
  current_rank integer not null check (current_rank between 1 and 50),
  previous_rank_5m_ago integer not null check (previous_rank_5m_ago between 1 and 50),
  rank_delta integer not null check (rank_delta between -50 and 50),
  overall_rating_bps integer not null check (overall_rating_bps between 0 and 500),
  reviews_count integer not null check (reviews_count between 0 and 10000000),
  estimated_visits_impressions integer not null check (estimated_visits_impressions between 0 and 100000000),
  conversion_rate_bps integer not null check (conversion_rate_bps between 0 and 10000),
  delivery_eta_minutes integer not null check (delivery_eta_minutes between 1 and 180),
  delivery_fee_minor bigint not null check (delivery_fee_minor >= 0 and delivery_fee_minor <= 100000000),
  min_order_minor bigint not null check (min_order_minor >= 0 and min_order_minor <= 100000000),
  logistics_mode text not null check (logistics_mode in ('platform_fleet', 'vendor_own_fleet')),
  is_sponsored_ad_active boolean not null default false,
  recorded_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint aggregator_geo_rank_snapshots_tenant_id_key unique (tenant_id, id),
  constraint aggregator_geo_rank_snapshots_bucket_key unique (tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_branch_name),
  constraint aggregator_geo_rank_delta_check check (rank_delta = previous_rank_5m_ago - current_rank)
);

create table aggregator_top_competitors_bench (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  snapshot_id uuid not null,
  platform_name text not null check (platform_name in ('Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo')),
  geo_zone_ar text not null check (geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء')),
  competitor_rank integer not null check (competitor_rank in (1, 2, 3)),
  competitor_brand_name text not null check (char_length(competitor_brand_name) between 1 and 120),
  competitor_rating_bps integer not null check (competitor_rating_bps between 0 and 500),
  competitor_reviews_count integer not null check (competitor_reviews_count between 0 and 10000000),
  competitor_visits_estimate integer not null check (competitor_visits_estimate between 0 and 100000000),
  competitor_eta_minutes integer not null check (competitor_eta_minutes between 1 and 180),
  competitor_delivery_fee_minor bigint not null check (competitor_delivery_fee_minor >= 0 and competitor_delivery_fee_minor <= 100000000),
  competitor_logistics_mode text not null check (competitor_logistics_mode in ('platform_fleet', 'vendor_own_fleet')),
  active_promo_badge_ar text not null check (char_length(active_promo_badge_ar) between 1 and 120),
  detected_rating_boost_policy_ar text not null check (char_length(detected_rating_boost_policy_ar) between 1 and 400),
  gap_vs_our_brand_json jsonb not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint aggregator_top_competitors_tenant_id_key unique (tenant_id, id),
  constraint aggregator_top_competitors_rank_key unique (tenant_id, snapshot_id, competitor_rank),
  constraint aggregator_top_competitors_snapshot_fk foreign key (tenant_id, snapshot_id) references aggregator_geo_rank_snapshots (tenant_id, id),
  constraint aggregator_top_competitors_gap_object check (jsonb_typeof(gap_vs_our_brand_json) = 'object')
);

create table aggregator_rank_escalation_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  platform_name text not null check (platform_name in ('Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo')),
  geo_zone_ar text not null check (geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء')),
  our_branch_name text not null check (char_length(our_branch_name) between 1 and 120),
  current_rank integer not null check (current_rank between 1 and 50),
  target_rank integer not null check (target_rank between 1 and 50),
  root_cause_of_lower_rank_ar text not null check (char_length(root_cause_of_lower_rank_ar) between 1 and 500),
  algorithmic_recommendation_ar text not null check (char_length(algorithmic_recommendation_ar) between 1 and 800),
  recommended_action_type text not null check (recommended_action_type in (
    'switch_fleet_mode', 'subsidize_delivery_fee', 'reduce_prep_eta', 'activate_rating_booster', 'bid_sponsored_slot'
  )),
  estimated_rank_jump integer not null check (estimated_rank_jump between 0 and 50),
  estimated_revenue_uplift_minor bigint not null check (estimated_revenue_uplift_minor >= 0 and estimated_revenue_uplift_minor <= 1000000000000),
  status text not null default 'pending' check (status in ('pending', 'approved_executing', 'completed')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint aggregator_rank_escalation_tenant_id_key unique (tenant_id, id),
  constraint aggregator_rank_escalation_target_check check (target_rank <= current_rank)
);

create unique index aggregator_rank_escalation_open_key
  on aggregator_rank_escalation_actions (tenant_id, platform_name, geo_zone_ar, our_branch_name)
  where status in ('pending', 'approved_executing');

create index aggregator_geo_rank_snapshots_tenant_idx on aggregator_geo_rank_snapshots (tenant_id, snapshot_interval_time desc);
create index aggregator_top_competitors_tenant_idx on aggregator_top_competitors_bench (tenant_id, snapshot_id);
create index aggregator_rank_escalation_tenant_idx on aggregator_rank_escalation_actions (tenant_id, created_at desc);

create trigger aggregator_geo_rank_snapshots_updated_at before update on aggregator_geo_rank_snapshots for each row execute function set_updated_at();
create trigger aggregator_top_competitors_updated_at before update on aggregator_top_competitors_bench for each row execute function set_updated_at();
create trigger aggregator_rank_escalation_updated_at before update on aggregator_rank_escalation_actions for each row execute function set_updated_at();

alter table aggregator_geo_rank_snapshots enable row level security;
alter table aggregator_top_competitors_bench enable row level security;
alter table aggregator_rank_escalation_actions enable row level security;

revoke all on aggregator_geo_rank_snapshots, aggregator_top_competitors_bench, aggregator_rank_escalation_actions from anon, authenticated;
grant select on aggregator_geo_rank_snapshots, aggregator_top_competitors_bench, aggregator_rank_escalation_actions to authenticated;

create policy aggregator_geo_rank_snapshots_select on aggregator_geo_rank_snapshots for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.aggregator.read'));
create policy aggregator_top_competitors_select on aggregator_top_competitors_bench for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.aggregator.read'));
create policy aggregator_rank_escalation_select on aggregator_rank_escalation_actions for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.aggregator.read'));

do $$
declare
  t record;
  platforms text[] := array['Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo'];
  zones text[] := array['السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء'];
  rivals text[] := array['فريش برجر', 'مشاوي الديوان', 'بيت البيتزا', 'سوشي الخليج'];
  p int;
  z int;
  comp int;
  bucket timestamptz;
  previous_bucket timestamptz;
  rank_now int;
  rank_prev int;
  fleet text;
  eta int;
  fee int;
  rating int;
  sid uuid;
  comp_eta int;
  comp_fee int;
  comp_rating int;
  comp_fleet text;
  comp_name text;
begin
  bucket := date_trunc('hour', now()) + (floor(extract(minute from now()) / 5)::int * interval '5 minutes');
  previous_bucket := bucket - interval '5 minutes';
  for t in select id, created_by from tenants loop
    if exists (select 1 from aggregator_geo_rank_snapshots where tenant_id = t.id) then
      continue;
    end if;
    for p in 1..5 loop
      for z in 1..6 loop
        if platforms[p] = 'Keeta' and zones[z] = 'السالمية' then
          rank_now := 8;
          rank_prev := 9;
          fleet := 'vendor_own_fleet';
          eta := 28;
          fee := 750;
          rating := 420;
        elsif platforms[p] = 'Jahez' and zones[z] = 'حولي' then
          rank_now := 6;
          rank_prev := 5;
          fleet := 'platform_fleet';
          eta := 24;
          fee := 500;
          rating := 430;
        elsif platforms[p] = 'Deliveroo' and zones[z] = 'الجهراء' then
          rank_now := 5;
          rank_prev := 7;
          fleet := 'vendor_own_fleet';
          eta := 30;
          fee := 250;
          rating := 410;
        else
          rank_now := 1 + ((p * 2 + z) % 9);
          rank_prev := rank_now + ((p + z) % 3) - 1;
          if rank_prev < 1 then rank_prev := 1; end if;
          if rank_prev > 12 then rank_prev := 12; end if;
          fleet := case when (p + z) % 2 = 0 then 'platform_fleet' else 'vendor_own_fleet' end;
          eta := 18 + ((p + z) % 12);
          fee := ((p + z) % 5) * 250;
          rating := 400 + ((p * 7 + z) % 80);
        end if;

        insert into aggregator_geo_rank_snapshots (
          tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
          current_rank, previous_rank_5m_ago, rank_delta, overall_rating_bps, reviews_count,
          estimated_visits_impressions, conversion_rate_bps, delivery_eta_minutes, delivery_fee_minor,
          min_order_minor, logistics_mode, is_sponsored_ad_active, recorded_at, created_by
        ) values (
          t.id, previous_bucket, platforms[p], zones[z], 'مجموعة أثير', 'أثير ' || zones[z],
          rank_prev, rank_prev, 0, rating, 700 + rank_prev * 15, 2500 + rank_prev * 80, 800,
          eta + 1, fee, 3000, fleet, false, previous_bucket, t.created_by
        );

        insert into aggregator_geo_rank_snapshots (
          tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
          current_rank, previous_rank_5m_ago, rank_delta, overall_rating_bps, reviews_count,
          estimated_visits_impressions, conversion_rate_bps, delivery_eta_minutes, delivery_fee_minor,
          min_order_minor, logistics_mode, is_sponsored_ad_active, recorded_at, created_by
        ) values (
          t.id, bucket, platforms[p], zones[z], 'مجموعة أثير', 'أثير ' || zones[z],
          rank_now, rank_prev, rank_prev - rank_now, rating, 860 + (12 - rank_now) * 20,
          3200 + (12 - rank_now) * 180, 850, eta, fee, 3000, fleet, (p + z) % 4 = 0, bucket, t.created_by
        ) returning id into sid;

        if platforms[p] = 'Keeta' and zones[z] = 'السالمية' then
          insert into aggregator_top_competitors_bench (
            tenant_id, snapshot_id, platform_name, geo_zone_ar, competitor_rank, competitor_brand_name,
            competitor_rating_bps, competitor_reviews_count, competitor_visits_estimate, competitor_eta_minutes,
            competitor_delivery_fee_minor, competitor_logistics_mode, active_promo_badge_ar,
            detected_rating_boost_policy_ar, gap_vs_our_brand_json, created_by
          ) values
            (t.id, sid, 'Keeta', 'السالمية', 1, 'فريش برجر', 470, 2100, 9000, 22, 0, 'platform_fleet', 'توصيل مجاني',
             'أسطول التطبيق مع وقت تحضير أقل من 12 دقيقة ورسوم صفر فوق حد الطلب.',
             jsonb_build_object('rankGap', 7, 'etaGapMinutes', 6, 'feeGapMinor', 750, 'ratingGapBps', 50), t.created_by),
            (t.id, sid, 'Keeta', 'السالمية', 2, 'مشاوي الديوان', 455, 1600, 7000, 24, 250, 'platform_fleet', 'خصم رسوم التوصيل',
             'أولوية أسطول التطبيق وبطاقة تقييم داخل المغلف بعد كل طلب.',
             jsonb_build_object('rankGap', 6, 'etaGapMinutes', 4, 'feeGapMinor', 500, 'ratingGapBps', 35), t.created_by),
            (t.id, sid, 'Keeta', 'السالمية', 3, 'بيت البيتزا', 440, 1200, 5000, 26, 350, 'vendor_own_fleet', 'عرض وجبة',
             'توصيل الأسطول الخاص مع طلب تقييم فور التسليم.',
             jsonb_build_object('rankGap', 5, 'etaGapMinutes', 2, 'feeGapMinor', 400, 'ratingGapBps', 20), t.created_by);
        else
          for comp in 1..3 loop
            comp_eta := greatest(12, eta - (4 - comp) * 2);
            comp_fee := greatest(0, fee - (4 - comp) * 250);
            comp_rating := least(500, rating + (4 - comp) * 10);
            comp_fleet := case when comp = 1 then 'platform_fleet' else fleet end;
            comp_name := rivals[((comp + p - 1) % 4) + 1];
            insert into aggregator_top_competitors_bench (
              tenant_id, snapshot_id, platform_name, geo_zone_ar, competitor_rank, competitor_brand_name,
              competitor_rating_bps, competitor_reviews_count, competitor_visits_estimate, competitor_eta_minutes,
              competitor_delivery_fee_minor, competitor_logistics_mode, active_promo_badge_ar,
              detected_rating_boost_policy_ar, gap_vs_our_brand_json, created_by
            ) values (
              t.id, sid, platforms[p], zones[z], comp, comp_name, comp_rating, 500 * (4 - comp), 2000 * (4 - comp),
              comp_eta, comp_fee, comp_fleet,
              case when comp_fee = 0 then 'توصيل مجاني' else 'خصم على رسوم التوصيل' end,
              case when comp_fleet = 'platform_fleet'
                then 'أولوية أسطول التطبيق مع وقت تحضير قصير ورسوم منخفضة.'
                else 'توصيل الأسطول الخاص مع بطاقة تقييم داخل المغلف.' end,
              jsonb_build_object(
                'rankGap', rank_now - comp,
                'etaGapMinutes', eta - comp_eta,
                'feeGapMinor', fee - comp_fee,
                'ratingGapBps', comp_rating - rating
              ),
              t.created_by
            );
          end loop;
        end if;

        if rank_now > 3 and not (platforms[p] = 'Keeta' and zones[z] = 'السالمية') then
          insert into aggregator_rank_escalation_actions (
            tenant_id, platform_name, geo_zone_ar, our_branch_name, current_rank, target_rank,
            root_cause_of_lower_rank_ar, algorithmic_recommendation_ar, recommended_action_type,
            estimated_rank_jump, estimated_revenue_uplift_minor, status, created_by
          ) values (
            t.id, platforms[p], zones[z], 'أثير ' || zones[z], rank_now, rank_now - 1,
            'الترتيب أدنى من المراكز الثلاثة الأولى في هذه الفترة.',
            'راجع رسوم التوصيل ووقت التحضير ثم اعتمد التصعيد بعد مقارنة الفجوة.',
            case when fleet = 'vendor_own_fleet' then 'switch_fleet_mode' else 'reduce_prep_eta' end,
            1, 25000, 'pending', t.created_by
          );
        end if;
      end loop;
    end loop;

    insert into aggregator_rank_escalation_actions (
      tenant_id, platform_name, geo_zone_ar, our_branch_name, current_rank, target_rank,
      root_cause_of_lower_rank_ar, algorithmic_recommendation_ar, recommended_action_type,
      estimated_rank_jump, estimated_revenue_uplift_minor, status, created_by
    ) values (
      t.id, 'Keeta', 'السالمية', 'أثير السالمية', 8, 2,
      'الترتيب متأخر لأن التوصيل على أسطول الشركة ووقت التحضير أطول من المتصدر بـ 6 دقائق.',
      'تحويل التوصيل في منطقة السالمية على كيتا من أسطول الشركة إلى أسطول التطبيق وتخفيض وقت التحضير 6 دقائق سيرفع ترتيبك من #8 إلى #2 ويزيد المبيعات بـ 450.000 د.ك',
      'switch_fleet_mode', 6, 450000, 'pending', t.created_by
    );

    update aggregator_rank_escalation_actions
      set status = 'approved_executing'
      where tenant_id = t.id and platform_name = 'Jahez' and geo_zone_ar = 'حولي';
    update aggregator_rank_escalation_actions
      set status = 'completed'
      where tenant_id = t.id and platform_name = 'Deliveroo' and geo_zone_ar = 'الجهراء';
  end loop;
end;
$$;
