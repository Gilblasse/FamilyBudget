/**
 * Centralized TanStack Query key factory for the remote-primary layer.
 * Two-tier so per-budget invalidation does not nuke the whole cache.
 *
 *   qk.envelope()                — the full envelope (cell A1)
 *   qk.budgets()                 — multi-budget list
 *   qk.income(budgetId)          — income rows for a given budget
 *   qk.bills(budgetId)           — bills for a given budget
 *   qk.periods(budgetId)         — periods for a given budget
 *   qk.paid(budgetId)            — paid-key map for a given budget
 *   qk.meta(budgetId)            — balance, activePeriodId, dateRange
 */
export const qk = {
  envelope: () => ['envelope'] as const,
  budgets: () => ['budgets'] as const,
  income: (budgetId: string) => ['income', budgetId] as const,
  bills: (budgetId: string) => ['bills', budgetId] as const,
  periods: (budgetId: string) => ['periods', budgetId] as const,
  paid: (budgetId: string) => ['paid', budgetId] as const,
  meta: (budgetId: string) => ['meta', budgetId] as const,
};
