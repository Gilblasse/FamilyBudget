import { describe, it, expect } from 'vitest';
import { buildBudgetContext } from './context';
import type { Bill, BudgetSnapshot, Income } from '@/lib/types';

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

const snapshot: BudgetSnapshot = {
  balance: 1000,
  income: [
    income({ id: 'inrange', date: '2026-05-10', amount: 500, cadence: 'once' }),
    income({ id: 'outside', date: '2026-04-10', amount: 200, cadence: 'once' }),
    income({
      id: 'biweekly',
      date: '2026-05-01',
      amount: 300,
      cadence: 'biweekly',
    }),
  ],
  bills: [
    bill({ id: 'inrange', date: '2026-05-15', amount: 100 }),
    bill({ id: 'outside', date: '2026-04-15', amount: 80 }),
  ],
  paid: {
    inc_inrange: true,
    bill_inrange: true,
    bill_outside: true, // stale: bill_outside isn't in range, key should drop
    inc_stale_id: true, // stale: no matching income, key should drop
  },
  periods: [{ id: 'p1', startDate: '2026-04-01', endDate: '2026-05-31' }],
  activePeriodId: 'p1',
  dateRange: { start: '2026-05-01', end: '2026-05-31' },
};

describe('buildBudgetContext — range-first matches visible UI', () => {
  it('expandedIncome contains only occurrences inside the selected range', () => {
    const ctx = buildBudgetContext(snapshot)!;
    expect(ctx).not.toBeNull();
    const dates = ctx.expandedIncome.map((o) => o.date).sort();
    // 'in-range' (May 10) + biweekly expansions (May 1, 15, 29). 'outside' excluded.
    expect(dates).toEqual(['2026-05-01', '2026-05-10', '2026-05-15', '2026-05-29']);
  });

  it('bills contain only those whose date is inside the range', () => {
    const ctx = buildBudgetContext(snapshot)!;
    expect(ctx.bills.map((b) => b.id)).toEqual(['inrange']);
  });

  it('strips paid entries whose keys do not correspond to a visible record', () => {
    const ctx = buildBudgetContext(snapshot)!;
    expect(ctx.paid['bill_outside']).toBeUndefined();
    expect(ctx.paid['inc_stale_id']).toBeUndefined();
    expect(ctx.paid['bill_inrange']).toBe(true);
  });

  it('incomeTotal equals the sum of expandedIncome amounts', () => {
    const ctx = buildBudgetContext(snapshot)!;
    const expectedTotal = ctx.expandedIncome.reduce((s, r) => s + r.amount, 0);
    expect(ctx.totals.incomeTotal).toBe(expectedTotal);
  });

  it('netPosition = balance + incomeTotal - activeBillsTotal', () => {
    const ctx = buildBudgetContext(snapshot)!;
    expect(ctx.totals.netPosition).toBe(
      snapshot.balance + ctx.totals.incomeTotal - ctx.totals.activeBillsTotal,
    );
  });

  it('falls back to active period bounds when dateRange is null', () => {
    const ctx = buildBudgetContext({ ...snapshot, dateRange: null })!;
    expect(ctx.dateRange).toEqual({
      start: '2026-04-01',
      end: '2026-05-31',
    });
    // Now both once-only incomes are inside the period.
    const ids = ctx.expandedIncome.map((o) => o.source);
    expect(ids).toContain('src-inrange');
    expect(ids).toContain('src-outside');
  });
});
