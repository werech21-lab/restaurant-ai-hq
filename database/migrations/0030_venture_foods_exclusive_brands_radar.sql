-- The rank radar keeps only the six Venture Foods brands.
-- 0028 is the rank-rescue file and 0029 created the portfolio. This file is 0030.
-- Generic أثير and demo rows are removed. Money stays in fils. Nothing contacts an external platform.

delete from aggregator_top_competitors_bench as bench
using aggregator_geo_rank_snapshots as snap
where bench.tenant_id = snap.tenant_id
  and bench.snapshot_id = snap.id
  and (
    snap.our_brand_name not in ('فارم براون', 'كرك كافتيريا', 'تشاينا جاردن', 'ذا نودل بار', 'فرانكس ستيك ساندويتش', 'شاورما طحينة')
    or snap.our_branch_name like 'أثير%'
    or snap.our_brand_name ilike '%demo%'
    or snap.our_branch_name ilike '%demo%'
  );

delete from aggregator_rank_escalation_actions
where our_brand_name not in ('فارم براون', 'كرك كافتيريا', 'تشاينا جاردن', 'ذا نودل بار', 'فرانكس ستيك ساندويتش', 'شاورما طحينة')
   or our_branch_name like 'أثير%'
   or our_brand_name ilike '%demo%'
   or our_branch_name ilike '%demo%';

delete from aggregator_geo_rank_snapshots
where our_brand_name not in ('فارم براون', 'كرك كافتيريا', 'تشاينا جاردن', 'ذا نودل بار', 'فرانكس ستيك ساندويتش', 'شاورما طحينة')
   or our_branch_name like 'أثير%'
   or our_brand_name ilike '%demo%'
   or our_branch_name ilike '%demo%';

alter table aggregator_geo_rank_snapshots
  add column brand_name_ar text,
  add column brand_name_en text,
  add column branch_location_ar text,
  add column covered_delivery_zones_ar text,
  add column delivery_zone_status text;

update aggregator_geo_rank_snapshots
set brand_name_ar = our_brand_name,
    brand_name_en = case our_brand_name
      when 'فارم براون' then 'Farm Brown'
      when 'كرك كافتيريا' then 'Karak Cafeteria'
      when 'تشاينا جاردن' then 'China Garden'
      when 'ذا نودل بار' then 'The Noodle Bar'
      when 'فرانكس ستيك ساندويتش' then 'Franks Steak Sandwiches'
      else 'Shawarma Tahina'
    end,
    branch_location_ar = our_branch_name,
    covered_delivery_zones_ar = case geo_zone_ar
      when 'السالمية' then 'السالمية، الرميثية، سلوى، بيان، مشرف'
      when 'شرق/مدينة الكويت' then 'شرق، المرقاب، الصالحية، بنيد القار، الدسمة'
      when 'حولي' then 'حولي، النقرة، الشهداء، ميدان حولي، ضاحية مبارك'
      when 'الفروانية' then 'الفروانية، خيطان، العمرية، الرابية، جليب الشيوخ'
      when 'المهبولة' then 'المهبولة، أبو حليفة، الفنطاس، العقيلة، المسيلة'
      when 'الجهراء' then 'الجهراء، القصر، النعيم، الواحة، تيماء'
      else 'العارضية، الفروانية، خيطان، العمرية، الرابية'
    end,
    delivery_zone_status = case
      when geo_zone_ar in ('حولي', 'الجهراء') then 'مفتوح للتوصيل'
      when geo_zone_ar = 'المهبولة' and current_rank >= 45 then 'خارج نطاق التوصيل'
      else 'مزدحم - نطاق مقلص'
    end
where brand_name_ar is null;

alter table aggregator_geo_rank_snapshots
  alter column brand_name_ar set not null,
  alter column brand_name_en set not null,
  alter column branch_location_ar set not null,
  alter column covered_delivery_zones_ar set not null,
  alter column delivery_zone_status set not null;

alter table aggregator_geo_rank_snapshots
  add constraint aggregator_geo_rank_venture_brand_check check (
    our_brand_name in ('فارم براون', 'كرك كافتيريا', 'تشاينا جاردن', 'ذا نودل بار', 'فرانكس ستيك ساندويتش', 'شاورما طحينة')
    and brand_name_ar = our_brand_name
    and brand_name_en in ('Farm Brown', 'Karak Cafeteria', 'China Garden', 'The Noodle Bar', 'Franks Steak Sandwiches', 'Shawarma Tahina')
    and char_length(branch_location_ar) between 1 and 160
    and char_length(covered_delivery_zones_ar) between 1 and 240
    and delivery_zone_status in ('مفتوح للتوصيل', 'مزدحم - نطاق مقلص', 'خارج نطاق التوصيل')
  );

alter table aggregator_rank_escalation_actions
  add constraint aggregator_escalation_venture_brand_check check (
    our_brand_name in ('فارم براون', 'كرك كافتيريا', 'تشاينا جاردن', 'ذا نودل بار', 'فرانكس ستيك ساندويتش', 'شاورما طحينة')
  );

create function erp_venture_foods_exclusive_marker() returns text
language sql immutable as $$ select 'brand_name_ar'::text $$;
revoke all on function erp_venture_foods_exclusive_marker() from public, anon, authenticated;
