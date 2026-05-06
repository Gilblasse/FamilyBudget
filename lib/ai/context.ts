import type { Bill, BudgetPeriod, BudgetSnapshot, Income, PaidState } from '@/lib/types';

export interface BudgetContext {
  balance: number;
  period: BudgetPeriod;
  income: Income[];
  bills: Bill[];
  paid: PaidState;
  totals: {
    incomeTotal: number;
    activeBillsTotal: number;
    netPosition: number;
  };
}

export function buildBudgetContext(snapshot: BudgetSnapshot): BudgetContext | null {
  const period = snapshot.periods.find((p) => p.id === snapshot.activePeriodId);
  if (!period) return null;

  const income = snapshot.income.filter((r) => r.periodId === period.id);
  const bills = snapshot.bills.filter((b) => b.periodId === period.id);

  const billIds = new Set<string>([
    ...income.map((r) => `inc_${r.id}`),
    ...bills.map((b) => `bill_${b.id}`),
  ]);
  const paid: PaidState = {};
  for (const [k, v] of Object.entries(snapshot.paid)) {
    if (billIds.has(k)) paid[k] = v;
  }

  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
  const activeBillsTotal = bills
    .filter((b) => b.action !== 'skip' && b.action !== 'delay')
    .reduce((s, b) => s + b.amount, 0);
  const netPosition = snapshot.balance + incomeTotal - activeBillsTotal;

  return {
    balance: snapshot.balance,
    period,
    income,
    bills,
    paid,
    totals: { incomeTotal, activeBillsTotal, netPosition },
  };
}

export function contextAsPromptJson(ctx: BudgetContext): string {
  return JSON.stringify(ctx, null, 2);
}
