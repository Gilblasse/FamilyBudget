// Reshape raw Supabase rows (snake_case) into family-budget's BudgetSnapshot
// shape (camelCase). Mirrors lib/supabase/envelope.ts:loadEnvelope.
//
// Two scripts share this logic: restore-prod-from-backup.mjs (restores from a
// previously captured raw-rows backup) and seed-prod-from-prototype.mjs
// (reads current prod to preserve non-active budgets before swapping in the
// active slice). If you add a field to Income / Bill / Period in `lib/types.ts`,
// update this file too.

export function periodFromRow(p) {
  return {
    id: p.id,
    startDate: p.start_date,
    endDate: p.end_date,
    ...(p.label ? { label: p.label } : {}),
  };
}

export function incomeFromRow(r) {
  return {
    id: r.id,
    periodId: r.period_id,
    source: r.source,
    date: r.date,
    amount: Number(r.amount ?? 0),
    status: r.status,
    ...(r.cadence ? { cadence: r.cadence } : {}),
    ...(r.second_day != null ? { secondDay: r.second_day } : {}),
    ...(r.end_date ? { endDate: r.end_date } : {}),
    ...(Array.isArray(r.adjustments) && r.adjustments.length > 0
      ? { adjustments: r.adjustments }
      : {}),
  };
}

export function billFromRow(b) {
  return {
    id: b.id,
    periodId: b.period_id,
    name: b.name,
    date: b.date,
    amount: Number(b.amount ?? 0),
    priority: b.priority,
    action: b.action,
    ...(b.tags ? { tags: b.tags } : {}),
    ...(Array.isArray(b.adjustments) && b.adjustments.length > 0
      ? { adjustments: b.adjustments }
      : {}),
  };
}

export function budgetMetaFromRow(b) {
  return {
    id: b.id,
    name: b.name,
    createdAt: b.created_at,
    defaultRange: { start: b.default_range_start, end: b.default_range_end },
  };
}

function groupByBudget(rows) {
  const out = new Map();
  for (const r of rows ?? []) {
    const arr = out.get(r.budget_id) ?? [];
    arr.push(r);
    out.set(r.budget_id, arr);
  }
  return out;
}

/**
 * Turn raw DB rows (`{ meta, budgets, periods, income, bills, paid }`) into:
 *   - `activeBudgetId`: from meta or first budget
 *   - `budgetMetas`: BudgetMeta[] for the envelope's `budgets` field
 *   - `budgetData`: per-budget `Record<id, BudgetData>` slices
 *
 * Throws if any required array is missing. Callers compose this into a
 * BudgetSnapshot by promoting one slice to top-level and optionally
 * substituting it.
 */
export function buildBudgetDataMap({ meta, budgets, periods, income, bills, paid }) {
  for (const [name, arr] of Object.entries({ budgets, periods, income, bills, paid })) {
    if (!Array.isArray(arr)) {
      throw new Error(`Missing required array: "${name}"`);
    }
  }
  const periodsByB = groupByBudget(periods);
  const incomeByB = groupByBudget(income);
  const billsByB = groupByBudget(bills);
  const paidByB = groupByBudget(paid);
  const budgetData = {};
  for (const b of budgets) {
    const paidMap = {};
    for (const p of paidByB.get(b.id) ?? []) if (p.paid) paidMap[p.key] = true;
    budgetData[b.id] = {
      balance: Number(b.balance ?? 0),
      income: (incomeByB.get(b.id) ?? []).map(incomeFromRow),
      bills: (billsByB.get(b.id) ?? []).map(billFromRow),
      paid: paidMap,
      periods: (periodsByB.get(b.id) ?? []).map(periodFromRow),
      activePeriodId: b.active_period_id,
      dateRange:
        b.date_range_start && b.date_range_end
          ? { start: b.date_range_start, end: b.date_range_end }
          : null,
    };
  }
  const activeBudgetId = meta?.active_budget_id || budgets[0]?.id;
  return {
    activeBudgetId,
    budgetMetas: budgets.map(budgetMetaFromRow),
    budgetData,
  };
}
