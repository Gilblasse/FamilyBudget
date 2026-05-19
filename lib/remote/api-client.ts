/**
 * Typed `fetch` wrappers for the per-entity remote-primary endpoints.
 * All requests go to `/api/budget*` and rely on server-side
 * `BUDGET_API_KEY` for upstream auth — the browser never sees the key.
 */
import type {
  Bill,
  BudgetMeta,
  BudgetPeriod,
  BudgetSnapshot,
  DateRange,
  Income,
} from '@/lib/types';

export interface RemoteEnvelope {
  version: number | null;
  data: BudgetSnapshot | null;
  updatedAt: string | null;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function getEnvelope(): Promise<RemoteEnvelope> {
  const res = await fetch('/api/budget', { cache: 'no-store' });
  return readJson<RemoteEnvelope>(res);
}

export async function putEnvelope(data: BudgetSnapshot, version: number): Promise<void> {
  const res = await fetch('/api/budget', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version, data }),
  });
  await readJson(res);
}

export async function createIncome(payload: Income): Promise<unknown> {
  const res = await fetch('/api/budget/income', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateIncome(id: string, patch: Partial<Income>): Promise<unknown> {
  const res = await fetch(`/api/budget/income/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return readJson(res);
}

export async function deleteIncome(id: string): Promise<unknown> {
  const res = await fetch(`/api/budget/income/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export async function createBill(payload: Bill): Promise<unknown> {
  const res = await fetch('/api/budget/bills', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateBill(id: string, patch: Partial<Bill>): Promise<unknown> {
  const res = await fetch(`/api/budget/bills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return readJson(res);
}

export async function deleteBill(id: string): Promise<unknown> {
  const res = await fetch(`/api/budget/bills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    keepalive: true,
  });
  return readJson(res);
}

export async function createPeriod(payload: BudgetPeriod): Promise<unknown> {
  const res = await fetch('/api/budget/periods', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function deletePeriod(id: string): Promise<unknown> {
  const res = await fetch(`/api/budget/periods/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export async function createBudget(payload: BudgetMeta): Promise<unknown> {
  const res = await fetch('/api/budget/budgets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function updateBudget(id: string, patch: Partial<BudgetMeta>): Promise<unknown> {
  const res = await fetch(`/api/budget/budgets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return readJson(res);
}

export async function deleteBudget(id: string): Promise<unknown> {
  const res = await fetch(`/api/budget/budgets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export async function setPaid(key: string): Promise<unknown> {
  const res = await fetch(`/api/budget/paid/${encodeURIComponent(key)}`, {
    method: 'POST',
  });
  return readJson(res);
}

export async function clearPaid(key: string): Promise<unknown> {
  const res = await fetch(`/api/budget/paid/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  return readJson(res);
}

export interface MetaPatch {
  balance?: number;
  activePeriodId?: string;
  dateRange?: DateRange | null;
  activeBudgetId?: string;
}

export async function patchMeta(patch: MetaPatch): Promise<unknown> {
  const res = await fetch('/api/budget/meta', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return readJson(res);
}
