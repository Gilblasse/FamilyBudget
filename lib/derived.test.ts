import { describe, it, expect } from 'vitest';
import {
  confirmedIncomeTotal,
  criticalUnpaidBills,
  endingBalance,
  isActiveBill,
  isImportantBill,
  isPaid,
  isReceivedIncome,
  openingBalanceEntry,
  pendingIncomeCount,
} from './derived';
import type { Bill, IncomeOccurrence, PaidState } from './types';

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
