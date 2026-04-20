'use client';

import { useEffect, useRef } from 'react';
import { useBudget } from './store';
import type { BudgetSnapshot } from './types';

const DEBOUNCE_MS = 1500;

async function fetchRemote(): Promise<{ data: BudgetSnapshot | null; updatedAt: string | null }> {
  const res = await fetch('/api/budget', { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/budget → ${res.status}`);
  return res.json();
}

async function pushRemote(data: BudgetSnapshot): Promise<void> {
  const res = await fetch('/api/budget', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`PUT /api/budget → ${res.status}`);
}

export function useBudgetSync() {
  const hydrated = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchRemote();
        if (cancelled) return;
        if (remote.data) useBudget.getState().importData(remote.data);
      } catch (err) {
        console.warn('[sync] pull failed, staying on local state', err);
      } finally {
        hydrated.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = useBudget.subscribe((state, prev) => {
      if (!hydrated.current) return;
      if (
        state.balance === prev.balance &&
        state.income === prev.income &&
        state.bills === prev.bills &&
        state.paid === prev.paid &&
        state.periods === prev.periods &&
        state.activePeriodId === prev.activePeriodId
      ) {
        return;
      }

      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        const { balance, income, bills, paid, periods, activePeriodId } = useBudget.getState();
        pushRemote({ balance, income, bills, paid, periods, activePeriodId }).catch((err) =>
          console.warn('[sync] push failed, will retry on next change', err),
        );
      }, DEBOUNCE_MS);
    });

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      unsub();
    };
  }, []);
}
