import { describe, it, expect } from 'vitest';
import {
  migrateBudgetState,
  STORE_VERSION,
  type BudgetData,
  type MultiBudgetSlice,
} from './store';
import type { Bill, Income } from './types';

/**
 * Migration-chain integration tests. Every persisted shape v(N) must roll
 * forward to STORE_VERSION without dropping fields or losing PaidState
 * keys. These tests are the safety net for future v(N+1) bumps — they
 * pin the contract that older clients can always recover.
 */

const TODAY_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function expectV8Shape(s: BudgetData & MultiBudgetSlice) {
  expect(typeof s.balance).toBe('number');
  expect(Array.isArray(s.income)).toBe(true);
  expect(Array.isArray(s.bills)).toBe(true);
  expect(s.paid).toBeTypeOf('object');
  expect(Array.isArray(s.periods)).toBe(true);
  expect(typeof s.activePeriodId).toBe('string');
  expect(Array.isArray(s.budgets)).toBe(true);
  expect(typeof s.activeBudgetId).toBe('string');
  // dateRange is null | { start, end }
  if (s.dateRange !== null) {
    expect(s.dateRange.start).toMatch(TODAY_ISO_PATTERN);
    expect(s.dateRange.end).toMatch(TODAY_ISO_PATTERN);
  }
  // Every income occurrence has a cadence (v6 invariant)
  for (const r of s.income) {
    expect(r.cadence).toBeDefined();
  }
  // Every budget has a defaultRange (v5 invariant)
  for (const b of s.budgets) {
    expect(b.defaultRange).toBeDefined();
    expect(b.defaultRange.start).toMatch(TODAY_ISO_PATTERN);
    expect(b.defaultRange.end).toMatch(TODAY_ISO_PATTERN);
  }
}

describe('migrateBudgetState — version chain', () => {
  it('STORE_VERSION is the latest migration target', () => {
    expect(STORE_VERSION).toBe(8);
  });

  it('v1 → v8: empty state hydrates into the canonical shape', () => {
    const v1: Partial<BudgetData> = {
      balance: 0,
      income: [],
      bills: [],
      paid: {},
    };
    const out = migrateBudgetState(v1, 1);
    expectV8Shape(out);
    // v2 invariant: every income/bill has periodId
    expect(out.activePeriodId).toBeTruthy();
    expect(out.periods.length).toBeGreaterThanOrEqual(1);
  });

  it('v1 → v8: rows without periodId get the seeded period (v2 invariant)', () => {
    const v1 = {
      balance: 100,
      income: [{ id: 'i1', source: 'wage', date: '2026-04-15', amount: 1000, status: 'expected' as const }],
      bills: [{ id: 'b1', name: 'rent', date: '2026-05-01', amount: 500, priority: 'crit' as const, action: 'pay-full' as const }],
      paid: {},
    };
    const out = migrateBudgetState(v1, 1);
    expect(out.income[0].periodId).toBe(out.activePeriodId);
    expect(out.bills[0].periodId).toBe(out.activePeriodId);
  });

  it('v3 → v8: existing dateRange survives intact', () => {
    const v3 = {
      balance: 0,
      income: [],
      bills: [],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: { start: '2026-04-15', end: '2026-04-30' },
    } as unknown as Partial<BudgetData>;
    const out = migrateBudgetState(v3, 3);
    expect(out.dateRange).toEqual({ start: '2026-04-15', end: '2026-04-30' });
  });

  it('v4 → v8: multi-budget slice is added (v4 invariant)', () => {
    const v4 = {
      balance: 0,
      income: [],
      bills: [],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
    } as unknown as Partial<BudgetData>;
    const out = migrateBudgetState(v4, 3);
    expect(out.budgets.length).toBeGreaterThanOrEqual(1);
    expect(out.activeBudgetId).toBeTruthy();
    expect(out.budgetData).toEqual({});
  });

  it('v5 → v8: budgets without defaultRange get one synthesized from the active period (v5 invariant)', () => {
    const v5 = {
      balance: 0,
      income: [],
      bills: [],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
      budgets: [{ id: 'b1', name: 'My', createdAt: '2026-01-01T00:00:00.000Z' }],
      activeBudgetId: 'b1',
      budgetData: {},
    } as unknown as Partial<BudgetData & MultiBudgetSlice>;
    const out = migrateBudgetState(v5, 4);
    expect(out.budgets[0].defaultRange).toEqual({
      start: '2026-04-09',
      end: '2026-05-14',
    });
  });

  it('v6 → v8: incomes without cadence get cadence=once (v6 invariant)', () => {
    const v6 = {
      balance: 0,
      income: [
        { id: 'i1', periodId: 'p1', source: 'wage', date: '2026-04-15', amount: 1000, status: 'expected' as const },
      ] as Income[],
      bills: [],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
      budgets: [
        { id: 'b1', name: 'My', createdAt: '2026-01-01T00:00:00.000Z', defaultRange: { start: '2026-04-09', end: '2026-05-14' } },
      ],
      activeBudgetId: 'b1',
      budgetData: {},
    } as unknown as Partial<BudgetData & MultiBudgetSlice>;
    const out = migrateBudgetState(v6, 5);
    expect(out.income[0].cadence).toBe('once');
  });

  it('v7 → v8: duplicate bills are deduped, paid keys remap (v7 invariant)', () => {
    const v6 = {
      balance: 0,
      income: [],
      bills: [
        { id: 'b1', periodId: 'p1', name: 'rent', date: '2026-05-01', amount: 500, priority: 'crit' as const, action: 'pay-full' as const },
        { id: 'b2', periodId: 'p1', name: 'rent', date: '2026-05-01', amount: 500, priority: 'crit' as const, action: 'pay-full' as const },
      ] as Bill[],
      paid: { bill_b2: true },
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
      budgets: [
        { id: 'b1', name: 'My', createdAt: '2026-01-01T00:00:00.000Z', defaultRange: { start: '2026-04-09', end: '2026-05-14' } },
      ],
      activeBudgetId: 'b1',
      budgetData: {},
    } as unknown as Partial<BudgetData & MultiBudgetSlice>;
    const out = migrateBudgetState(v6, 6);
    expect(out.bills.length).toBe(1);
    // The surviving bill should have inherited the `paid` true from the dedupe.
    const survivingKey = `bill_${out.bills[0].id}`;
    expect(out.paid[survivingKey]).toBe(true);
  });

  it('v7 → v8: existing subscription bills get tags=["subscription"] (v8 invariant)', () => {
    const v7 = {
      balance: 0,
      income: [],
      bills: [
        { id: 'b1', periodId: 'p1', name: 'Netflix subscription', date: '2026-05-01', amount: 20, priority: 'opt' as const, action: 'pay-full' as const },
        { id: 'b2', periodId: 'p1', name: 'Rent', date: '2026-05-01', amount: 500, priority: 'crit' as const, action: 'pay-full' as const },
      ] as Bill[],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
      budgets: [
        { id: 'b1', name: 'My', createdAt: '2026-01-01T00:00:00.000Z', defaultRange: { start: '2026-04-09', end: '2026-05-14' } },
      ],
      activeBudgetId: 'b1',
      budgetData: {},
    } as unknown as Partial<BudgetData & MultiBudgetSlice>;
    const out = migrateBudgetState(v7, 7);
    const netflix = out.bills.find((b) => b.name === 'Netflix subscription');
    const rent = out.bills.find((b) => b.name === 'Rent');
    expect(netflix?.tags).toContain('subscription');
    expect(rent?.tags ?? []).not.toContain('subscription');
  });

  it('v7 → v8: bills already tagged are not double-tagged', () => {
    const v7 = {
      balance: 0,
      income: [],
      bills: [
        { id: 'b1', periodId: 'p1', name: 'Netflix subscription', date: '2026-05-01', amount: 20, priority: 'opt' as const, action: 'pay-full' as const, tags: ['subscription'] },
      ] as Bill[],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
      budgets: [
        { id: 'b1', name: 'My', createdAt: '2026-01-01T00:00:00.000Z', defaultRange: { start: '2026-04-09', end: '2026-05-14' } },
      ],
      activeBudgetId: 'b1',
      budgetData: {},
    } as unknown as Partial<BudgetData & MultiBudgetSlice>;
    const out = migrateBudgetState(v7, 7);
    expect(out.bills[0].tags).toEqual(['subscription']);
  });

  it('migrating from STORE_VERSION is a no-op (idempotent)', () => {
    const current = {
      balance: 42,
      income: [],
      bills: [],
      paid: {},
      periods: [{ id: 'p1', startDate: '2026-04-09', endDate: '2026-05-14' }],
      activePeriodId: 'p1',
      dateRange: null,
      budgets: [
        { id: 'b1', name: 'My', createdAt: '2026-01-01T00:00:00.000Z', defaultRange: { start: '2026-04-09', end: '2026-05-14' } },
      ],
      activeBudgetId: 'b1',
      budgetData: {},
    } as unknown as Partial<BudgetData & MultiBudgetSlice>;
    const out = migrateBudgetState(current, STORE_VERSION);
    expect(out.balance).toBe(42);
    expectV8Shape(out);
  });

  it('handles null / empty raw input without throwing (Zustand fills the rest from initial)', () => {
    // Note: migrateBudgetState doesn't fill in fields that no branch
    // touches (e.g. balance, paid). Zustand's persist middleware merges
    // those from the store's `initial` state after migrate returns. So
    // we only assert the fields the migration is contractually
    // responsible for.
    expect(() => migrateBudgetState(null, 1)).not.toThrow();
    expect(() => migrateBudgetState({}, 1)).not.toThrow();
    const out = migrateBudgetState({}, 1);
    expect(Array.isArray(out.income)).toBe(true);
    expect(Array.isArray(out.bills)).toBe(true);
    expect(Array.isArray(out.periods)).toBe(true);
    expect(typeof out.activePeriodId).toBe('string');
    expect(Array.isArray(out.budgets)).toBe(true);
    expect(typeof out.activeBudgetId).toBe('string');
    expect(out.budgetData).toBeTypeOf('object');
    // dateRange was explicitly defaulted to null in the < 3 branch
    expect(out.dateRange).toBeNull();
  });
});
