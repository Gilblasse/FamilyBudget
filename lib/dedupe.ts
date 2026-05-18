import type { Bill, Income, PaidState } from './types';

export interface DedupeResult<T> {
  rows: T[];
  paid: PaidState;
  removed: number;
}

function billKey(b: Bill): string {
  return `${b.name.trim().toLowerCase()}|${b.date}|${b.amount}`;
}

function incomeKey(r: Income): string {
  return `${r.source.trim().toLowerCase()}|${r.date}|${r.amount}|${r.cadence ?? 'once'}`;
}

function remapPaid(
  paid: PaidState,
  prefix: string,
  droppedToKept: Map<string, string>,
): PaidState {
  if (droppedToKept.size === 0) return paid;
  const next: PaidState = {};
  const sep = prefix; // e.g. 'bill_' or 'inc_'
  for (const [key, value] of Object.entries(paid)) {
    if (!key.startsWith(sep)) {
      next[key] = value;
      continue;
    }
    const rest = key.slice(sep.length);
    const underscoreIdx = rest.indexOf('_');
    const id = underscoreIdx === -1 ? rest : rest.slice(0, underscoreIdx);
    const suffix = underscoreIdx === -1 ? '' : rest.slice(underscoreIdx);
    const targetId = droppedToKept.get(id) ?? id;
    const targetKey = `${sep}${targetId}${suffix}`;
    next[targetKey] = Boolean(next[targetKey]) || value;
  }
  return next;
}

export function dedupeBills(
  bills: Bill[],
  paid: PaidState = {},
): DedupeResult<Bill> {
  const seen = new Map<string, string>();
  const droppedToKept = new Map<string, string>();
  const kept: Bill[] = [];
  for (const b of bills) {
    const key = billKey(b);
    const keptId = seen.get(key);
    if (keptId === undefined) {
      seen.set(key, b.id);
      kept.push(b);
    } else {
      droppedToKept.set(b.id, keptId);
    }
  }
  return {
    rows: kept,
    paid: remapPaid(paid, 'bill_', droppedToKept),
    removed: droppedToKept.size,
  };
}

export function dedupeIncome(
  income: Income[],
  paid: PaidState = {},
): DedupeResult<Income> {
  const seen = new Map<string, string>();
  const droppedToKept = new Map<string, string>();
  const kept: Income[] = [];
  for (const r of income) {
    const key = incomeKey(r);
    const keptId = seen.get(key);
    if (keptId === undefined) {
      seen.set(key, r.id);
      kept.push(r);
    } else {
      droppedToKept.set(r.id, keptId);
    }
  }
  return {
    rows: kept,
    paid: remapPaid(paid, 'inc_', droppedToKept),
    removed: droppedToKept.size,
  };
}
