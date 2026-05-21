'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Bill,
  BudgetData,
  BudgetMeta,
  BudgetPeriod,
  BudgetSnapshot,
  DateRange,
  Income,
  PaidState,
} from './types';
import {
  DEFAULT_BILLS,
  DEFAULT_BUDGETS,
  DEFAULT_BUDGET_ID,
  DEFAULT_INCOME,
  DEFAULT_PAID,
  DEFAULT_PERIOD_ID,
  DEFAULT_PERIODS,
} from './seed';
import { addDaysIso, daysBetween, todayIso } from './date-utils';
import { dedupeBills, dedupeIncome } from './dedupe';
import { uid } from './format';
import { isRemotePrimaryClient } from './remote-mode';

/**
 * Persisted store schema version. Bump when adding a migration branch.
 * Shared with `lib/sync.ts` so the remote envelope carries the same
 * version, and Apps Script can reject stale writes from older clients.
 *
 * v9: multi-budget slice (`budgets`, `activeBudgetId`, `budgetData`) is
 * promoted to the on-wire envelope shape for remote-primary mode. The
 * fields already lived on persisted local state since v4, so the v9
 * migration branch is a no-op marker. The bump is what triggers the
 * Apps Script 409 stale-schema guard for older clients.
 *
 * v10: adds `adjustments?: Adjustment[]` to Income and Bill. Field is
 * optional both in TS and on the wire — older clients ignore it and
 * round-trip cleanly. The v10 migration just normalizes `null`/missing
 * to omitted (no field add forced).
 */
export const STORE_VERSION = 10;

export type { BudgetData };

export interface MultiBudgetSlice {
  budgets: BudgetMeta[];
  activeBudgetId: string;
  budgetData: Record<string, BudgetData>;
}

interface BudgetActions {
  setBalance: (v: number) => void;
  addIncome: () => string;
  updateIncome: (id: string, patch: Partial<Income>) => void;
  removeIncome: (id: string) => void;
  addBill: () => string;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  removeBill: (id: string) => void;
  dedupeAll: () => void;
  reorderBill: (fromId: string, toId: string) => void;
  togglePaid: (key: string) => void;
  addPeriod: (input: {
    startDate: string;
    endDate: string;
    label?: string;
    copyIncome?: boolean;
    copyBills?: boolean;
  }) => string;
  setActivePeriod: (id: string) => void;
  removePeriod: (id: string) => void;
  setDateRange: (range: DateRange | null) => void;
  resetDateRange: () => void;
  importData: (data: Partial<BudgetSnapshot>) => void;
  resetAll: () => void;
  exportJson: () => string;
  addBudget: (name: string, range?: DateRange | null) => string;
  setActiveBudget: (id: string) => void;
  updateBudget: (id: string, patch: { name?: string; defaultRange?: DateRange }) => void;
  removeBudget: (id: string) => void;
}

type BudgetState = BudgetData & MultiBudgetSlice & BudgetActions;

function freshDefaultData(): BudgetData {
  return {
    balance: 0,
    income: DEFAULT_INCOME,
    bills: DEFAULT_BILLS,
    paid: { ...DEFAULT_PAID },
    periods: DEFAULT_PERIODS,
    activePeriodId: DEFAULT_PERIOD_ID,
    dateRange: null,
  };
}

function snapshotData(s: BudgetState): BudgetData {
  return {
    balance: s.balance,
    income: s.income,
    bills: s.bills,
    paid: s.paid,
    periods: s.periods,
    activePeriodId: s.activePeriodId,
    dateRange: s.dateRange,
  };
}

function copyDataWithFreshIds(data: BudgetData): BudgetData {
  const periodIdMap = new Map<string, string>();
  const periods = data.periods.map((p) => {
    const newId = uid();
    periodIdMap.set(p.id, newId);
    return { ...p, id: newId };
  });
  const remapPeriodId = (oldId: string) => periodIdMap.get(oldId) ?? periods[0]?.id ?? oldId;
  const income = data.income.map((r) => ({
    ...r,
    id: uid(),
    periodId: remapPeriodId(r.periodId),
  }));
  const bills = data.bills.map((b) => ({
    ...b,
    id: uid(),
    periodId: remapPeriodId(b.periodId),
  }));
  return {
    balance: data.balance,
    income,
    bills,
    paid: {},
    periods,
    activePeriodId: remapPeriodId(data.activePeriodId),
    dateRange: data.dateRange,
  };
}

const initial: BudgetData & MultiBudgetSlice = {
  ...freshDefaultData(),
  budgets: DEFAULT_BUDGETS,
  activeBudgetId: DEFAULT_BUDGET_ID,
  budgetData: {},
};

function defaultDateForNew(s: {
  dateRange: DateRange | null;
  periods: BudgetPeriod[];
  activePeriodId: string;
}): string {
  if (s.dateRange) return s.dateRange.start;
  const active = s.periods.find((p) => p.id === s.activePeriodId);
  return active?.startDate ?? todayIso();
}

/**
 * Persisted-state migration chain. Exported so unit tests can drive the
 * full v1 → STORE_VERSION sequence without spinning up the Zustand store.
 *
 * Every branch is additive — it must produce a v(N) shape from v(N-1)
 * input. Never rename a field without a migration; never drop a field
 * without explicit user-data-loss approval.
 */
export function migrateBudgetState(
  raw: unknown,
  fromVersion: number,
): BudgetData & MultiBudgetSlice {
  let s = (raw ?? {}) as Partial<BudgetData & MultiBudgetSlice>;
  if (fromVersion < 2) {
    const id = DEFAULT_PERIOD_ID;
    const period: BudgetPeriod = { id, startDate: '2026-04-09', endDate: '2026-05-14' };
    s = {
      ...s,
      periods: s.periods ?? [period],
      activePeriodId: s.activePeriodId ?? id,
      income: (s.income ?? []).map((r) => ({ ...r, periodId: r.periodId ?? id })),
      bills: (s.bills ?? []).map((r) => ({ ...r, periodId: r.periodId ?? id })),
    };
  }
  if (fromVersion < 3) {
    s = { ...s, dateRange: s.dateRange ?? null };
  }
  if (fromVersion < 4) {
    s = {
      ...s,
      budgets: (s.budgets ?? [
        {
          id: DEFAULT_BUDGET_ID,
          name: 'My Budget',
          createdAt: new Date().toISOString(),
        },
      ]) as BudgetMeta[],
      activeBudgetId: s.activeBudgetId ?? DEFAULT_BUDGET_ID,
      budgetData: s.budgetData ?? {},
    };
  }
  if (fromVersion < 5) {
    const periodLookup = s.periods ?? [];
    const activePeriod = periodLookup.find((p) => p.id === s.activePeriodId);
    const fallbackRange: DateRange =
      s.dateRange ??
      (activePeriod
        ? { start: activePeriod.startDate, end: activePeriod.endDate }
        : { start: '2026-04-09', end: '2026-05-14' });
    s = {
      ...s,
      budgets: (s.budgets ?? []).map((b) =>
        b.defaultRange ? b : { ...b, defaultRange: fallbackRange },
      ),
    };
  }
  if (fromVersion < 6) {
    s = {
      ...s,
      income: (s.income ?? []).map((r) => ({ ...r, cadence: r.cadence ?? 'once' })),
    };
  }
  if (fromVersion < 7) {
    const billResult = dedupeBills(s.bills ?? [], s.paid ?? {});
    const incomeResult = dedupeIncome(s.income ?? [], billResult.paid);
    s = {
      ...s,
      bills: billResult.rows,
      income: incomeResult.rows,
      paid: incomeResult.paid,
    };
  }
  if (fromVersion < 8) {
    // Replace the brittle `name.includes('subscription')` heuristic with a
    // proper `tags` array. Existing subscription bills are tagged in-place;
    // new bills get tags via UI / user action (no auto-tagging on add).
    s = {
      ...s,
      bills: (s.bills ?? []).map((b) => {
        if (b.tags && b.tags.includes('subscription')) return b;
        const isSubscription = b.name?.toLowerCase().includes('subscription');
        if (!isSubscription) return b;
        return { ...b, tags: [...(b.tags ?? []), 'subscription'] };
      }),
    };
  }
  if (fromVersion < 9) {
    // v9 promotes the multi-budget slice to the on-wire envelope. Local
    // persisted state has already carried these fields since v4, so this
    // branch only patches them with defaults when an unusual partial v8
    // dump is missing them. Apps Script enforces the version bump via 409.
    s = {
      ...s,
      budgets: s.budgets ?? [],
      activeBudgetId: s.activeBudgetId ?? DEFAULT_BUDGET_ID,
      budgetData: s.budgetData ?? {},
    };
  }
  if (fromVersion < 10) {
    // v10 introduces `adjustments?: Adjustment[]` on Income and Bill.
    // The field is optional and absent on legacy rows — no field add is
    // forced. Defensive normalization: if a row arrives with `null` or
    // a non-array `adjustments`, drop it so downstream `Array.isArray`
    // checks (and `sumAdj`) behave.
    const normalizeAdj = <T extends { adjustments?: unknown }>(row: T): T => {
      if (row.adjustments === undefined) return row;
      if (Array.isArray(row.adjustments)) return row;
      const next: Record<string, unknown> = { ...row };
      delete next.adjustments;
      return next as T;
    };
    s = {
      ...s,
      income: (s.income ?? []).map(normalizeAdj),
      bills: (s.bills ?? []).map(normalizeAdj),
    };
  }
  return s as BudgetData & MultiBudgetSlice;
}

export const useBudget = create<BudgetState>()(
  persist(
    (set, get) => ({
      ...initial,

      setBalance: (v) => set({ balance: Number.isFinite(v) ? v : 0 }),

      addIncome: () => {
        const id = uid();
        set((s) => ({
          income: [
            ...s.income,
            {
              id,
              periodId: s.activePeriodId,
              source: 'New source',
              date: defaultDateForNew(s),
              amount: 0,
              status: 'expected',
              cadence: 'once',
            },
          ],
        }));
        return id;
      },
      updateIncome: (id, patch) =>
        set((s) => ({
          income: s.income.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeIncome: (id) =>
        set((s) => ({ income: s.income.filter((r) => r.id !== id) })),

      addBill: () => {
        const id = uid();
        set((s) => ({
          bills: [
            ...s.bills,
            {
              id,
              periodId: s.activePeriodId,
              name: 'New bill',
              date: defaultDateForNew(s),
              amount: 0,
              priority: 'imp',
              action: 'pay-full',
            },
          ],
        }));
        return id;
      },
      updateBill: (id, patch) =>
        set((s) => ({
          bills: s.bills.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeBill: (id) =>
        set((s) => ({ bills: s.bills.filter((r) => r.id !== id) })),
      dedupeAll: () =>
        set((s) => {
          const b = dedupeBills(s.bills, s.paid);
          const i = dedupeIncome(s.income, b.paid);
          if (b.removed === 0 && i.removed === 0) return {};
          return { bills: b.rows, income: i.rows, paid: i.paid };
        }),
      reorderBill: (fromId, toId) =>
        set((s) => {
          if (fromId === toId) return {};
          const arr = [...s.bills];
          const from = arr.findIndex((b) => b.id === fromId);
          const to = arr.findIndex((b) => b.id === toId);
          if (from < 0 || to < 0) return {};
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved);
          return { bills: arr };
        }),

      togglePaid: (key) =>
        set((s) => ({ paid: { ...s.paid, [key]: !s.paid[key] } })),

      addPeriod: ({ startDate, endDate, label, copyIncome = true, copyBills = true }) => {
        const id = uid();
        const period: BudgetPeriod = label
          ? { id, startDate, endDate, label }
          : { id, startDate, endDate };
        set((s) => {
          const prev = s.periods.find((p) => p.id === s.activePeriodId);
          if (!prev) {
            return { periods: [...s.periods, period], activePeriodId: id, dateRange: null };
          }
          const paidAdditions: PaidState = {};
          const copiedIncome = copyIncome
            ? s.income
                .filter((r) => r.periodId === prev.id)
                .map((r) => {
                  const newId = uid();
                  if (s.paid[`inc_${r.id}`]) paidAdditions[`inc_${newId}`] = true;
                  const recurringPrefix = `inc_${r.id}_`;
                  for (const k of Object.keys(s.paid)) {
                    if (s.paid[k] && k.startsWith(recurringPrefix)) {
                      paidAdditions[`inc_${newId}_${k.slice(recurringPrefix.length)}`] = true;
                    }
                  }
                  return { ...r, id: newId, periodId: id };
                })
            : [];
          const copiedBills = copyBills
            ? s.bills
                .filter((b) => b.periodId === prev.id)
                .map((b) => {
                  const newId = uid();
                  if (s.paid[`bill_${b.id}`]) paidAdditions[`bill_${newId}`] = true;
                  return { ...b, id: newId, periodId: id };
                })
            : [];
          return {
            periods: [...s.periods, period],
            activePeriodId: id,
            dateRange: null,
            income: [...s.income, ...copiedIncome],
            bills: [...s.bills, ...copiedBills],
            paid:
              Object.keys(paidAdditions).length > 0
                ? { ...s.paid, ...paidAdditions }
                : s.paid,
          };
        });
        return id;
      },
      setActivePeriod: (id) =>
        set((s) =>
          s.periods.some((p) => p.id === id) && s.activePeriodId !== id
            ? { activePeriodId: id, dateRange: null }
            : {},
        ),
      removePeriod: (id) =>
        set((s) => {
          if (s.periods.length <= 1) return {};
          if (!s.periods.some((p) => p.id === id)) return {};
          const remainingPeriods = s.periods.filter((p) => p.id !== id);
          const remainingIncome = s.income.filter((r) => r.periodId !== id);
          const remainingBills = s.bills.filter((b) => b.periodId !== id);
          const keptKeys = new Set<string>([
            ...remainingIncome.map((r) => `inc_${r.id}`),
            ...remainingBills.map((b) => `bill_${b.id}`),
          ]);
          const nextPaid: PaidState = {};
          for (const [key, value] of Object.entries(s.paid)) {
            if (keptKeys.has(key)) nextPaid[key] = value;
          }
          const activeChanged = s.activePeriodId === id;
          const nextActive = activeChanged ? remainingPeriods[0].id : s.activePeriodId;
          return {
            periods: remainingPeriods,
            income: remainingIncome,
            bills: remainingBills,
            paid: nextPaid,
            activePeriodId: nextActive,
            dateRange: activeChanged ? null : s.dateRange,
          };
        }),

      setDateRange: (range) => set({ dateRange: range }),
      resetDateRange: () => set({ dateRange: null }),

      importData: (data) =>
        set((s) => {
          // Active-slice import (the legacy path — used by single-budget
          // JSON exports and by lib/sync.ts when the remote envelope only
          // carries the active slice).
          const nextActive = data.activePeriodId ?? s.activePeriodId;
          const nextPeriods = data.periods ?? s.periods;
          const fallbackPeriodId = nextPeriods.some((p) => p.id === nextActive)
            ? nextActive
            : nextPeriods[0]?.id ?? s.activePeriodId;
          const coerceIncome = (rows?: Income[]) =>
            rows
              ? rows.map((r) => ({ ...r, periodId: r.periodId ?? fallbackPeriodId }))
              : s.income;
          const coerceBills = (rows?: Bill[]) =>
            rows
              ? rows.map((r) => ({ ...r, periodId: r.periodId ?? fallbackPeriodId }))
              : s.bills;
          const incomingPaid = data.paid ?? s.paid;
          const billResult = dedupeBills(coerceBills(data.bills), incomingPaid);
          const incomeResult = dedupeIncome(coerceIncome(data.income), billResult.paid);
          const activeSlice = {
            balance: data.balance ?? s.balance,
            income: incomeResult.rows,
            bills: billResult.rows,
            paid: incomeResult.paid,
            periods: nextPeriods,
            activePeriodId: fallbackPeriodId,
            dateRange: data.dateRange ?? null,
          };

          // If the import carries the multi-budget envelope (modern
          // exports), replace `budgets` / `activeBudgetId` / `budgetData`
          // too. Otherwise we keep the existing multi-budget state — the
          // legacy single-budget shape only restores the active slice.
          const hasMultiBudget =
            Array.isArray(data.budgets) || data.activeBudgetId !== undefined || data.budgetData !== undefined;
          if (!hasMultiBudget) return activeSlice;

          const nextBudgets = data.budgets ?? s.budgets;
          const nextActiveBudgetId =
            data.activeBudgetId && nextBudgets.some((b) => b.id === data.activeBudgetId)
              ? data.activeBudgetId
              : nextBudgets[0]?.id ?? s.activeBudgetId;
          const nextBudgetData = data.budgetData ?? s.budgetData;
          return {
            ...activeSlice,
            budgets: nextBudgets,
            activeBudgetId: nextActiveBudgetId,
            budgetData: nextBudgetData,
          };
        }),

      resetAll: () => set(freshDefaultData()),

      exportJson: () => {
        const s = get();
        // Includes the multi-budget envelope so users with several budgets
        // round-trip losslessly. `version` is the persisted schema version
        // so future migrations can detect older exports. Legacy importers
        // ignore unknown keys, so this shape stays back-compat for tools
        // that only know the active-slice format.
        return JSON.stringify(
          {
            version: STORE_VERSION,
            balance: s.balance,
            income: s.income,
            bills: s.bills,
            paid: s.paid,
            periods: s.periods,
            activePeriodId: s.activePeriodId,
            dateRange: s.dateRange,
            budgets: s.budgets,
            activeBudgetId: s.activeBudgetId,
            budgetData: s.budgetData,
          },
          null,
          2,
        );
      },

      addBudget: (name, range) => {
        const trimmed = name.trim() || 'Untitled budget';
        const id = uid();
        set((s) => {
          const copied = copyDataWithFreshIds(snapshotData(s));
          // Capture the source period's start BEFORE we rewrite periods with
          // the new range — needed for the date-shift delta below.
          const sourceActive = copied.periods.find(
            (p) => p.id === copied.activePeriodId,
          );
          const withRange = range
            ? {
                ...copied,
                dateRange: range,
                periods: copied.periods.map((p) =>
                  p.id === copied.activePeriodId
                    ? { ...p, startDate: range.start, endDate: range.end }
                    : p,
                ),
              }
            : copied;
          // Shift every income/bill date by the delta between the source
          // period's start and the new range's start. Preserves spacing
          // and lands rows inside the new window. No-op when range matches.
          const delta = range && sourceActive
            ? daysBetween(sourceActive.startDate, range.start)
            : 0;
          const shifted = delta === 0
            ? withRange
            : {
                ...withRange,
                income: withRange.income.map((r) => ({
                  ...r,
                  date: addDaysIso(r.date, delta),
                  ...(r.endDate ? { endDate: addDaysIso(r.endDate, delta) } : {}),
                })),
                bills: withRange.bills.map((b) => ({
                  ...b,
                  date: addDaysIso(b.date, delta),
                })),
              };
          const fallbackPeriod = shifted.periods.find(
            (p) => p.id === shifted.activePeriodId,
          );
          const defaultRange: DateRange = range
            ?? (fallbackPeriod
              ? { start: fallbackPeriod.startDate, end: fallbackPeriod.endDate }
              : { start: todayIso(), end: addDaysIso(todayIso(), 29) });
          const meta: BudgetMeta = {
            id,
            name: trimmed,
            createdAt: new Date().toISOString(),
            defaultRange,
          };
          const nextBudgetData = {
            ...s.budgetData,
            [s.activeBudgetId]: snapshotData(s),
          };
          return {
            ...shifted,
            budgets: [...s.budgets, meta],
            activeBudgetId: id,
            budgetData: nextBudgetData,
          };
        });
        return id;
      },

      setActiveBudget: (id) =>
        set((s) => {
          if (id === s.activeBudgetId) return {};
          const targetMeta = s.budgets.find((b) => b.id === id);
          if (!targetMeta) return {};
          const next = s.budgetData[id];
          if (!next) return {};
          const nextBudgetData = { ...s.budgetData };
          delete nextBudgetData[id];
          nextBudgetData[s.activeBudgetId] = snapshotData(s);
          return {
            ...next,
            dateRange: targetMeta.defaultRange,
            activeBudgetId: id,
            budgetData: nextBudgetData,
          };
        }),

      updateBudget: (id, patch) =>
        set((s) => {
          if (!s.budgets.some((b) => b.id === id)) return {};
          const trimmed = patch.name !== undefined ? patch.name.trim() : undefined;
          if (trimmed !== undefined && !trimmed) return {};
          const nextRange = patch.defaultRange;
          const budgets = s.budgets.map((b) => {
            if (b.id !== id) return b;
            return {
              ...b,
              ...(trimmed !== undefined ? { name: trimmed } : {}),
              ...(nextRange ? { defaultRange: nextRange } : {}),
            };
          });
          if (!nextRange || id !== s.activeBudgetId) {
            return { budgets };
          }
          return {
            budgets,
            dateRange: nextRange,
            periods: s.periods.map((p) =>
              p.id === s.activePeriodId
                ? { ...p, startDate: nextRange.start, endDate: nextRange.end }
                : p,
            ),
          };
        }),

      removeBudget: (id) =>
        set((s) => {
          if (s.budgets.length <= 1) return {};
          if (!s.budgets.some((b) => b.id === id)) return {};
          const remaining = s.budgets.filter((b) => b.id !== id);
          if (id !== s.activeBudgetId) {
            const nextBudgetData = { ...s.budgetData };
            delete nextBudgetData[id];
            return { budgets: remaining, budgetData: nextBudgetData };
          }
          const nextActive = remaining[0];
          const nextData = s.budgetData[nextActive.id];
          const nextBudgetData = { ...s.budgetData };
          delete nextBudgetData[nextActive.id];
          delete nextBudgetData[id];
          return {
            ...(nextData ?? freshDefaultData()),
            budgets: remaining,
            activeBudgetId: nextActive.id,
            budgetData: nextBudgetData,
          };
        }),
    }),
    {
      name: 'budget_v1',
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Remote-primary mode treats Zustand as a memory-only cache of the
      // server's truth. Returning {} stops writes to localStorage while
      // still letting rehydrate read existing local state on first load
      // (so the migration modal can offer to upload it).
      partialize: (s) =>
        isRemotePrimaryClient()
          ? {}
          : {
              balance: s.balance,
              income: s.income,
              bills: s.bills,
              paid: s.paid,
              periods: s.periods,
              activePeriodId: s.activePeriodId,
              dateRange: s.dateRange,
              budgets: s.budgets,
              activeBudgetId: s.activeBudgetId,
              budgetData: s.budgetData,
            },
      migrate: (raw, fromVersion) => migrateBudgetState(raw, fromVersion),
    }
  )
);
