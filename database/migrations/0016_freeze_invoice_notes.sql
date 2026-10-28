-- 0016: freeze the notes of a sales invoice once it leaves draft.
--
-- Why: the freeze trigger from 0004 named every commercial field except `notes`, so a direct
-- `update invoices set notes = ...` on an issued, partly paid or paid invoice succeeded in the database. Only the
-- service refused it. An invoice is a financial record and is never hand-edited, so the database must refuse it too.
--
-- Safety: this changes no row and drops nothing. The only code path that writes `notes` is the draft edit in
-- invoice-repository.ts, which carries `and status = 'draft'`, so nothing in the application breaks.
-- Reversing it means recreating invoices_freeze() without `notes` in the compared tuple.

create or replace function invoices_freeze() returns trigger
language plpgsql as $$
begin
  if old.status = 'void' then
    raise exception 'A void invoice cannot change' using errcode = 'restrict_violation';
  end if;
  if old.status <> 'draft' and (
    new.number, new.customer_id, new.customer_name, new.currency, new.issue_date, new.due_date,
    new.notes, new.subtotal_minor, new.tax_minor, new.total_minor
  ) is distinct from (
    old.number, old.customer_id, old.customer_name, old.currency, old.issue_date, old.due_date,
    old.notes, old.subtotal_minor, old.tax_minor, old.total_minor
  ) then
    raise exception 'An invoice that is no longer a draft cannot change its amounts, dates, customer or notes' using errcode = 'restrict_violation';
  end if;
  if new.paid_minor < old.paid_minor then
    raise exception 'Paid amount cannot decrease' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
