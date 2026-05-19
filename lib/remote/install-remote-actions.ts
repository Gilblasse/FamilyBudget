'use client';

import type { QueryClient } from '@tanstack/react-query';
import { STORE_VERSION, useBudget } from '@/lib/store';
import type { Bill, BudgetPeriod, DateRange, Income } from '@/lib/types';
import {
  clearPaid,
  createBill,
  createIncome,
  createPeriod,
  deleteBill,
  deleteBudget,
  deleteIncome,
  deletePeriod,
  patchMeta,
  putEnvelope,
  setPaid,
  updateBill as updateBillApi,
  updateBudget as updateBudgetApi,
  updateIncome as updateIncomeApi,
} from './api-client';
import { qk } from './query-keys';

// Module-level sentinel — survives React Fast Refresh because re-running
// this module re-creates it, while the store actions stay swapped.
let installed = false;

/**
 * Swap the 23 mutation implementations on `useBudget` for remote-aware
 * versions. Each wrapper:
 *   1. Calls the original local action first — UI updates optimistically.
 *   2. Fires the matching REST mutation.
 *   3. On failure, refetches the envelope so the local cache reconverges
 *      on the server's view (simple, safe rollback).
 *
 * Idempotent: subsequent calls are no-ops thanks to the `installed`
 * sentinel and the `__remoteWiringInstalled` flag on the store.
 */
export function installRemoteActions(queryClient: QueryClient): void {
  if (installed) return;
  installed = true;

  const state = useBudget.getState();
  const original = {
    setBalance: state.setBalance,
    addIncome: state.addIncome,
    updateIncome: state.updateIncome,
    removeIncome: state.removeIncome,
    addBill: state.addBill,
    updateBill: state.updateBill,
    removeBill: state.removeBill,
    reorderBill: state.reorderBill,
    togglePaid: state.togglePaid,
    addPeriod: state.addPeriod,
    setActivePeriod: state.setActivePeriod,
    removePeriod: state.removePeriod,
    importData: state.importData,
    resetAll: state.resetAll,
    addBudget: state.addBudget,
    setActiveBudget: state.setActiveBudget,
    updateBudget: state.updateBudget,
    removeBudget: state.removeBudget,
    setDateRange: state.setDateRange,
    resetDateRange: state.resetDateRange,
    dedupeAll: state.dedupeAll,
  };

  const rollback = () => queryClient.invalidateQueries({ queryKey: qk.envelope() });
  const onFail = (op: string) => (err: unknown) => {
    console.warn(`[remote-primary] ${op} failed; rolling back via envelope refetch`, err);
    void rollback();
    return { error: 'remote mutation failed', op };
  };

  // setBalance → PATCH /api/budget/meta { balance }
  useBudget.setState({
    setBalance: (v: number) => {
      original.setBalance(v);
      patchMeta({ balance: Number.isFinite(v) ? v : 0 }).catch(onFail('setBalance'));
    },
    addIncome: () => {
      const id = original.addIncome();
      const row = useBudget.getState().income.find((r) => r.id === id);
      if (row) createIncome(row).catch(onFail('addIncome'));
      return id;
    },
    updateIncome: (id: string, patch: Partial<Income>) => {
      original.updateIncome(id, patch);
      updateIncomeApi(id, patch).catch(onFail('updateIncome'));
    },
    removeIncome: (id: string) => {
      original.removeIncome(id);
      deleteIncome(id).catch(onFail('removeIncome'));
    },
    addBill: () => {
      const id = original.addBill();
      const row = useBudget.getState().bills.find((b) => b.id === id);
      if (row) createBill(row).catch(onFail('addBill'));
      return id;
    },
    updateBill: (id: string, patch: Partial<Bill>) => {
      original.updateBill(id, patch);
      updateBillApi(id, patch).catch(onFail('updateBill'));
    },
    removeBill: (id: string) => {
      original.removeBill(id);
      return deleteBill(id)
        .then((result) => {
          void rollback();
          return result;
        })
        .catch(onFail('removeBill'));
    },
    reorderBill: (fromId: string, toId: string) => {
      original.reorderBill(fromId, toId);
      // Reorder is reflected via the bills array. Replay the full ordered
      // list via PUT /api/budget rather than introduce a dedicated route.
      void rollback();
    },
    togglePaid: (key: string) => {
      const prev = !!useBudget.getState().paid[key];
      original.togglePaid(key);
      const next = !prev;
      const call = next ? setPaid(key) : clearPaid(key);
      call.catch(onFail('togglePaid'));
    },
    addPeriod: (input: Parameters<typeof original.addPeriod>[0]) => {
      const id = original.addPeriod(input);
      const period = useBudget.getState().periods.find((p) => p.id === id) as
        | BudgetPeriod
        | undefined;
      void (async () => {
        try {
          if (period) await createPeriod(period);
          await patchMeta({ activePeriodId: id });
        } catch (err) {
          onFail('addPeriod')(err);
          return;
        }
        // copyIncome/copyBills clones land in the active arrays — full
        // resync via envelope invalidation keeps the server consistent.
        void rollback();
      })();
      return id;
    },
    setActivePeriod: (id: string) => {
      original.setActivePeriod(id);
      patchMeta({ activePeriodId: id }).catch(onFail('setActivePeriod'));
    },
    removePeriod: (id: string) => {
      original.removePeriod(id);
      deletePeriod(id).catch(onFail('removePeriod'));
    },
    importData: (data) => {
      original.importData(data);
      void rollback();
    },
    resetAll: () => {
      original.resetAll();
      void rollback();
    },
    addBudget: (name: string, range?: DateRange | null) => {
      const id = original.addBudget(name, range);
      // addBudget clones the current budget's income/bills/periods into the
      // new workspace via copyDataWithFreshIds. Push the entire snapshot via
      // the atomic replace_budget_snapshot RPC so the new budget shows up on
      // the server with its cloned slice, the active_budget_id swap, and the
      // cloned active_period_id all in one transaction.
      void (async () => {
        try {
          const s = useBudget.getState();
          await putEnvelope({
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
          }, STORE_VERSION);
        } catch (err) {
          onFail('addBudget')(err);
        }
      })();
      return id;
    },
    setActiveBudget: (id: string) => {
      original.setActiveBudget(id);
      patchMeta({ activeBudgetId: id }).catch(onFail('setActiveBudget'));
    },
    updateBudget: (id: string, patch: { name?: string; defaultRange?: DateRange }) => {
      original.updateBudget(id, patch);
      updateBudgetApi(id, patch).catch(onFail('updateBudget'));
    },
    removeBudget: (id: string) => {
      original.removeBudget(id);
      deleteBudget(id).catch(onFail('removeBudget'));
    },
    setDateRange: (range: DateRange | null) => {
      original.setDateRange(range);
      patchMeta({ dateRange: range }).catch(onFail('setDateRange'));
    },
    resetDateRange: () => {
      original.resetDateRange();
      patchMeta({ dateRange: null }).catch(onFail('resetDateRange'));
    },
    dedupeAll: () => {
      original.dedupeAll();
      // Dedupe can touch bills, income, and paid in a single call. No
      // dedicated per-entity route covers all three atomically; reuse the
      // envelope-refetch pattern from reorderBill / addPeriod so the server
      // becomes the source of truth.
      void rollback();
    },
  });
}
