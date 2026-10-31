-- Venture Foods multi-warehouse + org branches + analytic P&L rows (6 brands × 10 branches).
-- Retires DEMO-MAIN warehouse naming without hard-delete.

create or replace function erp_vf_warehouses_branches_marker() returns text
language sql immutable as $$ select '0036_venture_foods_warehouses_branches_analytic'::text $$;

-- Soft-retire the DEMO warehouse label.
update warehouses
set name = 'Archive — retired seed warehouse',
    status = 'inactive',
    updated_at = now()
where code = 'DEMO-MAIN' or name ilike '%DEMO%';

-- Corporate brand for shared branch kitchens (org brands table, not venture_brands).
insert into brands (tenant_id, code, name, status, created_by)
select tenant.id, 'VF-CORP', 'Venture Foods Kuwait', 'active', tenant.created_by
from tenants as tenant
where not exists (
  select 1 from brands as brand where brand.tenant_id = tenant.id and brand.code = 'VF-CORP'
);

with sites (code, name) as (
  values
    ('BR-ARDIYA', 'Venture Foods KWC - Ardiya'),
    ('BR-SHARQ', 'Sharq - Head Office'),
    ('BR-SALM1', 'Salmiya 1'),
    ('BR-KOUT', 'Al Kout Mall'),
    ('BR-AVENUES', 'Avenues Mall'),
    ('BR-360', '360 Mall'),
    ('BR-PROM', 'Promenade Mall'),
    ('BR-QURAIN', 'Aswaq Al Qurain'),
    ('BR-ALRAI', 'Al Rai'),
    ('BR-OUT', 'Outside')
)
insert into branches (tenant_id, brand_id, code, name, timezone, status, created_by)
select tenant.id, brand.id, site.code, site.name, 'Asia/Kuwait', 'active', tenant.created_by
from tenants as tenant
join brands as brand on brand.tenant_id = tenant.id and brand.code = 'VF-CORP'
cross join sites as site
where not exists (
  select 1 from branches as existing where existing.tenant_id = tenant.id and existing.code = site.code
);

with stores (code, name) as (
  values
    ('WH-ARDIYA', 'المستودع المركزي - العارضية (Ardiya Central Warehouse)'),
    ('WH-360', 'مطبخ فرع 360 Mall'),
    ('WH-KOUT', 'مطبخ فرع Al Kout'),
    ('WH-AVENUES', 'مطبخ فرع Avenues'),
    ('WH-SALM1', 'مطبخ فرع Salmiya 1'),
    ('WH-SHARQ', 'مطبخ فرع Sharq HQ'),
    ('WH-PROM', 'مطبخ فرع Promenade'),
    ('WH-QURAIN', 'مطبخ فرع Aswaq Al Qurain'),
    ('WH-ALRAI', 'مطبخ فرع Al Rai'),
    ('WH-OUT', 'مطبخ خارجي / Outside')
)
insert into warehouses (tenant_id, code, name, status, created_by)
select tenant.id, store.code, store.name, 'active', tenant.created_by
from tenants as tenant
cross join stores as store
where not exists (
  select 1 from warehouses as existing where existing.tenant_id = tenant.id and existing.code = store.code
);

-- Analytic accounting cards: one P&L row per Venture Foods brand × branch (fils).
with matrix as (
  select brand.name_en as brand_name, branch.name as branch_name,
         (abs(hashtext(brand.code || ':' || branch.code)) % 900000) + 100000 as amount
  from venture_brands as brand
  cross join branches as branch
  join tenants as tenant on tenant.id = branch.tenant_id
  where branch.status = 'active'
)
insert into suite_records (
  tenant_id, app_key, title, stage, brand_name, branch_name, department, assignee,
  amount_minor, starts_on, ends_on, sort_order, created_by
)
select
  tenant.id,
  'analytic',
  'P&L · ' || matrix.brand_name || ' · ' || matrix.branch_name,
  'posted',
  matrix.brand_name,
  matrix.branch_name,
  'Finance',
  'Controller',
  matrix.amount,
  date_trunc('month', now())::date,
  (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  10,
  tenant.created_by
from tenants as tenant
cross join matrix
where not exists (
  select 1 from suite_records as existing
  where existing.tenant_id = tenant.id
    and existing.app_key = 'analytic'
    and existing.brand_name = matrix.brand_name
    and existing.branch_name = matrix.branch_name
);
