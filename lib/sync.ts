'use client';

import { useEffect, useRef } from 'react';
import { STORE_VERSION, useBudget } from './store';
import { canWriteRemote, REMOTE_WRITE_DISABLED_REASON } from './remote-sync-policy';
import type { BudgetSnapshot } from './types';

const DEBOUNCE_MS = 1500;

interface RemoteEnvelope {
  version: number | null;
  data: BudgetSnapshot | null;
  updatedAt: string | null;
}

async function fetchRemote(): Promise<RemoteEnvelope> {
  const res = await fetch('/api/budget', { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/budget → ${res.status}`);
  return res.json();
}

async function pushRemote(data: BudgetSnapshot): Promise<void> {
  const res = await fetch('/api/budget', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: STORE_VERSION, data }),
  });
  if (!res.ok) throw new Error(`PUT /api/budget → ${res.status}`);
}

export function useBudgetSync() {
  const hydrated = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedDisabled = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchRemote();
        if (cancelled) return;
        if (!remote.data) return;
        // Skip the import when the remote envelope is from a newer client
        // than we can read. A null version means legacy (pre-envelope) data —
        // we trust it under the assumption that the only writer so far was
        // this codebase at some prior version ≤ STORE_VERSION.
        if (remote.version !== null && remote.version > STORE_VERSION) {
          console.warn(
            `[sync] remote envelope version ${remote.version} is newer than local ${STORE_VERSION}; staying on local state`,
          );
          return;
        }
        useBudget.getState().importData(remote.data);
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
        state.activePeriodId === prev.activePeriodId &&
        state.dateRange === prev.dateRange
      ) {
        return;
      }

      if (!canWriteRemote()) {
        if (!warnedDisabled.current) {
          warnedDisabled.current = true;
          console.info(`[sync] ${REMOTE_WRITE_DISABLED_REASON}`);
        }
        return;
      }

      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        const { balance, income, bills, paid, periods, activePeriodId, dateRange } =
          useBudget.getState();
        pushRemote({
          balance,
          income,
          bills,
          paid,
          periods,
          activePeriodId,
          dateRange,
        }).catch((err) => console.warn('[sync] push failed, will retry on next change', err));
      }, DEBOUNCE_MS);
    });

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      unsub();
    };
  }, []);
}
