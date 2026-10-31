-- Venture Foods Kuwait brand portfolio for the five-minute rank radar.
-- 0028 is the rank-rescue migration and stays as it was applied. This file is 0029.
-- Fees stay in fils and rates in basis points. Rows are entered observations.
-- Nothing here contacts Talabat, Snoonu, Keeta, Jahez, or Deliveroo.
-- Existing أثير rows, including the Keeta / السالمية escalation, are not updated.

update tenants
set name = 'فنتشر فودز الكويت', version = version + 1
where slug = 'aether-demo' and name <> 'فنتشر فودز الكويت';

do $$
declare
  r record;
  def text;
begin
  for r in
    select c.oid, c.conname, cl.relname
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
      and cl.relname in ('aggregator_geo_rank_snapshots', 'aggregator_top_competitors_bench', 'aggregator_rank_escalation_actions')
      and c.contype = 'c'
  loop
    def := pg_get_constraintdef(r.oid);
    if (def like '%geo_zone_ar%' and def like '%الجهراء%' and def not like '%العارضية%')
       or (def like '%previous_rank_5m_ago%' and def like '%50%' and def not like '%60%')
       or (def like '%current_rank%' and def like '%50%' and def not like '%39%' and def not like '%target_rank%')
       or (def like '%target_rank between 1 and 50%')
       or (def like '%target_rank%' and def like '%<= 50%' and def not like '%current_rank%')
       or (def like '%rank_delta%' and def like '%-50%')
    then
      execute format('alter table %I drop constraint %I', r.relname, r.conname);
    end if;
  end loop;
end $$;

alter table aggregator_geo_rank_snapshots
  add constraint aggregator_geo_rank_zone_check check (geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء', 'العارضية')),
  add constraint aggregator_geo_rank_current_check check (current_rank between 1 and 60),
  add constraint aggregator_geo_rank_previous_check check (previous_rank_5m_ago between 1 and 60),
  add constraint aggregator_geo_rank_delta_span_check check (rank_delta between -60 and 60);

alter table aggregator_top_competitors_bench
  add constraint aggregator_competitors_zone_check check (geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء', 'العارضية'));

alter table aggregator_rank_escalation_actions
  add constraint aggregator_escalation_zone_check check (geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء', 'العارضية')),
  add constraint aggregator_escalation_current_check check (current_rank between 1 and 60),
  add constraint aggregator_escalation_target_span_check check (target_rank between 1 and 60);

alter table aggregator_rank_escalation_actions
  add column our_brand_name text not null default '';

update aggregator_rank_escalation_actions
set our_brand_name = 'مجموعة أثير'
where our_brand_name = '' and our_branch_name like 'أثير%';

alter table aggregator_rank_escalation_actions
  add constraint aggregator_escalation_brand_check check (char_length(our_brand_name) <= 120);

create table venture_brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  code text not null check (code in ('FARM-BROWN', 'KARAK-CAFETERIA', 'CHINA-GARDEN', 'THE-NOODLE-BAR', 'FRANKS-STEAK', 'SHAWARMA-TAHINA')),
  name_en text not null check (char_length(name_en) between 1 and 120),
  name_ar text not null check (char_length(name_ar) between 1 and 120),
  cuisine_category_ar text not null check (char_length(cuisine_category_ar) between 1 and 160),
  active_branches_count integer not null check (active_branches_count between 0 and 1000),
  sort_order integer not null check (sort_order between 1 and 6),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint venture_brands_tenant_id_key unique (tenant_id, id),
  constraint venture_brands_tenant_code_key unique (tenant_id, code)
);

create index venture_brands_tenant_idx on venture_brands (tenant_id, sort_order);
create trigger venture_brands_updated_at before update on venture_brands for each row execute function set_updated_at();

alter table venture_brands enable row level security;
revoke all on venture_brands from anon, authenticated;
grant select on venture_brands to authenticated;
create policy venture_brands_select on venture_brands for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'gov.aggregator.read'));

create function erp_venture_foods_brands_marker() returns text
language sql immutable as $$ select 'venture_brands'::text $$;
revoke all on function erp_venture_foods_brands_marker() from public, anon, authenticated;

do $$
declare
  t record;
  platforms text[] := array['Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo'];
  zones text[] := array['السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء', 'العارضية'];
  codes text[] := array['FARM-BROWN', 'KARAK-CAFETERIA', 'CHINA-GARDEN', 'THE-NOODLE-BAR', 'FRANKS-STEAK', 'SHAWARMA-TAHINA'];
  names_en text[] := array['Farm Brown', 'Karak Cafeteria', 'China Garden', 'The Noodle Bar', 'Franks Steak Sandwiches', 'Shawarma Tahina'];
  names_ar text[] := array['فارم براون', 'كرك كافتيريا', 'تشاينا جاردن', 'ذا نودل بار', 'فرانكس ستيك ساندويتش', 'شاورما طحينة'];
  cuisines text[] := array['دجاج مقلي وكرسبي', 'كرك وشاباتي وكافتيريا', 'صيني وآسيوي', 'نودلز ووك آسيوي', 'ستيك فيلي وساندويتش', 'شاورما وشارع شامي'];
  branch_counts int[] := array[4, 6, 3, 2, 3, 5];
  rivals text[];
  bucket timestamptz;
  previous_bucket timestamptz;
  b int;
  p int;
  z int;
  comp int;
  recovering boolean;
  rank_now int;
  rank_prev int;
  eta int;
  fee int;
  rating int;
  accept_s int;
  prep int;
  cancel_bps int;
  reviews int;
  visits int;
  conversion int;
  fleet text;
  penalty text;
  prev_penalty text;
  branch_name text;
  sid uuid;
  comp_eta int;
  comp_fee int;
  comp_rating int;
  comp_conversion int;
  policy text;
  promo text;
  jump int;
  daily int;
  monthly bigint;
begin
  bucket := date_trunc('hour', now()) + (floor(extract(minute from now()) / 5)::int * interval '5 minutes');
  previous_bucket := bucket - interval '5 minutes';
  for t in select id, created_by from tenants where slug = 'aether-demo' loop
    if exists (select 1 from venture_brands where tenant_id = t.id) then
      continue;
    end if;
    for b in 1..6 loop
      insert into venture_brands (
        tenant_id, code, name_en, name_ar, cuisine_category_ar, active_branches_count, sort_order, created_by
      ) values (
        t.id, codes[b], names_en[b], names_ar[b], cuisines[b], branch_counts[b], b, t.created_by
      );
      insert into brands (tenant_id, code, name, status, created_by)
      select t.id, codes[b], names_ar[b], 'active', t.created_by
      where not exists (select 1 from brands existing where existing.tenant_id = t.id and existing.code = codes[b]);
    end loop;

    for b in 1..6 loop
      for p in 1..5 loop
        for z in 1..7 loop
          recovering := zones[z] in ('حولي', 'الجهراء');
          if recovering then
            rank_now := 6 + b;
            rank_prev := rank_now + 3;
            eta := 22;
            fee := 500;
            rating := 450 + b;
            accept_s := 20;
            prep := 12;
            cancel_bps := 150;
            reviews := 900 + b * 40;
            visits := 2800 + b * 100;
            conversion := 900;
            fleet := 'platform_fleet';
            penalty := null;
            prev_penalty := null;
          else
            rank_now := 44 + ((b + p + z) % 9);
            rank_prev := least(60, rank_now + ((b + p) % 5) - 2);
            if rank_prev < 39 then rank_prev := 44; end if;
            eta := 42 + ((b + z) % 11);
            fee := 750 + ((p + z) % 5) * 250;
            rating := 410 + ((b + p) % 7) * 10;
            accept_s := 70 + ((b + p) % 6) * 10;
            prep := 22 + (z % 8);
            cancel_bps := 800 + ((b + z) % 5) * 80;
            reviews := 320 + b * 30 + z * 8;
            visits := 860 + b * 70 + z * 20;
            conversion := 160 + b * 15;
            fleet := 'vendor_own_fleet';
            penalty := 'الخوارزمية أبقت ' || names_ar[b] || ' في المركز ' || rank_now || ' بمنطقة ' || zones[z]
              || ' لأن مدة التوصيل ' || eta || ' دقيقة فوق حد 40 دقيقة، وقبول الطلب ' || accept_s
              || ' ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ورسوم التوصيل '
              || (fee / 1000)::text || '.' || lpad((fee % 1000)::text, 3, '0') || ' د.ك.';
            prev_penalty := 'الخوارزمية أبقت ' || names_ar[b] || ' في المركز ' || rank_prev || ' بمنطقة ' || zones[z]
              || ' في الفترة السابقة لأن مدة التوصيل وقبول الطلب وأسطول الشركة أبقت الترتيب حول المركز 45.';
          end if;
          branch_name := names_ar[b] || ' ' || zones[z];

          insert into aggregator_geo_rank_snapshots (
            tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
            current_rank, previous_rank_5m_ago, rank_delta, overall_rating_bps, reviews_count,
            estimated_visits_impressions, conversion_rate_bps, avg_order_acceptance_seconds, prep_time_minutes,
            cancellation_rate_bps, algorithm_penalty_reason_ar, delivery_eta_minutes, delivery_fee_minor,
            min_order_minor, logistics_mode, is_sponsored_ad_active, recorded_at, created_by
          ) values (
            t.id, previous_bucket, platforms[p], zones[z], names_ar[b], branch_name,
            rank_prev, rank_prev, 0, rating, reviews, visits, conversion, accept_s, prep, cancel_bps, prev_penalty,
            eta, fee, 2500, fleet, false, previous_bucket, t.created_by
          );

          insert into aggregator_geo_rank_snapshots (
            tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
            current_rank, previous_rank_5m_ago, rank_delta, overall_rating_bps, reviews_count,
            estimated_visits_impressions, conversion_rate_bps, avg_order_acceptance_seconds, prep_time_minutes,
            cancellation_rate_bps, algorithm_penalty_reason_ar, delivery_eta_minutes, delivery_fee_minor,
            min_order_minor, logistics_mode, is_sponsored_ad_active, recorded_at, created_by
          ) values (
            t.id, bucket, platforms[p], zones[z], names_ar[b], branch_name,
            rank_now, rank_prev, rank_prev - rank_now, rating, reviews, visits, conversion, accept_s, prep, cancel_bps, penalty,
            eta, fee, 2500, fleet, false, bucket, t.created_by
          ) returning id into sid;

          if b = 1 then rivals := array['كنتاكي', 'دجاج تكساس', 'بروستد هاوس'];
          elsif b = 2 then rivals := array['كرك الدوار', 'شاي كرك', 'كافتيريا النور'];
          elsif b = 3 then rivals := array['بكين جاردن', 'سيتي ووك', 'آسيا هاوس'];
          elsif b = 4 then rivals := array['ووك ماستر', 'نودلز ستريت', 'رامن كويت'];
          elsif b = 5 then rivals := array['فيلي ستيك', 'ستيك هاوس', 'ساندويتش كينج'];
          else rivals := array['شاورما الملك', 'طحينة ستيشن', 'شام الشام'];
          end if;

          for comp in 1..3 loop
            comp_eta := case comp when 1 then 18 when 2 then 22 else 26 end;
            comp_fee := case comp when 1 then 0 when 2 then 250 else 500 end;
            comp_rating := case comp when 1 then 480 when 2 then 460 else 440 end;
            comp_conversion := case comp when 1 then 2200 when 2 then 1800 else 1400 end;
            promo := case when comp_fee = 0 then 'توصيل مجاني' else 'خصم على رسوم التوصيل' end;
            policy := case comp
              when 1 then 'توصيل التطبيق برسوم صفر ومدة تحت 20 دقيقة، مع طلب تقييم بعد التسليم المكتمل فقط.'
              when 2 then 'خصم على رسوم التوصيل ووقت تحضير قصير، والرد على التقييم المنخفض خلال ساعة.'
              else 'عرض وجبة مع توصيل التطبيق، وبطاقة تقييم داخل الطلب.'
            end;
            insert into aggregator_top_competitors_bench (
              tenant_id, snapshot_id, platform_name, geo_zone_ar, competitor_rank, competitor_brand_name,
              competitor_rating_bps, competitor_reviews_count, competitor_visits_estimate, competitor_eta_minutes,
              competitor_delivery_fee_minor, competitor_logistics_mode, competitor_conversion_bps, active_promo_badge_ar,
              detected_rating_boost_policy_ar, exact_gap_analysis_ar, gap_vs_our_brand_json, created_by
            ) values (
              t.id, sid, platforms[p], zones[z], comp, rivals[comp], comp_rating, 800 * (4 - comp), 3000 * (4 - comp),
              comp_eta, comp_fee, 'platform_fleet', comp_conversion, promo, policy,
              names_ar[b] || ' في ' || zones[z] || ' يقارن مع المركز ' || comp || ' في فئة ' || cuisines[b]
                || '. المتصدر على توصيل التطبيق بمدة أقصر ورسوم أقل ونسبة تحويل أعلى.',
              jsonb_build_object(
                'rankGap', rank_now - comp,
                'etaGapMinutes', eta - comp_eta,
                'feeGapMinor', fee - comp_fee,
                'ratingGapBps', greatest(0, comp_rating - rating)
              ),
              t.created_by
            );
          end loop;

          if rank_now >= 39 then
            jump := rank_now - 5;
            daily := least(120, jump * 2);
            monthly := daily * 8000 * 30;
            insert into aggregator_rank_escalation_actions (
              tenant_id, platform_name, geo_zone_ar, our_brand_name, our_branch_name, current_rank, target_rank,
              root_cause_of_lower_rank_ar, algorithmic_recommendation_ar, recommended_action_type,
              estimated_rank_jump, estimated_revenue_uplift_minor, penalty_diagnosed_ar, step_by_step_escalation_plan_ar,
              logistics_switch_recommendation_ar, rating_boost_tactic_ar, estimated_daily_orders_gain,
              estimated_monthly_revenue_uplift_minor, status, created_by
            ) values (
              t.id, platforms[p], zones[z], names_ar[b], branch_name, rank_now, 5,
              penalty,
              'خطة التصعيد تنقل ' || names_ar[b] || ' في ' || zones[z] || ' من المركز ' || rank_now
                || ' إلى المركز 5، بزيادة تقديرية ' || daily || ' طلباً يومياً و' || (monthly / 1000)::text || '.' || lpad((monthly % 1000)::text, 3, '0') || ' د.ك شهرياً.',
              'switch_fleet_mode',
              jump, monthly, penalty,
              '1. اخفض قبول الطلب من ' || accept_s || ' ثانية إلى 25 ثانية. 2. اخفض التحضير من ' || prep
                || ' دقيقة إلى 12 دقيقة. 3. حوّل ' || names_ar[b] || ' في ' || zones[z]
                || ' من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك. 4. اخفض الإلغاء إلى أقل من 2.00 بالمئة. 5. اطلب تقييماً بعد كل تسليم مكتمل ورد على التقييم المنخفض خلال ساعة.',
              'حوّل ' || names_ar[b] || ' في ' || zones[z] || ' من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك.',
              'اطلب تقييماً بعد كل تسليم مكتمل لـ ' || names_ar[b] || ' في ' || zones[z] || '، ورد على التقييم المنخفض خلال ساعة.',
              daily, monthly, 'pending', t.created_by
            );
          end if;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;
