-- v10: per-row adjustments log on income and bills.
--
-- Each row stores a JSONB array of `{ id, amount, note? }` entries that
-- represent signed deltas vs the planned `amount`. Effective planned amount
-- is `amount + sum(adjustments[].amount)`. See lib/types.ts:Adjustment and
-- lib/derived.ts:effectivePlanned.
--
-- The column is nullable / omitted by default — legacy v9 rows continue to
-- round-trip without it. `replace_budget_snapshot` and the per-entity write
-- paths read/write the field when present.

alter table income add column if not exists adjustments jsonb;
alter table bills  add column if not exists adjustments jsonb;

update app_meta set store_version = 10 where id = 1 and store_version < 10;

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
        cadence, second_day, end_date, adjustments
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
        nullif(row->>'endDate', '')::date,
        case
          when jsonb_typeof(row->'adjustments') = 'array' then row->'adjustments'
          else null
        end
      );
    end loop;
  end if;

  if slice ? 'bills' then
    for row in select * from jsonb_array_elements(slice->'bills') loop
      insert into bills (
        id, budget_id, period_id, name, date, amount, priority, action, tags, adjustments
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
        end,
        case
          when jsonb_typeof(row->'adjustments') = 'array' then row->'adjustments'
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
