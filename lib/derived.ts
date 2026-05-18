/**
 * Pure derived helpers shared across views. Centralizes a few invariants
 * the deep-dive surfaced as inconsistent across components:
 *
 *  - Opening balance must appear in every running-total view, including
 *    when balance is negative (overdraft). Previously cash-flow and
 *    trial-balance both gated on `balance > 0` and silently dropped a
 *    negative opening.
 *  - "Important bill" means `crit` or `imp`. Repeated as an inline check
 *    in 4+ files.
 *  - "Confirmed-or-received income" (i.e. expected to be in the bank) is
 *    the basis for several dashboard tiles; was duplicated as inline
 *    status-or filters.
 *
 * These helpers DO NOT scope by date range or expand recurrence. Callers
 * should scope first (via `visibility.ts` + `recurrence.ts`) then pass
 * the resulting rows here.
 */

import type {
  Bill,
  IncomeOccurrence,
  IncomeStatus,
  PaidState,
  Priority,
} from './types';

// ----- Opening balance -----

export interface OpeningBalanceEntry {
  /** Signed amount: positive = credit, negative = overdraft. Never zero. */
  amount: number;
  date: string;
  label: string;
}

/**
 * Returns the opening-balance row to insert into running-balance views,
 * or `null` when balance is exactly zero. The amount is signed; callers
 * that need separate "in/out" semantics should branch on the sign.
 */
export function openingBalanceEntry(
  balance: number,
  openingDate: string,
): OpeningBalanceEntry | null {
  if (!Number.isFinite(balance) || balance === 0) return null;
  const label =
    balance >= 0 ? 'Opening bank balance' : 'Opening bank balance (overdraft)';
  return { amount: balance, date: openingDate, label };
}

// ----- Ending balance -----

interface AmountRow {
  amount: number;
}

/**
 * Closing balance = opening + sum(scoped income) − sum(scoped bills).
 * Sums are over whatever rows the caller passed; pre-scope by range and
 * by action (`skip`/`delay`) where appropriate.
 */
export function endingBalance(args: {
  openingBalance: number;
  scopedIncome: AmountRow[];
  scopedBills: AmountRow[];
}): number {
  const inc = args.scopedIncome.reduce((s, r) => s + r.amount, 0);
  const out = args.scopedBills.reduce((s, b) => s + b.amount, 0);
  return args.openingBalance + inc - out;
}

// ----- Predicates -----

/**
 * Income that is `'confirmed'` or `'received'` per the source's status.
 * NOTE: This is the *intent* side. Per-occurrence settlement is tracked
 * separately in `PaidState` under `inc_${id}` / `inc_${id}_${date}` keys.
 * Use `isPaid` for that.
 */
export function isReceivedIncome(occ: { status: IncomeStatus }): boolean {
  return occ.status === 'received' || occ.status === 'confirmed';
}

/** "Important" = `crit` or `imp`. Drives coverage warnings and the unpaid-critical badge. */
export function isImportantBill(bill: { priority: Priority }): boolean {
  return bill.priority === 'crit' || bill.priority === 'imp';
}

/** A bill the user is actually committing to (not skipping or delaying). */
export function isActiveBill(bill: { action: Bill['action'] }): boolean {
  return bill.action !== 'skip' && bill.action !== 'delay';
}

// ----- Aggregations -----

export function pendingIncomeCount(occurrences: { status: IncomeStatus }[]): number {
  return occurrences.reduce((n, r) => (r.status === 'pending' ? n + 1 : n), 0);
}

export function isPaid(paid: PaidState, key: string): boolean {
  return paid[key] === true;
}

/**
 * Bills that matter for the unpaid-critical warning surface: critical
 * priority, not skipped/delayed, and not yet toggled paid.
 */
export function criticalUnpaidBills(bills: Bill[], paid: PaidState): Bill[] {
  return bills.filter(
    (b) => b.priority === 'crit' && isActiveBill(b) && !isPaid(paid, `bill_${b.id}`),
  );
}

/**
 * Sum of confirmed-or-received income occurrences in `occurrences`. Pair
 * with `expandAllIncome(income, range)` to get a range-scoped total.
 */
export function confirmedIncomeTotal(occurrences: IncomeOccurrence[]): number {
  return occurrences.reduce((s, r) => (isReceivedIncome(r) ? s + r.amount : s), 0);
}
