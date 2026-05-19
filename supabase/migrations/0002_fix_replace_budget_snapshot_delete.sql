-- The initial migration shipped with `delete from budgets;` (no WHERE clause)
-- in the replace_budget_snapshot RPC. Supabase's safety guard rejects that
-- with errcode 21000 ('DELETE requires a WHERE clause'). Re-define the
-- function with the same body but an explicit no-op WHERE filter.

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

  delete from budgets where id is not null;

  if data ? 'budgets' and jsonb_array_length(coalesce(data->'budgets', '[]'::jsonb)) > 0 then
    for budget in select * from jsonb_array_elements(data->'budgets') loop
      budget_id_v := budget->>'id';
      per_budget := coalesce(data->'budgetData'->budget_id_v, '{}'::jsonb);

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
