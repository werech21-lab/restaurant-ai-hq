-- 0012_ledger: the general ledger core. Chart of accounts, fiscal periods and double-entry journal entries.
--
-- What the database enforces, so no code path can get around it:
--   * An entry is a draft until it is posted. Only a draft's header and lines can change. Lines of a draft may be replaced.
--   * Posting checks, inside the database: at least two lines, every line is a debit or a credit (never both, never zero),
--     total debits equal total credits, every account is postable and active, and the entry date falls in an OPEN fiscal period.
--   * A posted entry, and its lines, never change again and are never deleted. A mistake is fixed with a reversing entry, which
--     the database checks mirrors the original line for line. An entry can be reversed once.
--   * A closed fiscal period is final. It cannot be closed while it still holds draft entries.
--   * Accounts and periods are never deleted. An account's code, type and parent never change.
-- Currency is KWD only. Amounts are whole fils (bigint), never floats.
--
-- NOT decided here (docs/ERP_CORE_DESIGN.md section 11): there is no default chart of accounts, no tax account, and no
-- automatic posting from invoices, payments or stock. Entries are made by people (or by code that a later decision adds), and
-- `source_type` only allows 'manual' and 'reversal' until then.
--
-- Browsers can only SELECT, gated by permission. Every write goes through the server.
--
-- Changes to existing data when this runs: each tenant's owner role gains the seven finance ledger permissions. No row is removed.

create or replace function erp_owner_extra_permissions() returns text[]
language sql immutable as $$
  select array[
    'org.brand.read', 'org.brand.manage', 'org.branch.read', 'org.branch.manage',
    'finance.account.read', 'finance.account.manage', 'finance.journal.read', 'finance.journal.create',
    'finance.journal.post', 'finance.journal.reverse', 'finance.period.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  code text not null check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$'),
  name text not null check (char_length(name) between 1 and 200),
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id uuid,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint accounts_tenant_id_key unique (tenant_id, id),
  constraint accounts_tenant_code_key unique (tenant_id, code),
  constraint accounts_parent_fk foreign key (tenant_id, parent_id) references accounts (tenant_id, id),
  constraint accounts_not_own_parent check (parent_id is null or parent_id <> id)
);
create index accounts_tenant_code_idx on accounts (tenant_id, code, id);

create table fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  name text not null check (char_length(name) between 1 and 100),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint fiscal_periods_tenant_id_key unique (tenant_id, id),
  constraint fiscal_periods_tenant_name_key unique (tenant_id, name),
  constraint fiscal_periods_dates check (ends_on >= starts_on),
  constraint fiscal_periods_closed check ((status = 'closed') = (closed_at is not null and closed_by is not null))
);
create index fiscal_periods_range_idx on fiscal_periods (tenant_id, starts_on, ends_on);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  entry_date date not null,
  memo text not null default '' check (char_length(memo) <= 500),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  status text not null default 'draft' check (status in ('draft', 'posted')),
  source_type text not null default 'manual' check (source_type in ('manual', 'reversal')),
  source_id uuid,
  reverses_id uuid,
  period_id uuid,
  posted_at timestamptz,
  posted_by uuid references auth.users (id),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint journal_entries_tenant_id_key unique (tenant_id, id),
  constraint journal_entries_tenant_number_key unique (tenant_id, number),
  constraint journal_entries_period_fk foreign key (tenant_id, period_id) references fiscal_periods (tenant_id, id),
  constraint journal_entries_reverses_fk foreign key (tenant_id, reverses_id) references journal_entries (tenant_id, id),
  constraint journal_entries_posted check ((status = 'posted') = (posted_at is not null and posted_by is not null and period_id is not null)),
  constraint journal_entries_reversal check ((source_type = 'reversal') = (reverses_id is not null))
);
create unique index journal_entries_reversed_once on journal_entries (tenant_id, reverses_id) where reverses_id is not null;
create index journal_entries_number_idx on journal_entries (tenant_id, number desc, id desc);
create index journal_entries_date_idx on journal_entries (tenant_id, entry_date, status);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  entry_id uuid not null,
  line_no integer not null check (line_no >= 1),
  account_id uuid not null,
  debit_minor bigint not null default 0 check (debit_minor >= 0 and debit_minor <= 1000000000000),
  credit_minor bigint not null default 0 check (credit_minor >= 0 and credit_minor <= 1000000000000),
  description text not null default '' check (char_length(description) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint journal_lines_entry_line_key unique (entry_id, line_no),
  constraint journal_lines_one_side check ((debit_minor > 0) <> (credit_minor > 0)),
  constraint journal_lines_entry_fk foreign key (tenant_id, entry_id) references journal_entries (tenant_id, id),
  constraint journal_lines_account_fk foreign key (tenant_id, account_id) references accounts (tenant_id, id)
);
create index journal_lines_entry_idx on journal_lines (tenant_id, entry_id, line_no);
create index journal_lines_account_idx on journal_lines (tenant_id, account_id);

-- ---- guards ----

create or replace function accounts_guard() returns trigger
language plpgsql as $$
declare
  v_parent accounts%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id or new.code <> old.code or new.type <> old.type or new.parent_id is distinct from old.parent_id then
      raise exception 'The company, code, type and parent of an account cannot change' using errcode = 'restrict_violation';
    end if;
    if new.is_postable <> old.is_postable
       and exists (select 1 from journal_lines where tenant_id = old.tenant_id and account_id = old.id) then
      raise exception 'An account that has journal lines cannot change between postable and header' using errcode = 'restrict_violation';
    end if;
  elsif new.parent_id is not null then
    select * into v_parent from accounts where tenant_id = new.tenant_id and id = new.parent_id;
    if v_parent.type <> new.type then
      raise exception 'An account must have the same type as its parent' using errcode = 'restrict_violation';
    end if;
    if v_parent.is_postable then
      raise exception 'A parent account must be a header account (not postable)' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function accounts_guard() from public, anon, authenticated;

create or replace function fiscal_periods_guard() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('fiscal_periods:' || new.tenant_id::text, 0));
  if tg_op = 'UPDATE' then
    if old.status = 'closed' then
      raise exception 'A closed fiscal period is final' using errcode = 'restrict_violation';
    end if;
    if new.tenant_id <> old.tenant_id or new.starts_on <> old.starts_on or new.ends_on <> old.ends_on then
      raise exception 'The dates of a fiscal period cannot change' using errcode = 'restrict_violation';
    end if;
    if new.status = 'closed' and exists (
      select 1 from journal_entries
      where tenant_id = new.tenant_id and status = 'draft' and entry_date between new.starts_on and new.ends_on
    ) then
      raise exception 'A fiscal period with draft entries cannot be closed' using errcode = 'restrict_violation';
    end if;
  else
    if exists (
      select 1 from fiscal_periods
      where tenant_id = new.tenant_id and daterange(starts_on, ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]')
    ) then
      raise exception 'Fiscal periods cannot overlap' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function fiscal_periods_guard() from public, anon, authenticated;

create or replace function journal_entries_guard() returns trigger
language plpgsql as $$
declare
  v_period uuid;
  v_period_status text;
  v_lines integer;
  v_debit numeric;
  v_credit numeric;
  v_original_status text;
  v_original_lines integer;
  v_mismatch integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A journal entry starts as a draft' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if old.status = 'posted' then
    raise exception 'A posted journal entry cannot change' using errcode = 'restrict_violation';
  end if;
  if new.tenant_id <> old.tenant_id or new.number <> old.number or new.source_type <> old.source_type
     or new.source_id is distinct from old.source_id or new.reverses_id is distinct from old.reverses_id
     or new.created_by <> old.created_by then
    raise exception 'The company, number, source and creator of a journal entry cannot change' using errcode = 'restrict_violation';
  end if;

  if new.status = 'posted' then
    select count(*), coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0)
      into v_lines, v_debit, v_credit
      from journal_lines where tenant_id = new.tenant_id and entry_id = new.id;
    if v_lines < 2 then
      raise exception 'A journal entry needs at least two lines' using errcode = 'restrict_violation';
    end if;
    if v_debit <> v_credit then
      raise exception 'The journal entry is not balanced: debits % and credits %', v_debit, v_credit using errcode = 'restrict_violation';
    end if;
    if exists (
      select 1 from journal_lines l join accounts a on a.tenant_id = l.tenant_id and a.id = l.account_id
      where l.tenant_id = new.tenant_id and l.entry_id = new.id and (not a.is_postable or not a.is_active)
    ) then
      raise exception 'A line points at an account that is inactive or not postable' using errcode = 'restrict_violation';
    end if;

    -- The share lock makes a concurrent "close period" wait for this posting to commit.
    select id, status into v_period, v_period_status
      from fiscal_periods
      where tenant_id = new.tenant_id and new.entry_date between starts_on and ends_on
      for share;
    if v_period is null then
      raise exception 'No fiscal period covers %', new.entry_date using errcode = 'restrict_violation';
    end if;
    if v_period_status <> 'open' then
      raise exception 'The fiscal period of % is closed', new.entry_date using errcode = 'restrict_violation';
    end if;

    if new.reverses_id is not null then
      select status into v_original_status from journal_entries where tenant_id = new.tenant_id and id = new.reverses_id for share;
      if v_original_status is distinct from 'posted' then
        raise exception 'Only a posted entry can be reversed' using errcode = 'restrict_violation';
      end if;
      select count(*) into v_original_lines from journal_lines where tenant_id = new.tenant_id and entry_id = new.reverses_id;
      select count(*) into v_mismatch from (
        (select account_id, credit_minor as debit_minor, debit_minor as credit_minor from journal_lines where tenant_id = new.tenant_id and entry_id = new.reverses_id
         except
         select account_id, debit_minor, credit_minor from journal_lines where tenant_id = new.tenant_id and entry_id = new.id)
        union all
        (select account_id, debit_minor, credit_minor from journal_lines where tenant_id = new.tenant_id and entry_id = new.id
         except
         select account_id, credit_minor, debit_minor from journal_lines where tenant_id = new.tenant_id and entry_id = new.reverses_id)
      ) differences;
      if v_mismatch > 0 or v_original_lines <> v_lines then
        raise exception 'A reversing entry must mirror the original line for line' using errcode = 'restrict_violation';
      end if;
    end if;

    new.period_id := v_period;
    new.posted_at := now();
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_guard() from public, anon, authenticated;

create or replace function journal_lines_guard() returns trigger
language plpgsql as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_status text;
  v_postable boolean;
  v_active boolean;
begin
  select status into v_status from journal_entries where tenant_id = v_tenant and id = v_entry for share;
  if v_status is distinct from 'draft' then
    raise exception 'The lines of a posted journal entry cannot change' using errcode = 'restrict_violation';
  end if;
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.entry_id <> old.entry_id) then
    raise exception 'A line cannot move to another entry' using errcode = 'restrict_violation';
  end if;
  if tg_op <> 'DELETE' then
    select is_postable, is_active into v_postable, v_active from accounts where tenant_id = new.tenant_id and id = new.account_id;
    if not coalesce(v_postable, false) or not coalesce(v_active, false) then
      raise exception 'A line points at an account that is inactive or not postable' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function journal_lines_guard() from public, anon, authenticated;

create trigger accounts_guard before insert or update on accounts for each row execute function accounts_guard();
create trigger accounts_updated_at before update on accounts for each row execute function set_updated_at();
create trigger accounts_no_delete before delete on accounts for each row execute function prevent_delete();

create trigger fiscal_periods_guard before insert or update on fiscal_periods for each row execute function fiscal_periods_guard();
create trigger fiscal_periods_updated_at before update on fiscal_periods for each row execute function set_updated_at();
create trigger fiscal_periods_no_delete before delete on fiscal_periods for each row execute function prevent_delete();

create trigger journal_entries_guard before insert or update on journal_entries for each row execute function journal_entries_guard();
create trigger journal_entries_updated_at before update on journal_entries for each row execute function set_updated_at();
create trigger journal_entries_no_delete before delete on journal_entries for each row execute function prevent_delete();

create trigger journal_lines_guard before insert or update or delete on journal_lines for each row execute function journal_lines_guard();
create trigger journal_lines_updated_at before update on journal_lines for each row execute function set_updated_at();

-- ---- access ----
alter table accounts enable row level security;
alter table fiscal_periods enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
revoke all on accounts, fiscal_periods, journal_entries, journal_lines from anon, authenticated;
grant select on accounts, fiscal_periods, journal_entries, journal_lines to authenticated;

create policy accounts_select on accounts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.account.read'));
create policy fiscal_periods_select on fiscal_periods for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.journal.read'));
create policy journal_entries_select on journal_entries for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.journal.read'));
create policy journal_lines_select on journal_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.journal.read'));

-- Existing tenants: the owner role gains the new permissions (it already holds every permission).
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;
