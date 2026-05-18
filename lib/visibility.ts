import type { Bill, DateRange, Income } from './types';
import { inRange } from './filters';
import { expandIncomeOccurrences } from './recurrence';

export function visibleIncomeSources(
  income: Income[],
  range: DateRange | null,
): Income[] {
  // Mirror expandAllIncome(_, null) === "everything passes". A null range only
  // happens when there is no active period AND no user picker selection.
  if (!range) return income;
  return income.filter((r) => expandIncomeOccurrences(r, range).length > 0);
}

export function visibleBills(bills: Bill[], range: DateRange | null): Bill[] {
  return bills.filter((b) => inRange(b.date, range));
}
