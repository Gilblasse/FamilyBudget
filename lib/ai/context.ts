import type {
  Bill,
  BudgetPeriod,
  BudgetSnapshot,
  DateRange,
  Income,
  IncomeCadence,
  IncomeOccurrence,
  PaidState,
} from '@/lib/types';
import { inRange } from '@/lib/filters';
import { expandAllIncome } from '@/lib/recurrence';

export interface RecurringIncomeSource {
  incomeId: string;
  source: string;
  cadence: IncomeCadence;
  anchorDate: string;
  amount: number;
  secondDay?: number;
  endDate?: string;
}

export interface BudgetContext {
  balance: number;
  periods: BudgetPeriod[];
  dateRange: DateRange;
  income: Income[];
  expandedIncome: IncomeOccurrence[];
  recurringSources: RecurringIncomeSource[];
  bills: Bill[];
  paid: PaidState;
  totals: {
    incomeTotal: number;
    activeBillsTotal: number;
    netPosition: number;
  };
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function buildBudgetContext(snapshot: BudgetSnapshot): BudgetContext | null {
  let effectiveRange: DateRange | null = snapshot.dateRange ?? null;
  if (!effectiveRange) {
    const active = snapshot.periods.find((p) => p.id === snapshot.activePeriodId);
    if (active) effectiveRange = { start: active.startDate, end: active.endDate };
  }
  if (!effectiveRange) return null;

  const periods = snapshot.periods
    .filter((p) => rangesOverlap({ start: p.startDate, end: p.endDate }, effectiveRange))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const incomeTemplates = snapshot.income.filter(
    (r) => (r.cadence ?? 'once') !== 'once' || inRange(r.date, effectiveRange),
  );
  const expandedIncome = expandAllIncome(snapshot.income, effectiveRange);
  const bills = snapshot.bills.filter((b) => inRange(b.date, effectiveRange));

  const recurringSources: RecurringIncomeSource[] = snapshot.income
    .filter((r) => (r.cadence ?? 'once') !== 'once')
    .map((r) => ({
      incomeId: r.id,
      source: r.source,
      cadence: r.cadence ?? 'once',
      anchorDate: r.date,
      amount: r.amount,
      secondDay: r.secondDay,
      endDate: r.endDate,
    }));

  const allowedKeys = new Set<string>([
    ...expandedIncome.map((o) => o.key),
    ...bills.map((b) => `bill_${b.id}`),
  ]);
  const paid: PaidState = {};
  for (const [k, v] of Object.entries(snapshot.paid)) {
    if (allowedKeys.has(k)) paid[k] = v;
  }

  const incomeTotal = expandedIncome.reduce((s, r) => s + r.amount, 0);
  const activeBillsTotal = bills
    .filter((b) => b.action !== 'skip' && b.action !== 'delay')
    .reduce((s, b) => s + b.amount, 0);
  const netPosition = snapshot.balance + incomeTotal - activeBillsTotal;

  return {
    balance: snapshot.balance,
    periods,
    dateRange: effectiveRange,
    income: incomeTemplates,
    expandedIncome,
    recurringSources,
    bills,
    paid,
    totals: { incomeTotal, activeBillsTotal, netPosition },
  };
}

export function contextAsPromptJson(ctx: BudgetContext): string {
  return JSON.stringify(ctx, null, 2);
}
