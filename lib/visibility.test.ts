import { describe, it, expect } from 'vitest';
import { visibleBills, visibleIncomeSources } from './visibility';
import { expandAllIncome } from './recurrence';
import type { Bill, DateRange, Income } from './types';

function income(partial: Partial<Income> & Pick<Income, 'id' | 'date'>): Income {
  return {
    periodId: partial.periodId ?? 'p1',
    source: partial.source ?? `src-${partial.id}`,
    amount: partial.amount ?? 100,
    status: partial.status ?? 'expected',
    cadence: partial.cadence,
    secondDay: partial.secondDay,
    endDate: partial.endDate,
    ...partial,
  };
}

function bill(partial: Partial<Bill> & Pick<Bill, 'id' | 'date'>): Bill {
  return {
    periodId: partial.periodId ?? 'p1',
    name: partial.name ?? `bill-${partial.id}`,
    amount: partial.amount ?? 50,
    priority: partial.priority ?? 'imp',
    action: partial.action ?? 'pay-full',
    ...partial,
  };
}

const range = (start: string, end: string): DateRange => ({ start, end });

const incomes: Income[] = [
  income({ id: 'inside', date: '2026-05-10', amount: 1000, cadence: 'once' }),
  income({ id: 'before', date: '2026-04-10', amount: 500, cadence: 'once' }),
  income({ id: 'after', date: '2026-06-10', amount: 700, cadence: 'once' }),
  income({
    id: 'biweekly',
    date: '2026-05-01',
    amount: 250,
    cadence: 'biweekly',
  }),
  // Cross-period record — belongs to a different period but its date falls in our
  // test range; range-first means it should still be visible.
  income({
    id: 'cross-period',
    periodId: 'p-other',
    date: '2026-05-20',
    amount: 333,
    cadence: 'once',
  }),
];

const bills: Bill[] = [
  bill({ id: 'inside', date: '2026-05-15', amount: 200 }),
  bill({ id: 'before', date: '2026-04-15', amount: 100 }),
  bill({ id: 'after', date: '2026-06-15', amount: 150 }),
  bill({
    id: 'cross-period',
    periodId: 'p-other',
    date: '2026-05-22',
    amount: 80,
  }),
];

describe('visibleIncomeSources', () => {
  it('returns once-only sources whose date is in range', () => {
    const out = visibleIncomeSources(incomes, range('2026-05-01', '2026-05-31'));
    const ids = out.map((r) => r.id).sort();
    // 'inside' and 'cross-period' (date inside) + 'biweekly' (has occurrences)
    expect(ids).toEqual(['biweekly', 'cross-period', 'inside']);
  });

  it('returns everything for null range (no period, no picker)', () => {
    expect(visibleIncomeSources(incomes, null)).toEqual(incomes);
  });

  it('excludes sources whose every occurrence is outside the range', () => {
    const out = visibleIncomeSources(incomes, range('2026-07-01', '2026-07-31'));
    // biweekly anchor is May 1 with no endDate → keeps generating; should still
    // produce occurrences in July.
    expect(out.map((r) => r.id)).toContain('biweekly');
    expect(out.map((r) => r.id)).not.toContain('inside');
    expect(out.map((r) => r.id)).not.toContain('before');
    expect(out.map((r) => r.id)).not.toContain('after');
  });
});

describe('visibleBills', () => {
  it('returns bills whose date is in range, ignoring periodId', () => {
    const out = visibleBills(bills, range('2026-05-01', '2026-05-31'));
    const ids = out.map((b) => b.id).sort();
    expect(ids).toEqual(['cross-period', 'inside']);
  });

  it('returns everything for null range', () => {
    expect(visibleBills(bills, null)).toEqual(bills);
  });
});

describe('totals/tables agreement (the original bug invariant)', () => {
  it('income table sources match the sources that produce dashboard totals', () => {
    const r = range('2026-05-01', '2026-05-31');
    const tableSources = visibleIncomeSources(incomes, r);
    const dashboardOccurrences = expandAllIncome(incomes, r);
    // Every dashboard occurrence must come from a source the table also shows.
    const tableIds = new Set(tableSources.map((s) => s.id));
    for (const occ of dashboardOccurrences) {
      expect(tableIds.has(occ.incomeId)).toBe(true);
    }
    // And every table source must produce at least one occurrence in range.
    const occurrenceSourceIds = new Set(dashboardOccurrences.map((o) => o.incomeId));
    for (const src of tableSources) {
      expect(occurrenceSourceIds.has(src.id)).toBe(true);
    }
  });

  it('bills table rows are exactly the rows summed into the expense total', () => {
    const r = range('2026-05-01', '2026-05-31');
    const tableBills = visibleBills(bills, r);
    const expenseTotal = tableBills.reduce((s, b) => s + b.amount, 0);
    // Recompute the same way the expense card does and compare.
    const cardTotal = bills
      .filter((b) =>
        b.date >= r.start && b.date <= r.end,
      )
      .reduce((s, b) => s + b.amount, 0);
    expect(expenseTotal).toBe(cardTotal);
    expect(tableBills.map((b) => b.id).sort()).toEqual([
      'cross-period',
      'inside',
    ]);
  });

  it('cross-period range includes records owned by multiple periods', () => {
    const r = range('2026-04-01', '2026-06-30');
    const sources = visibleIncomeSources(incomes, r);
    expect(sources.map((s) => s.periodId)).toContain('p-other');
    expect(visibleBills(bills, r).map((b) => b.periodId)).toContain('p-other');
  });

  it('range fully outside all data yields empty totals AND empty tables (consistency)', () => {
    // Use a bounded set so the unbounded biweekly source doesn't keep generating
    // occurrences forever — this assertion is about the once-only invariant.
    const onceOnlyIncomes: Income[] = incomes.filter(
      (r) => (r.cadence ?? 'once') === 'once',
    );
    const onceOnlyBills: Bill[] = bills;
    const r = range('2027-01-01', '2027-01-31');
    expect(visibleIncomeSources(onceOnlyIncomes, r)).toEqual([]);
    expect(visibleBills(onceOnlyBills, r)).toEqual([]);
    expect(expandAllIncome(onceOnlyIncomes, r)).toEqual([]);
  });
});
