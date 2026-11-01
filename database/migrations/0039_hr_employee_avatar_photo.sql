-- Optional Odoo image_128 payload for employee kanban photos (data URL or null).

create or replace function erp_hr_avatar_photo_marker() returns text
language sql immutable as $$ select '0039_hr_employee_avatar_photo'::text $$;

alter table hr_employees
  add column if not exists avatar_photo text;

revoke all on function erp_hr_avatar_photo_marker() from public, anon, authenticated;
