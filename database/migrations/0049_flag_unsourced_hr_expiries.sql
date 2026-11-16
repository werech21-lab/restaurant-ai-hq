-- Flagged cleanup for expiry dates that were stored without an hr document.
-- Not executed by the application on page view. Not a password or PIN change.
-- A no-op unless the panel employee table is present.
do $$
begin
  if to_regclass('public."Employee"') is not null and to_regclass('public."HrDocument"') is not null then
    update "Employee" as employee
    set
      "civilIdExpiry" = case
        when exists (
          select 1 from "HrDocument" as doc
          where doc."employeeId" = employee.id and doc.category = 'civil_id' and doc."expiryDate" is not null
        ) then employee."civilIdExpiry" else null end,
      "passportExpiry" = case
        when exists (
          select 1 from "HrDocument" as doc
          where doc."employeeId" = employee.id and doc.category = 'passport_work' and doc."expiryDate" is not null
        ) then employee."passportExpiry" else null end,
      "healthCardExpiry" = case
        when exists (
          select 1 from "HrDocument" as doc
          where doc."employeeId" = employee.id and doc.category = 'health_card' and doc."expiryDate" is not null
        ) then employee."healthCardExpiry" else null end,
      "workPermitExpiry" = case
        when exists (
          select 1 from "HrDocument" as doc
          where doc."employeeId" = employee.id and doc.category = 'passport_work' and doc."expiryDate" is not null
        ) then employee."workPermitExpiry" else null end,
      "drivingLicenseExpiry" = case
        when exists (
          select 1 from "HrDocument" as doc
          where doc."employeeId" = employee.id and doc.category = 'driving' and doc."expiryDate" is not null
        ) then employee."drivingLicenseExpiry" else null end;
  end if;
end $$;

CREATE OR REPLACE FUNCTION erp_flag_unsourced_hr_expiries_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;

REVOKE ALL ON FUNCTION erp_flag_unsourced_hr_expiries_marker() FROM PUBLIC, anon, authenticated;
