import { describe, it, expect } from 'vitest';
import {
  ADJ_LABEL_SUFFIX,
  confirmedIncomeTotal,
  confirmedIncomeTotalWithAdj,
  criticalUnpaidBills,
  effectivePlanned,
  endingBalance,
  incomeAdjEntries,
  isActiveBill,
  isImportantBill,
  isPaid,
  isReceivedIncome,
  openingBalanceEntry,
  pendingIncomeCount,
  scopedIncomeWithAdj,
  sumAdj,
  variance,
} from './derived';
import type {
  Adjustment,
  Bill,
  Income,
  IncomeOccurrence,
  PaidState,
} from './types';

describe('openingBalanceEntry', () => {
  it('returns null for exactly zero (no row to display)', () => {
    expect(openingBalanceEntry(0, '2026-05-01')).toBeNull();
  });

  it('returns a positive entry for positive balance', () => {
    expect(openingBalanceEntry(100, '2026-05-01')).toEqual({
      amount: 100,
      date: '2026-05-01',
      label: 'Opening bank balance',
    });
  });

  it('returns a negative entry for negative balance (overdraft) — the bug the deep-dive flagged', () => {
    expect(openingBalanceEntry(-100, '2026-05-01')).toEqual({
      amount: -100,
      date: '2026-05-01',
      label: 'Opening bank balance (overdraft)',
    });
  });

  it('returns null for non-finite balance defensively', () => {
    expect(openingBalanceEntry(Number.NaN, '2026-05-01')).toBeNull();
    expect(openingBalanceEntry(Number.POSITIVE_INFINITY, '2026-05-01')).toBeNull();
  });
});

describe('endingBalance', () => {
  const income = [{ amount: 1000 }, { amount: 500 }];
  const bills = [{ amount: 800 }, { amount: 200 }];

  it('sums correctly for positive opening balance', () => {
    expect(
      endingBalance({ openingBalance: 100, scopedIncome: income, scopedBills: bills }),
    ).toBe(600); // 100 + 1500 - 1000
  });

  it('starts from zero opening balance', () => {
    expect(
      endingBalance({ openingBalance: 0, scopedIncome: income, scopedBills: bills }),
    ).toBe(500);
  });

  it('handles negative opening balance (overdraft)', () => {
    expect(
      endingBalance({ openingBalance: -100, scopedIncome: income, scopedBills: bills }),
    ).toBe(400); // -100 + 1500 - 1000
  });
});

describe('consistency across views', () => {
  // The bug the deep-dive flagged: Summary, Cash Flow, and Trial Balance disagreed
  // on the opening contribution for non-positive balances. These pin the invariant
  // that endingBalance() == (openingBalanceEntry?.amount ?? 0) + income − bills.
  function consistencyCheck(balance: number) {
    const income = [{ amount: 200 }];
    const bills = [{ amount: 50 }];
    const ending = endingBalance({
      openingBalance: balance,
      scopedIncome: income,
      scopedBills: bills,
    });
    const entry = openingBalanceEntry(balance, '2026-05-01');
    const fromEntry =
      (entry?.amount ?? 0) +
      income.reduce((s, r) => s + r.amount, 0) -
      bills.reduce((s, b) => s + b.amount, 0);
    return { ending, fromEntry };
  }

  it('positive opening: ending = +100 + 200 − 50 = 250', () => {
    const { ending, fromEntry } = consistencyCheck(100);
    expect(ending).toBe(250);
    expect(fromEntry).toBe(ending);
  });

  it('zero opening: ending = 0 + 200 − 50 = 150 (opening entry is null)', () => {
    const { ending, fromEntry } = consistencyCheck(0);
    expect(ending).toBe(150);
    expect(fromEntry).toBe(ending);
  });

  it('overdraft opening: ending = −100 + 200 − 50 = 50', () => {
    const { ending, fromEntry } = consistencyCheck(-100);
    expect(ending).toBe(50);
    expect(fromEntry).toBe(ending);
  });
});

describe('isReceivedIncome', () => {
  it('returns true for received and confirmed', () => {
    expect(isReceivedIncome({ status: 'received' })).toBe(true);
    expect(isReceivedIncome({ status: 'confirmed' })).toBe(true);
  });

  it('returns false for pending and expected', () => {
    expect(isReceivedIncome({ status: 'pending' })).toBe(false);
    expect(isReceivedIncome({ status: 'expected' })).toBe(false);
  });
});

describe('isImportantBill', () => {
  it('returns true for crit and imp', () => {
    expect(isImportantBill({ priority: 'crit' })).toBe(true);
    expect(isImportantBill({ priority: 'imp' })).toBe(true);
  });

  it('returns false for opt and flex', () => {
    expect(isImportantBill({ priority: 'opt' })).toBe(false);
    expect(isImportantBill({ priority: 'flex' })).toBe(false);
  });
});

describe('isActiveBill', () => {
  it('returns true for pay-full, partial, reduce', () => {
    expect(isActiveBill({ action: 'pay-full' })).toBe(true);
    expect(isActiveBill({ action: 'partial' })).toBe(true);
    expect(isActiveBill({ action: 'reduce' })).toBe(true);
  });

  it('returns false for skip and delay', () => {
    expect(isActiveBill({ action: 'skip' })).toBe(false);
    expect(isActiveBill({ action: 'delay' })).toBe(false);
  });
});

describe('pendingIncomeCount', () => {
  it('counts only status === pending', () => {
    expect(
      pendingIncomeCount([
        { status: 'pending' },
        { status: 'pending' },
        { status: 'expected' },
        { status: 'received' },
        { status: 'confirmed' },
      ]),
    ).toBe(2);
  });
});

describe('isPaid', () => {
  const paid: PaidState = { 'bill_a': true, 'bill_b': false };

  it('returns true only for keys explicitly set to true', () => {
    expect(isPaid(paid, 'bill_a')).toBe(true);
    expect(isPaid(paid, 'bill_b')).toBe(false);
    expect(isPaid(paid, 'bill_missing')).toBe(false);
  });
});

describe('criticalUnpaidBills', () => {
  const bills: Bill[] = [
    {
      id: 'c1',
      periodId: 'p',
      name: 'Critical unpaid',
      date: '2026-05-01',
      amount: 100,
      priority: 'crit',
      action: 'pay-full',
    },
    {
      id: 'c2',
      periodId: 'p',
      name: 'Critical paid',
      date: '2026-05-02',
      amount: 200,
      priority: 'crit',
      action: 'pay-full',
    },
    {
      id: 'c3',
      periodId: 'p',
      name: 'Critical skipped',
      date: '2026-05-03',
      amount: 300,
      priority: 'crit',
      action: 'skip',
    },
    {
      id: 'i1',
      periodId: 'p',
      name: 'Important unpaid',
      date: '2026-05-04',
      amount: 50,
      priority: 'imp',
      action: 'pay-full',
    },
  ];
  const paid: PaidState = { bill_c2: true };

  it('returns crit bills that are active and not paid', () => {
    const out = criticalUnpaidBills(bills, paid);
    expect(out.map((b) => b.id)).toEqual(['c1']);
  });

  it('does not include important bills', () => {
    expect(criticalUnpaidBills(bills, paid).every((b) => b.priority === 'crit')).toBe(true);
  });

  it('does not include skipped/delayed bills', () => {
    expect(criticalUnpaidBills(bills, paid).every((b) => b.action !== 'skip')).toBe(true);
  });
});

describe('sumAdj', () => {
  it('returns 0 for undefined / empty', () => {
    expect(sumAdj(undefined)).toBe(0);
    expect(sumAdj([])).toBe(0);
  });

  it('sums signed amounts', () => {
    const adj: Adjustment[] = [
      { id: 'a1', amount: 10 },
      { id: 'a2', amount: -3, note: 'refund' },
      { id: 'a3', amount: 5 },
    ];
    expect(sumAdj(adj)).toBe(12);
  });

  it('skips non-finite entries (half-typed input)', () => {
    const adj: Adjustment[] = [
      { id: 'a1', amount: 10 },
      { id: 'a2', amount: Number.NaN },
      { id: 'a3', amount: Number.POSITIVE_INFINITY },
      { id: 'a4', amount: -2 },
    ];
    expect(sumAdj(adj)).toBe(8);
  });
});

describe('effectivePlanned', () => {
  it('returns amount when adjustments are missing', () => {
    expect(effectivePlanned({ amount: 100 })).toBe(100);
    expect(effectivePlanned({ amount: 100, adjustments: [] })).toBe(100);
  });

  it('adds signed adjustments to amount', () => {
    expect(
      effectivePlanned({
        amount: 100,
        adjustments: [
          { id: 'a', amount: 25 },
          { id: 'b', amount: -10 },
        ],
      }),
    ).toBe(115);
  });

  it('can go negative when adjustments overshoot', () => {
    expect(
      effectivePlanned({
        amount: 50,
        adjustments: [{ id: 'a', amount: -75 }],
      }),
    ).toBe(-25);
  });
});

describe('variance', () => {
  it('matches sumAdj', () => {
    const adjustments: Adjustment[] = [
      { id: 'a', amount: 12 },
      { id: 'b', amount: -4 },
    ];
    expect(variance({ adjustments })).toBe(8);
    expect(variance({})).toBe(0);
  });
});

describe('incomeAdjEntries', () => {
  const baseIncome = (id: string, date: string, adjustments?: Adjustment[]): Income => ({
    id,
    periodId: 'p1',
    source: `Source ${id}`,
    date,
    amount: 1000,
    status: 'expected',
    cadence: 'once',
    ...(adjustments ? { adjustments } : {}),
  });

  it('emits one entry per source whose anchor date is in range', () => {
    const income: Income[] = [
      baseIncome('a', '2026-05-10', [{ id: 'x', amount: 50 }]),
      baseIncome('b', '2026-05-15', [{ id: 'y', amount: -20, note: 'shortfall' }]),
    ];
    const entries = incomeAdjEntries(income, { start: '2026-05-01', end: '2026-05-31' });
    expect(entries).toEqual([
      { id: 'a', source: 'Source a', date: '2026-05-10', amount: 50 },
      { id: 'b', source: 'Source b', date: '2026-05-15', amount: -20 },
    ]);
  });

  it('omits sources whose anchor date falls outside the range', () => {
    const income: Income[] = [
      baseIncome('a', '2026-04-30', [{ id: 'x', amount: 50 }]),
      baseIncome('b', '2026-06-01', [{ id: 'y', amount: 75 }]),
    ];
    const entries = incomeAdjEntries(income, { start: '2026-05-01', end: '2026-05-31' });
    expect(entries).toEqual([]);
  });

  it('omits sources with net-zero adjustments', () => {
    const income: Income[] = [
      baseIncome('a', '2026-05-10', [
        { id: 'x', amount: 50 },
        { id: 'y', amount: -50 },
      ]),
    ];
    expect(incomeAdjEntries(income, { start: '2026-05-01', end: '2026-05-31' })).toEqual([]);
  });

  it('emits all in-period entries when range is null', () => {
    const income: Income[] = [
      baseIncome('a', '2026-05-10', [{ id: 'x', amount: 50 }]),
      baseIncome('b', '2026-12-31', [{ id: 'y', amount: 75 }]),
    ];
    expect(incomeAdjEntries(income, null)).toHaveLength(2);
  });
});

describe('ADJ_LABEL_SUFFIX', () => {
  it('matches the documented format', () => {
    expect(ADJ_LABEL_SUFFIX).toBe(' (adjustment)');
  });
});

describe('scopedIncomeWithAdj', () => {
  const mk = (id: string, amount: number, adj?: Adjustment[]): Income => ({
    id,
    periodId: 'p1',
    source: `S-${id}`,
    date: '2026-05-10',
    amount,
    status: 'expected',
    cadence: 'once',
    ...(adj ? { adjustments: adj } : {}),
  });

  it('returns occurrence sum + adjustment sum', () => {
    const income: Income[] = [
      mk('a', 1000, [{ id: 'x', amount: 50 }]),
      mk('b', 200),
    ];
    expect(scopedIncomeWithAdj(income, { start: '2026-05-01', end: '2026-05-31' })).toBe(1250);
  });

  it('excludes out-of-range sources entirely', () => {
    const income: Income[] = [mk('a', 1000, [{ id: 'x', amount: 50 }])];
    expect(scopedIncomeWithAdj(income, { start: '2026-06-01', end: '2026-06-30' })).toBe(0);
  });
});

describe('confirmedIncomeTotalWithAdj', () => {
  const mk = (
    id: string,
    status: 'expected' | 'confirmed' | 'pending' | 'received',
    amount: number,
    adj?: Adjustment[],
    date = '2026-05-10',
  ): Income => ({
    id,
    periodId: 'p1',
    source: `S-${id}`,
    date,
    amount,
    status,
    cadence: 'once',
    ...(adj ? { adjustments: adj } : {}),
  });

  it('sums received + confirmed occurrences and adjustments', () => {
    const income: Income[] = [
      mk('a', 'received', 1000, [{ id: 'x', amount: 50 }]),
      mk('b', 'confirmed', 200, [{ id: 'y', amount: -10 }]),
      mk('c', 'pending', 999, [{ id: 'z', amount: 100 }]),
      mk('d', 'expected', 999),
    ];
    expect(
      confirmedIncomeTotalWithAdj(income, { start: '2026-05-01', end: '2026-05-31' }),
    ).toBe(1240);
  });

  it('drops adjustments on out-of-range received sources', () => {
    const income: Income[] = [
      mk('a', 'received', 0, [{ id: 'x', amount: 50 }], '2026-04-30'),
    ];
    expect(
      confirmedIncomeTotalWithAdj(income, { start: '2026-05-01', end: '2026-05-31' }),
    ).toBe(0);
  });
});

describe('confirmedIncomeTotal', () => {
  const occ = (status: IncomeOccurrence['status'], amount: number): IncomeOccurrence => ({
    incomeId: 'i',
    periodId: 'p',
    source: 's',
    amount,
    status,
    cadence: 'once',
    date: '2026-05-01',
    key: `k-${amount}`,
    isRecurring: false,
  });

  it('sums received + confirmed only', () => {
    expect(
      confirmedIncomeTotal([
        occ('received', 100),
        occ('confirmed', 50),
        occ('pending', 999),
        occ('expected', 999),
      ]),
    ).toBe(150);
  });
});
