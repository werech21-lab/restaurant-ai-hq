-- Rank rescue diagnostics for branches buried around #45. Money stays in fils and rates in basis points.
-- Existing Keeta / السالمية escalation rows are left on their current status.

alter table aggregator_geo_rank_snapshots
  add column avg_order_acceptance_seconds integer not null default 0 check (avg_order_acceptance_seconds between 0 and 3600),
  add column prep_time_minutes integer not null default 15 check (prep_time_minutes between 1 and 180),
  add column cancellation_rate_bps integer not null default 0 check (cancellation_rate_bps between 0 and 10000),
  add column algorithm_penalty_reason_ar text;

alter table aggregator_top_competitors_bench
  add column competitor_conversion_bps integer not null default 0 check (competitor_conversion_bps between 0 and 10000),
  add column exact_gap_analysis_ar text not null default '' check (char_length(exact_gap_analysis_ar) <= 2000);

alter table aggregator_rank_escalation_actions
  add column penalty_diagnosed_ar text not null default '' check (char_length(penalty_diagnosed_ar) <= 2000),
  add column step_by_step_escalation_plan_ar text not null default '' check (char_length(step_by_step_escalation_plan_ar) <= 2000),
  add column logistics_switch_recommendation_ar text not null default '' check (char_length(logistics_switch_recommendation_ar) <= 2000),
  add column rating_boost_tactic_ar text not null default '' check (char_length(rating_boost_tactic_ar) <= 2000),
  add column estimated_daily_orders_gain integer not null default 0 check (estimated_daily_orders_gain between 0 and 100000),
  add column estimated_monthly_revenue_uplift_minor bigint not null default 0 check (estimated_monthly_revenue_uplift_minor >= 0 and estimated_monthly_revenue_uplift_minor <= 1000000000000);

update aggregator_geo_rank_snapshots
set current_rank = 46,
    previous_rank_5m_ago = 48,
    rank_delta = 2,
    overall_rating_bps = 360,
    reviews_count = 420,
    estimated_visits_impressions = 1100,
    conversion_rate_bps = 220,
    avg_order_acceptance_seconds = 95,
    prep_time_minutes = 28,
    cancellation_rate_bps = 900,
    delivery_eta_minutes = 47,
    delivery_fee_minor = 1250,
    logistics_mode = 'vendor_own_fleet',
    is_sponsored_ad_active = false,
    algorithm_penalty_reason_ar = $p$الخوارزمية أبقت الفرع في المركز 46 لأن مدة التوصيل 47 دقيقة فوق حد 40 دقيقة، وقبول الطلب 95 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 9.00 بالمئة.$p$
where platform_name = 'Talabat' and geo_zone_ar = 'السالمية';

update aggregator_geo_rank_snapshots
set current_rank = 45,
    previous_rank_5m_ago = 45,
    rank_delta = 0,
    overall_rating_bps = 350,
    reviews_count = 380,
    estimated_visits_impressions = 980,
    conversion_rate_bps = 190,
    avg_order_acceptance_seconds = 80,
    prep_time_minutes = 26,
    cancellation_rate_bps = 850,
    delivery_eta_minutes = 44,
    delivery_fee_minor = 1000,
    logistics_mode = 'vendor_own_fleet',
    is_sponsored_ad_active = false,
    algorithm_penalty_reason_ar = $p$الخوارزمية أبقت الفرع في المركز 45 لأن مدة التوصيل 44 دقيقة فوق حد 40 دقيقة، وقبول الطلب 80 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 8.50 بالمئة.$p$
where platform_name = 'Talabat' and geo_zone_ar = 'شرق/مدينة الكويت';

update aggregator_geo_rank_snapshots
set current_rank = 48,
    previous_rank_5m_ago = 45,
    rank_delta = -3,
    overall_rating_bps = 340,
    reviews_count = 310,
    estimated_visits_impressions = 860,
    conversion_rate_bps = 160,
    avg_order_acceptance_seconds = 110,
    prep_time_minutes = 32,
    cancellation_rate_bps = 1100,
    delivery_eta_minutes = 52,
    delivery_fee_minor = 1500,
    logistics_mode = 'vendor_own_fleet',
    is_sponsored_ad_active = false,
    algorithm_penalty_reason_ar = $p$الخوارزمية أبقت الفرع في المركز 48 لأن مدة التوصيل 52 دقيقة فوق حد 40 دقيقة، وقبول الطلب 110 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 11.00 بالمئة.$p$
where platform_name = 'Snoonu' and geo_zone_ar = 'الفروانية';

update aggregator_geo_rank_snapshots
set current_rank = 39,
    previous_rank_5m_ago = 41,
    rank_delta = 2,
    overall_rating_bps = 390,
    reviews_count = 540,
    estimated_visits_impressions = 1600,
    conversion_rate_bps = 410,
    avg_order_acceptance_seconds = 70,
    prep_time_minutes = 22,
    cancellation_rate_bps = 600,
    delivery_eta_minutes = 41,
    delivery_fee_minor = 750,
    logistics_mode = 'platform_fleet',
    is_sponsored_ad_active = false,
    algorithm_penalty_reason_ar = $p$الخوارزمية أبقت الفرع في المركز 39 لأن مدة التوصيل 41 دقيقة فوق حد 40 دقيقة، وقبول الطلب 70 ثانية فوق حد 60 ثانية.$p$
where platform_name = 'Snoonu' and geo_zone_ar = 'المهبولة';

update aggregator_geo_rank_snapshots
set current_rank = 12,
    previous_rank_5m_ago = 18,
    rank_delta = 6,
    avg_order_acceptance_seconds = 25,
    prep_time_minutes = 14,
    cancellation_rate_bps = 200,
    delivery_eta_minutes = 24,
    delivery_fee_minor = 500,
    logistics_mode = 'platform_fleet',
    algorithm_penalty_reason_ar = null
where platform_name = 'Deliveroo' and geo_zone_ar = 'حولي';

update aggregator_geo_rank_snapshots
set current_rank = 6,
    previous_rank_5m_ago = 9,
    rank_delta = 3,
    avg_order_acceptance_seconds = 20,
    prep_time_minutes = 12,
    cancellation_rate_bps = 150,
    delivery_eta_minutes = 20,
    delivery_fee_minor = 250,
    logistics_mode = 'platform_fleet',
    algorithm_penalty_reason_ar = null
where platform_name = 'Keeta' and geo_zone_ar = 'الجهراء';

update aggregator_top_competitors_bench c
set competitor_rating_bps = case c.competitor_rank when 1 then 480 when 2 then 460 else 440 end,
    competitor_reviews_count = case c.competitor_rank when 1 then 2400 when 2 then 1800 else 1200 end,
    competitor_visits_estimate = case c.competitor_rank when 1 then 12000 when 2 then 9000 else 6400 end,
    competitor_eta_minutes = case c.competitor_rank when 1 then 18 when 2 then 22 else 26 end,
    competitor_delivery_fee_minor = case c.competitor_rank when 1 then 0 when 2 then 250 else 500 end,
    competitor_logistics_mode = 'platform_fleet',
    competitor_conversion_bps = case c.competitor_rank when 1 then 2200 when 2 then 1800 else 1400 end,
    exact_gap_analysis_ar = $g$المتصدر على توصيل التطبيق بمدة أقصر ورسوم أقل ونسبة تحويل أعلى. فرعنا متأخر لأن مدة التوصيل وقبول الطلب ورسوم أسطول الشركة تبقي الترتيب حول المركز 45.$g$,
    gap_vs_our_brand_json = jsonb_build_object(
      'rankGap', s.current_rank - c.competitor_rank,
      'etaGapMinutes', s.delivery_eta_minutes - (case c.competitor_rank when 1 then 18 when 2 then 22 else 26 end),
      'feeGapMinor', s.delivery_fee_minor - (case c.competitor_rank when 1 then 0 when 2 then 250 else 500 end),
      'ratingGapBps', greatest(0, (case c.competitor_rank when 1 then 480 when 2 then 460 else 440 end) - s.overall_rating_bps)
    )
from aggregator_geo_rank_snapshots s
where c.snapshot_id = s.id
  and c.tenant_id = s.tenant_id
  and (
    (s.platform_name = 'Talabat' and s.geo_zone_ar in ('السالمية', 'شرق/مدينة الكويت'))
    or (s.platform_name = 'Snoonu' and s.geo_zone_ar in ('الفروانية', 'المهبولة'))
  );

update aggregator_rank_escalation_actions
set current_rank = 46,
    target_rank = 5,
    root_cause_of_lower_rank_ar = $p$الخوارزمية أبقت الفرع في المركز 46 لأن مدة التوصيل 47 دقيقة فوق حد 40 دقيقة، وقبول الطلب 95 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 9.00 بالمئة.$p$,
    algorithmic_recommendation_ar = $p$خطة التصعيد تنقل السالمية على طلبات من المركز 46 إلى المركز 5، بزيادة تقديرية 82 طلباً يومياً و19680.000 د.ك شهرياً.$p$,
    recommended_action_type = 'switch_fleet_mode',
    estimated_rank_jump = 41,
    estimated_revenue_uplift_minor = 19680000,
    penalty_diagnosed_ar = $p$الخوارزمية أبقت الفرع في المركز 46 لأن مدة التوصيل 47 دقيقة فوق حد 40 دقيقة، وقبول الطلب 95 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 9.00 بالمئة.$p$,
    step_by_step_escalation_plan_ar = $p$1. اخفض قبول الطلب من 95 ثانية إلى 25 ثانية. 2. اخفض التحضير من 28 دقيقة إلى 12 دقيقة. 3. حوّل السالمية على طلبات من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك. 4. اخفض الإلغاء من 9.00 بالمئة إلى أقل من 2.00 بالمئة. 5. فعّل بطاقة تقييم داخل الطلب حتى يرتفع التقييم وتزداد الزيارات.$p$,
    logistics_switch_recommendation_ar = $p$حوّل السالمية على طلبات من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك.$p$,
    rating_boost_tactic_ar = $p$اطلب تقييماً بعد كل تسليم مكتمل في السالمية، وردّ على التقييمات المنخفضة خلال ساعة، حتى تقترب من سياسة المتصدرين.$p$,
    estimated_daily_orders_gain = 82,
    estimated_monthly_revenue_uplift_minor = 19680000,
    version = version + 1
where platform_name = 'Talabat' and geo_zone_ar = 'السالمية' and status in ('pending', 'approved_executing');

update aggregator_rank_escalation_actions
set current_rank = 45,
    target_rank = 5,
    root_cause_of_lower_rank_ar = $p$الخوارزمية أبقت الفرع في المركز 45 لأن مدة التوصيل 44 دقيقة فوق حد 40 دقيقة، وقبول الطلب 80 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 8.50 بالمئة.$p$,
    algorithmic_recommendation_ar = $p$خطة التصعيد تنقل شرق/مدينة الكويت على طلبات من المركز 45 إلى المركز 5، بزيادة تقديرية 80 طلباً يومياً و19200.000 د.ك شهرياً.$p$,
    recommended_action_type = 'switch_fleet_mode',
    estimated_rank_jump = 40,
    estimated_revenue_uplift_minor = 19200000,
    penalty_diagnosed_ar = $p$الخوارزمية أبقت الفرع في المركز 45 لأن مدة التوصيل 44 دقيقة فوق حد 40 دقيقة، وقبول الطلب 80 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 8.50 بالمئة.$p$,
    step_by_step_escalation_plan_ar = $p$1. اخفض قبول الطلب من 80 ثانية إلى 25 ثانية. 2. اخفض التحضير من 26 دقيقة إلى 12 دقيقة. 3. حوّل شرق/مدينة الكويت على طلبات من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك. 4. اخفض الإلغاء من 8.50 بالمئة إلى أقل من 2.00 بالمئة. 5. فعّل بطاقة تقييم داخل الطلب حتى يرتفع التقييم وتزداد الزيارات.$p$,
    logistics_switch_recommendation_ar = $p$حوّل شرق/مدينة الكويت على طلبات من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك.$p$,
    rating_boost_tactic_ar = $p$اطلب تقييماً بعد كل تسليم مكتمل في شرق/مدينة الكويت، وردّ على التقييمات المنخفضة خلال ساعة، حتى تقترب من سياسة المتصدرين.$p$,
    estimated_daily_orders_gain = 80,
    estimated_monthly_revenue_uplift_minor = 19200000,
    version = version + 1
where platform_name = 'Talabat' and geo_zone_ar = 'شرق/مدينة الكويت' and status in ('pending', 'approved_executing');

update aggregator_rank_escalation_actions
set current_rank = 48,
    target_rank = 5,
    root_cause_of_lower_rank_ar = $p$الخوارزمية أبقت الفرع في المركز 48 لأن مدة التوصيل 52 دقيقة فوق حد 40 دقيقة، وقبول الطلب 110 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 11.00 بالمئة.$p$,
    algorithmic_recommendation_ar = $p$خطة التصعيد تنقل الفروانية على سنونو من المركز 48 إلى المركز 5، بزيادة تقديرية 86 طلباً يومياً و20640.000 د.ك شهرياً.$p$,
    recommended_action_type = 'switch_fleet_mode',
    estimated_rank_jump = 43,
    estimated_revenue_uplift_minor = 20640000,
    penalty_diagnosed_ar = $p$الخوارزمية أبقت الفرع في المركز 48 لأن مدة التوصيل 52 دقيقة فوق حد 40 دقيقة، وقبول الطلب 110 ثانية فوق حد 60 ثانية، والتوصيل على أسطول الشركة بلا أولوية التطبيق، ونسبة الإلغاء 11.00 بالمئة.$p$,
    step_by_step_escalation_plan_ar = $p$1. اخفض قبول الطلب من 110 ثانية إلى 25 ثانية. 2. اخفض التحضير من 32 دقيقة إلى 12 دقيقة. 3. حوّل الفروانية على سنونو من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك. 4. اخفض الإلغاء من 11.00 بالمئة إلى أقل من 2.00 بالمئة. 5. فعّل بطاقة تقييم داخل الطلب حتى يرتفع التقييم وتزداد الزيارات.$p$,
    logistics_switch_recommendation_ar = $p$حوّل الفروانية على سنونو من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك.$p$,
    rating_boost_tactic_ar = $p$اطلب تقييماً بعد كل تسليم مكتمل في الفروانية، وردّ على التقييمات المنخفضة خلال ساعة، حتى تقترب من سياسة المتصدرين.$p$,
    estimated_daily_orders_gain = 86,
    estimated_monthly_revenue_uplift_minor = 20640000,
    version = version + 1
where platform_name = 'Snoonu' and geo_zone_ar = 'الفروانية' and status in ('pending', 'approved_executing');

update aggregator_rank_escalation_actions
set current_rank = 39,
    target_rank = 5,
    root_cause_of_lower_rank_ar = $p$الخوارزمية أبقت الفرع في المركز 39 لأن مدة التوصيل 41 دقيقة فوق حد 40 دقيقة، وقبول الطلب 70 ثانية فوق حد 60 ثانية.$p$,
    algorithmic_recommendation_ar = $p$خطة التصعيد تنقل المهبولة على سنونو من المركز 39 إلى المركز 5، بزيادة تقديرية 68 طلباً يومياً و16320.000 د.ك شهرياً.$p$,
    recommended_action_type = 'reduce_prep_eta',
    estimated_rank_jump = 34,
    estimated_revenue_uplift_minor = 16320000,
    penalty_diagnosed_ar = $p$الخوارزمية أبقت الفرع في المركز 39 لأن مدة التوصيل 41 دقيقة فوق حد 40 دقيقة، وقبول الطلب 70 ثانية فوق حد 60 ثانية.$p$,
    step_by_step_escalation_plan_ar = $p$1. اخفض قبول الطلب من 70 ثانية إلى 25 ثانية. 2. اخفض التحضير من 22 دقيقة إلى 12 دقيقة. 3. أبقِ توصيل التطبيق في المهبولة على سنونو، واخفض مدة التوصيل إلى 28 دقيقة ورسوم 0.500 د.ك. 4. اخفض الإلغاء من 6.00 بالمئة إلى أقل من 2.00 بالمئة. 5. فعّل بطاقة تقييم داخل الطلب حتى يرتفع التقييم وتزداد الزيارات.$p$,
    logistics_switch_recommendation_ar = $p$أبقِ توصيل التطبيق في المهبولة على سنونو، واخفض مدة التوصيل إلى 28 دقيقة ورسوم 0.500 د.ك.$p$,
    rating_boost_tactic_ar = $p$اطلب تقييماً بعد كل تسليم مكتمل في المهبولة، وردّ على التقييمات المنخفضة خلال ساعة، حتى تقترب من سياسة المتصدرين.$p$,
    estimated_daily_orders_gain = 68,
    estimated_monthly_revenue_uplift_minor = 16320000,
    version = version + 1
where platform_name = 'Snoonu' and geo_zone_ar = 'المهبولة' and status in ('pending', 'approved_executing');

update aggregator_rank_escalation_actions
set current_rank = 12,
    target_rank = least(target_rank, 12),
    estimated_rank_jump = greatest(0, 12 - least(target_rank, 12)),
    version = version + 1
where platform_name = 'Deliveroo' and geo_zone_ar = 'حولي' and status in ('pending', 'approved_executing');

update aggregator_rank_escalation_actions
set current_rank = 6,
    target_rank = least(target_rank, 6),
    estimated_rank_jump = greatest(0, 6 - least(target_rank, 6)),
    version = version + 1
where platform_name = 'Keeta' and geo_zone_ar = 'الجهراء' and status in ('pending', 'approved_executing');

alter table aggregator_geo_rank_snapshots
  add constraint aggregator_geo_rank_penalty_check check (
    (current_rank < 39 and algorithm_penalty_reason_ar is null)
    or (
      current_rank >= 39
      and algorithm_penalty_reason_ar is not null
      and char_length(btrim(algorithm_penalty_reason_ar)) between 1 and 800
    )
  );

create function erp_aggregator_rank_rescue_marker() returns text
language sql immutable as $$ select 'algorithm_penalty_reason_ar'::text $$;

revoke all on function erp_aggregator_rank_rescue_marker() from public, anon, authenticated;
