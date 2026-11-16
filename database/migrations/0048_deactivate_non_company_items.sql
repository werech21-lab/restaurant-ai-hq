-- Deactivate catalog rows that are not company menu items.
-- This does not delete rows, and it does not change any password or PIN.
update items
set is_active = false
where sku in (
  'RIFDC013',
  'RW01487',
  'RIFDC015',
  'RW01489',
  'RIFDC012',
  'RW01486',
  'RIFDC014',
  'RW01488',
  'RIFDC016',
  'RW01490'
);

CREATE OR REPLACE FUNCTION erp_deactivate_non_company_items_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_deactivate_non_company_items_marker() FROM PUBLIC, anon, authenticated;
