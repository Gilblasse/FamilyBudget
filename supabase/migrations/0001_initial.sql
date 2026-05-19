-- family-budget initial schema
--
-- Single-user, server-only access via the SUPABASE_SERVICE_ROLE_KEY. No RLS;
-- the trust boundary is same-origin browser -> Next.js server. The schema
-- mirrors the per-entity REST surface in app/api/budget/**.
--
-- IDs are TEXT to match `crypto.randomUUID()` strings minted by lib/format.ts
-- (and the `seed-*` ids in lib/seed.ts). Money is numeric(14,2). Calendar
-- dates are DATE; mutation timestamps are TIMESTAMPTZ.

create extension if not exists pgcrypto;

create table if not exists budgets (
  id                  text primary key,
  name                text not null,
  created_at          timestamptz not null default now(),
  default_range_start date not null,
  default_range_end   date not null,
  balance             numeric(14, 2) not null default 0,
  active_period_id    text not null default '',
  date_range_start    date,
  date_range_end      date
);

create table if not exists periods (
  id         text primary key,
  budget_id  text not null references budgets(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  label      text
);
create index if not exists periods_budget_idx on periods(budget_id);

create table if not exists income (
  id         text primary key,
  budget_id  text not null references budgets(id) on delete cascade,
  period_id  text not null,
  source     text not null,
  date       date not null,
  amount     numeric(14, 2) not null,
  status     text not null check (status in ('expected', 'confirmed', 'pending', 'received')),
  cadence    text check (cadence in ('once', 'weekly', 'biweekly', 'semimonthly', 'monthly')),
  second_day int  check (second_day between 1 and 31),
  end_date   date
);
create index if not exists income_budget_idx on income(budget_id);

create table if not exists bills (
  id         text primary key,
  budget_id  text not null references budgets(id) on delete cascade,
  period_id  text not null,
  name       text not null,
  date       date not null,
  amount     numeric(14, 2) not null,
  priority   text not null check (priority in ('crit', 'imp', 'opt', 'flex')),
  action     text not null check (action in ('pay-full', 'partial', 'delay', 'reduce', 'skip')),
  tags       text[]
);
create index if not exists bills_budget_idx on bills(budget_id);

-- Paid keys: bill_<id>, inc_<id>, inc_<id>_YYYY-MM-DD (recurring occurrence).
-- The CHECK regex matches lib/api-schemas.ts:paidKeyParamSchema.
create table if not exists paid_state (
  budget_id text not null references budgets(id) on delete cascade,
  key       text not null check (key ~ '^(bill|inc)_[A-Za-z0-9-]+(_[0-9]{4}-[0-9]{2}-[0-9]{2})?$'),
  paid      boolean not null default true,
  primary key (budget_id, key)
);

-- Singleton: tracks the active budget id, the persisted store version, and
-- the last-mutated timestamp. Forced to id=1 so we never accidentally create
-- a second row.
create table if not exists app_meta (
  id               int primary key default 1 check (id = 1),
  active_budget_id text not null default '',
  store_version    int  not null,
  updated_at       timestamptz not null default now()
);

insert into app_meta (id, active_budget_id, store_version)
values (1, '', 9)
on conflict (id) do nothing;

-- replace_budget_snapshot(payload jsonb)
--
-- Atomic whole-snapshot replace, used by the legacy PUT /api/budget endpoint
-- and the initial cloud import flow. payload shape:
--
--   { "version": int,
--     "data": <BudgetSnapshot> }
--
-- The function locks app_meta, enforces the stale-schema guard (incoming
-- version >= stored version), wipes all existing rows, and re-inserts the
-- supplied snapshot. Returns the new version and updated_at.
create or replace function replace_budget_snapshot(payload jsonb)
returns table (version int, updated_at timestamptz)
language plpgsql
as $$
declare
  incoming_version int;
  stored_version   int;
  data             jsonb;
  active_id        text;
  budget           jsonb;
  per_budget       jsonb;
  row              jsonb;
  budget_id_v      text;
begin
  incoming_version := coalesce((payload->>'version')::int, 0);
  data             := coalesce(payload->'data', '{}'::jsonb);

  -- Lock app_meta so concurrent writers serialize on the version check.
  select store_version into stored_version
    from app_meta
    where id = 1
    for update;

  if stored_version is null then
    insert into app_meta (id, active_budget_id, store_version)
      values (1, '', incoming_version)
      on conflict (id) do nothing;
    stored_version := incoming_version;
  end if;

  if incoming_version < stored_version then
    raise exception 'stale schema: stored=%, incoming=%', stored_version, incoming_version
      using errcode = 'P0001';
  end if;

  active_id := coalesce(data->>'activeBudgetId', '');

  -- Cascade-deletes all periods/income/bills/paid_state. The WHERE clause is
  -- a no-op filter, required by Supabase's PostgREST safety guard which
  -- rejects unconditional DELETE statements with errcode 21000.
  delete from budgets where id is not null;

  -- Re-insert budgets. If the payload omits the multi-budget slice, fall back
  -- to a single synthetic 'budget-default' built from the top-level fields,
  -- matching the legacy local-first PUT shape.
  if data ? 'budgets' and jsonb_array_length(coalesce(data->'budgets', '[]'::jsonb)) > 0 then
    for budget in select * from jsonb_array_elements(data->'budgets') loop
      budget_id_v := budget->>'id';
      per_budget := coalesce(data->'budgetData'->budget_id_v, '{}'::jsonb);

      -- For the active budget, fall back to top-level fields when budgetData
      -- doesn't have a slice for it (current local-first PUTs never do).
      if budget_id_v = active_id and per_budget = '{}'::jsonb then
        per_budget := data;
      end if;

      insert into budgets (
        id, name, created_at,
        default_range_start, default_range_end,
        balance, active_period_id, date_range_start, date_range_end
      )
      values (
        budget_id_v,
        coalesce(budget->>'name', ''),
        coalesce((budget->>'createdAt')::timestamptz, now()),
        (budget->'defaultRange'->>'start')::date,
        (budget->'defaultRange'->>'end')::date,
        coalesce((per_budget->>'balance')::numeric, 0),
        coalesce(per_budget->>'activePeriodId', ''),
        nullif(per_budget->'dateRange'->>'start', '')::date,
        nullif(per_budget->'dateRange'->>'end', '')::date
      );

      perform insert_budget_children(budget_id_v, per_budget);
    end loop;
  else
    -- Synthetic single-budget fallback. The default range is the active
    -- dateRange when present, else today..today.
    insert into budgets (
      id, name, created_at,
      default_range_start, default_range_end,
      balance, active_period_id, date_range_start, date_range_end
    )
    values (
      'budget-default',
      'My Budget',
      now(),
      coalesce(nullif(data->'dateRange'->>'start', '')::date, current_date),
      coalesce(nullif(data->'dateRange'->>'end',   '')::date, current_date),
      coalesce((data->>'balance')::numeric, 0),
      coalesce(data->>'activePeriodId', ''),
      nullif(data->'dateRange'->>'start', '')::date,
      nullif(data->'dateRange'->>'end',   '')::date
    );
    active_id := 'budget-default';
    perform insert_budget_children('budget-default', data);
  end if;

  update app_meta
     set active_budget_id = active_id,
         store_version    = incoming_version,
         updated_at       = now()
   where id = 1;

  return query
    select am.store_version as version, am.updated_at
      from app_meta am
      where am.id = 1;
end;
$$;

-- Internal helper used by replace_budget_snapshot. Splits each entity insert
-- so the parent function reads cleanly.
create or replace function insert_budget_children(budget_id_v text, slice jsonb)
returns void
language plpgsql
as $$
declare
  row jsonb;
begin
  if slice ? 'periods' then
    for row in select * from jsonb_array_elements(slice->'periods') loop
      insert into periods (id, budget_id, start_date, end_date, label)
      values (
        row->>'id',
        budget_id_v,
        (row->>'startDate')::date,
        (row->>'endDate')::date,
        row->>'label'
      );
    end loop;
  end if;

  if slice ? 'income' then
    for row in select * from jsonb_array_elements(slice->'income') loop
      insert into income (
        id, budget_id, period_id, source, date, amount, status,
        cadence, second_day, end_date
      )
      values (
        row->>'id',
        budget_id_v,
        coalesce(row->>'periodId', ''),
        coalesce(row->>'source', ''),
        (row->>'date')::date,
        coalesce((row->>'amount')::numeric, 0),
        coalesce(row->>'status', 'expected'),
        row->>'cadence',
        nullif(row->>'secondDay', '')::int,
        nullif(row->>'endDate', '')::date
      );
    end loop;
  end if;

  if slice ? 'bills' then
    for row in select * from jsonb_array_elements(slice->'bills') loop
      insert into bills (
        id, budget_id, period_id, name, date, amount, priority, action, tags
      )
      values (
        row->>'id',
        budget_id_v,
        coalesce(row->>'periodId', ''),
        coalesce(row->>'name', ''),
        (row->>'date')::date,
        coalesce((row->>'amount')::numeric, 0),
        coalesce(row->>'priority', 'imp'),
        coalesce(row->>'action', 'pay-full'),
        case
          when row ? 'tags' then array(select jsonb_array_elements_text(row->'tags'))
          else null
        end
      );
    end loop;
  end if;

  if slice ? 'paid' then
    insert into paid_state (budget_id, key, paid)
    select budget_id_v, key, value::boolean
      from jsonb_each_text(slice->'paid')
      where value::boolean = true;
  end if;
end;
$$;
