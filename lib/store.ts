'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Bill, BudgetPeriod, Income, PaidState } from './types';
import { DEFAULT_BILLS, DEFAULT_INCOME, DEFAULT_PERIOD_ID, DEFAULT_PERIODS } from './seed';
import { uid } from './format';

interface BudgetData {
  balance: number;
  income: Income[];
  bills: Bill[];
  paid: PaidState;
  periods: BudgetPeriod[];
  activePeriodId: string;
}

interface BudgetActions {
  setBalance: (v: number) => void;
  addIncome: () => void;
  updateIncome: (id: string, patch: Partial<Income>) => void;
  removeIncome: (id: string) => void;
  addBill: () => void;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  removeBill: (id: string) => void;
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
  importData: (data: Partial<BudgetData>) => void;
  resetAll: () => void;
  exportJson: () => string;
}

type BudgetState = BudgetData & BudgetActions;

const initial: BudgetData = {
  balance: 0,
  income: DEFAULT_INCOME,
  bills: DEFAULT_BILLS,
  paid: {},
  periods: DEFAULT_PERIODS,
  activePeriodId: DEFAULT_PERIOD_ID,
};

function defaultDateForPeriod(periods: BudgetPeriod[], activeId: string): string {
  const active = periods.find((p) => p.id === activeId);
  return active?.startDate ?? '2026-04-15';
}

export const useBudget = create<BudgetState>()(
  persist(
    (set, get) => ({
      ...initial,

      setBalance: (v) => set({ balance: Number.isFinite(v) ? v : 0 }),

      addIncome: () =>
        set((s) => ({
          income: [
            ...s.income,
            {
              id: uid(),
              periodId: s.activePeriodId,
              source: 'New source',
              date: defaultDateForPeriod(s.periods, s.activePeriodId),
              amount: 0,
              status: 'expected',
            },
          ],
        })),
      updateIncome: (id, patch) =>
        set((s) => ({
          income: s.income.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeIncome: (id) =>
        set((s) => ({ income: s.income.filter((r) => r.id !== id) })),

      addBill: () =>
        set((s) => ({
          bills: [
            ...s.bills,
            {
              id: uid(),
              periodId: s.activePeriodId,
              name: 'New bill',
              date: defaultDateForPeriod(s.periods, s.activePeriodId),
              amount: 0,
              priority: 'imp',
              action: 'pay-full',
            },
          ],
        })),
      updateBill: (id, patch) =>
        set((s) => ({
          bills: s.bills.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeBill: (id) =>
        set((s) => ({ bills: s.bills.filter((r) => r.id !== id) })),
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
            return { periods: [...s.periods, period], activePeriodId: id };
          }
          const paidAdditions: PaidState = {};
          const copiedIncome = copyIncome
            ? s.income
                .filter((r) => r.periodId === prev.id)
                .map((r) => {
                  const newId = uid();
                  if (s.paid[`inc_${r.id}`]) paidAdditions[`inc_${newId}`] = true;
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
        set((s) => (s.periods.some((p) => p.id === id) ? { activePeriodId: id } : {})),
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
          const nextActive =
            s.activePeriodId === id ? remainingPeriods[0].id : s.activePeriodId;
          return {
            periods: remainingPeriods,
            income: remainingIncome,
            bills: remainingBills,
            paid: nextPaid,
            activePeriodId: nextActive,
          };
        }),

      importData: (data) =>
        set((s) => {
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
          return {
            balance: data.balance ?? s.balance,
            income: coerceIncome(data.income),
            bills: coerceBills(data.bills),
            paid: data.paid ?? s.paid,
            periods: nextPeriods,
            activePeriodId: fallbackPeriodId,
          };
        }),

      resetAll: () => set({ ...initial }),

      exportJson: () => {
        const { balance, income, bills, paid, periods, activePeriodId } = get();
        return JSON.stringify({ balance, income, bills, paid, periods, activePeriodId }, null, 2);
      },
    }),
    {
      name: 'budget_v1',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        balance: s.balance,
        income: s.income,
        bills: s.bills,
        paid: s.paid,
        periods: s.periods,
        activePeriodId: s.activePeriodId,
      }),
      migrate: (raw, fromVersion) => {
        const s = (raw ?? {}) as Partial<BudgetData>;
        if (fromVersion < 2) {
          const id = DEFAULT_PERIOD_ID;
          const period: BudgetPeriod = { id, startDate: '2026-04-09', endDate: '2026-05-14' };
          return {
            ...s,
            periods: s.periods ?? [period],
            activePeriodId: s.activePeriodId ?? id,
            income: (s.income ?? []).map((r) => ({ ...r, periodId: r.periodId ?? id })),
            bills: (s.bills ?? []).map((r) => ({ ...r, periodId: r.periodId ?? id })),
          } as BudgetData;
        }
        return s as BudgetData;
      },
    }
  )
);
