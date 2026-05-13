import type { BudgetPeriod, DateRange } from './types';

export function inRange(date: string, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}

export function filterByRange<T extends { date: string }>(
  rows: T[],
  range: DateRange | null,
): T[] {
  if (!range) return rows;
  return rows.filter((r) => inRange(r.date, range));
}

export function clampRangeToPeriod(
  range: DateRange | null,
  period: BudgetPeriod | undefined | null,
): DateRange | null {
  if (!period) return null;
  if (!range) return { start: period.startDate, end: period.endDate };
  const start = range.start < period.startDate ? period.startDate : range.start;
  const end = range.end > period.endDate ? period.endDate : range.end;
  if (start > end) return { start: period.startDate, end: period.endDate };
  return { start, end };
}
