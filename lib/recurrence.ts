import type { DateRange, Income, IncomeOccurrence } from './types';
import { addDaysIso, fromIso } from './date-utils';
import { inRange } from './filters';

const MAX_OCCURRENCES = 5000;

export function occurrenceKey(income: Income, dateIso: string): string {
  const cadence = income.cadence ?? 'once';
  return cadence === 'once' ? `inc_${income.id}` : `inc_${income.id}_${dateIso}`;
}

function buildOccurrence(income: Income, dateIso: string): IncomeOccurrence {
  const cadence = income.cadence ?? 'once';
  return {
    incomeId: income.id,
    periodId: income.periodId,
    source: income.source,
    amount: income.amount,
    status: income.status,
    cadence,
    date: dateIso,
    key: occurrenceKey(income, dateIso),
    isRecurring: cadence !== 'once',
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  // monthIndex is 0-based; passing day 0 of next month yields last day of this month.
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampedMonthDay(year: number, monthIndex: number, day: number): string {
  const clamped = Math.min(Math.max(1, day), daysInMonth(year, monthIndex));
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(clamped).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function expandIncomeOccurrences(income: Income, range: DateRange): IncomeOccurrence[] {
  const cadence = income.cadence ?? 'once';
  const anchor = income.date;
  if (!anchor) return [];

  const cutoff = income.endDate && income.endDate < range.end ? income.endDate : range.end;
  if (cutoff < range.start) return [];

  if (cadence === 'once') {
    return inRange(anchor, range) && (!income.endDate || anchor <= income.endDate)
      ? [buildOccurrence(income, anchor)]
      : [];
  }

  const out: IncomeOccurrence[] = [];

  if (cadence === 'weekly' || cadence === 'biweekly') {
    const step = cadence === 'weekly' ? 7 : 14;
    let cursor = anchor;
    // Fast-forward to range.start if anchor is before it.
    if (cursor < range.start) {
      const anchorDate = fromIso(cursor);
      const rangeStartDate = fromIso(range.start);
      const diffDays = Math.floor(
        (rangeStartDate.getTime() - anchorDate.getTime()) / 86400000,
      );
      const skip = Math.floor(diffDays / step);
      if (skip > 0) cursor = addDaysIso(cursor, skip * step);
    }
    let i = 0;
    while (cursor <= cutoff && i < MAX_OCCURRENCES) {
      if (cursor >= range.start) out.push(buildOccurrence(income, cursor));
      cursor = addDaysIso(cursor, step);
      i++;
    }
    return out;
  }

  if (cadence === 'monthly') {
    const anchorDate = fromIso(anchor);
    const anchorDay = anchorDate.getDate();
    let year = anchorDate.getFullYear();
    let monthIndex = anchorDate.getMonth();
    let i = 0;
    while (i < MAX_OCCURRENCES) {
      const iso = clampedMonthDay(year, monthIndex, anchorDay);
      if (iso > cutoff) break;
      if (iso >= range.start && iso >= anchor) out.push(buildOccurrence(income, iso));
      monthIndex++;
      if (monthIndex > 11) {
        monthIndex = 0;
        year++;
      }
      i++;
    }
    return out;
  }

  if (cadence === 'semimonthly') {
    const anchorDate = fromIso(anchor);
    const anchorDay = anchorDate.getDate();
    const second = income.secondDay ?? 28;
    const days = Array.from(new Set([anchorDay, second])).sort((a, b) => a - b);
    let year = anchorDate.getFullYear();
    let monthIndex = anchorDate.getMonth();
    let i = 0;
    while (i < MAX_OCCURRENCES) {
      let stop = false;
      for (const day of days) {
        const iso = clampedMonthDay(year, monthIndex, day);
        if (iso > cutoff) {
          stop = true;
          break;
        }
        if (iso >= range.start && iso >= anchor) out.push(buildOccurrence(income, iso));
        i++;
        if (i >= MAX_OCCURRENCES) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      monthIndex++;
      if (monthIndex > 11) {
        monthIndex = 0;
        year++;
      }
    }
    return out;
  }

  return out;
}

export function expandAllIncome(
  incomes: Income[],
  range: DateRange | null,
): IncomeOccurrence[] {
  if (!range) {
    // Parity with the old inRange(date, null) === true semantics: no range
    // means "everything passes" — emit one occurrence per template at its anchor.
    return incomes
      .filter((r) => !!r.date)
      .map((r) => buildOccurrence(r, r.date))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  const out: IncomeOccurrence[] = [];
  for (const income of incomes) {
    const expanded = expandIncomeOccurrences(income, range);
    for (const occ of expanded) out.push(occ);
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

