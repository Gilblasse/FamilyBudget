import { describe, it, expect } from 'vitest';
import { dedupeBills, dedupeIncome } from './dedupe';
import type { Bill, Income, PaidState } from './types';

function bill(overrides: Partial<Bill> & { id: string }): Bill {
  return {
    periodId: 'p1',
    name: 'Rent',
    date: '2026-05-01',
    amount: 1500,
    priority: 'imp',
    action: 'pay-full',
    ...overrides,
  };
}

function income(overrides: Partial<Income> & { id: string }): Income {
  return {
    periodId: 'p1',
    source: 'Paycheck',
    date: '2026-05-15',
    amount: 2400,
    status: 'expected',
    cadence: 'once',
    ...overrides,
  };
}

describe('dedupeBills', () => {
  it('returns empty result for empty input', () => {
    const res = dedupeBills([]);
    expect(res.rows).toEqual([]);
    expect(res.removed).toBe(0);
    expect(res.paid).toEqual({});
  });

  it('keeps all rows when none are duplicates', () => {
    const bills = [
      bill({ id: 'a' }),
      bill({ id: 'b', name: 'Electric' }),
      bill({ id: 'c', amount: 99 }),
    ];
    const res = dedupeBills(bills);
    expect(res.rows).toHaveLength(3);
    expect(res.removed).toBe(0);
  });

  it('collapses duplicates by name+date+amount, keeping first', () => {
    const bills = [
      bill({ id: 'keep' }),
      bill({ id: 'drop' }),
    ];
    const res = dedupeBills(bills);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('keep');
    expect(res.removed).toBe(1);
  });

  it('normalizes name via trim + lowercase', () => {
    const bills = [
      bill({ id: 'a', name: ' Rent ' }),
      bill({ id: 'b', name: 'rent' }),
      bill({ id: 'c', name: 'RENT' }),
    ];
    const res = dedupeBills(bills);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('a');
    expect(res.removed).toBe(2);
  });

  it('treats different dates or amounts as distinct', () => {
    const bills = [
      bill({ id: 'a' }),
      bill({ id: 'b', date: '2026-05-02' }),
      bill({ id: 'c', amount: 1500.01 }),
    ];
    const res = dedupeBills(bills);
    expect(res.rows).toHaveLength(3);
    expect(res.removed).toBe(0);
  });

  it('OR-merges paid flags onto the kept row', () => {
    const bills = [bill({ id: 'keep' }), bill({ id: 'drop' })];
    const paid: PaidState = { bill_drop: true };
    const res = dedupeBills(bills, paid);
    expect(res.paid).toEqual({ bill_keep: true });
  });

  it('keeps unrelated paid keys untouched', () => {
    const bills = [bill({ id: 'a' })];
    const paid: PaidState = { inc_xyz: true, bill_a: true };
    const res = dedupeBills(bills, paid);
    expect(res.paid).toEqual({ inc_xyz: true, bill_a: true });
  });
});

describe('dedupeIncome', () => {
  it('returns empty result for empty input', () => {
    const res = dedupeIncome([]);
    expect(res.rows).toEqual([]);
    expect(res.removed).toBe(0);
  });

  it('collapses duplicates by source+date+amount+cadence', () => {
    const rows = [income({ id: 'keep' }), income({ id: 'drop' })];
    const res = dedupeIncome(rows);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('keep');
    expect(res.removed).toBe(1);
  });

  it('keeps rows distinct when cadence differs', () => {
    const rows = [
      income({ id: 'once' }),
      income({ id: 'monthly', cadence: 'monthly' }),
    ];
    const res = dedupeIncome(rows);
    expect(res.rows).toHaveLength(2);
    expect(res.removed).toBe(0);
  });

  it('treats missing cadence as "once"', () => {
    const rows = [
      income({ id: 'a', cadence: undefined }),
      income({ id: 'b', cadence: 'once' }),
    ];
    const res = dedupeIncome(rows);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('a');
  });

  it('normalizes source via trim + lowercase', () => {
    const rows = [
      income({ id: 'a', source: ' Paycheck ' }),
      income({ id: 'b', source: 'paycheck' }),
    ];
    const res = dedupeIncome(rows);
    expect(res.rows).toHaveLength(1);
  });

  it('remaps recurring per-occurrence paid keys to the kept id', () => {
    const rows = [
      income({ id: 'keep', cadence: 'monthly' }),
      income({ id: 'drop', cadence: 'monthly' }),
    ];
    const paid: PaidState = {
      inc_drop: true,
      'inc_drop_2026-05-15-1': true,
      'inc_drop_2026-06-15-1': true,
    };
    const res = dedupeIncome(rows, paid);
    expect(res.paid).toEqual({
      inc_keep: true,
      'inc_keep_2026-05-15-1': true,
      'inc_keep_2026-06-15-1': true,
    });
  });

  it('OR-merges occurrence keys when kept already had one true', () => {
    const rows = [income({ id: 'keep' }), income({ id: 'drop' })];
    const paid: PaidState = {
      'inc_keep_2026-05-15-1': false,
      'inc_drop_2026-05-15-1': true,
    };
    const res = dedupeIncome(rows, paid);
    expect(res.paid['inc_keep_2026-05-15-1']).toBe(true);
  });
});
