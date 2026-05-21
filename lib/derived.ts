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

import { inRange } from './filters';
import { expandAllIncome } from './recurrence';
import type {
  Adjustment,
  Bill,
  DateRange,
  Income,
  IncomeOccurrence,
  IncomeStatus,
  PaidState,
  Priority,
} from './types';

/**
 * Label suffix for income-adjustment timeline/ledger rows. Single source
 * so rename or i18n only touches one place.
 */
export const ADJ_LABEL_SUFFIX = ' (adjustment)';

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

// ----- Adjustments (per-row variance log) -----

/**
 * Sum of an adjustments array. Tolerates `undefined` so callers can pass
 * `bill.adjustments` directly. Non-finite entries (NaN, ±Infinity) are
 * skipped so a half-typed amount in the UI doesn't corrupt totals.
 */
export function sumAdj(adjustments: Adjustment[] | undefined): number {
  if (!adjustments || adjustments.length === 0) return 0;
  let total = 0;
  for (const a of adjustments) {
    if (Number.isFinite(a.amount)) total += a.amount;
  }
  return total;
}

/**
 * Effective planned amount = base `amount` + sum of adjustments. This is
 * what cash-flow projects against (the prototype's "plan + adjustments,
 * not actual" rule). Pass any row that has the two fields — `Bill`,
 * `Income`, or the partial shape from a draft.
 */
export function effectivePlanned(row: {
  amount: number;
  adjustments?: Adjustment[];
}): number {
  return row.amount + sumAdj(row.adjustments);
}

/**
 * Signed variance from plan. Positive = adjustments pushed the row up
 * (more income or higher bill), negative = pushed it down.
 */
export function variance(row: { adjustments?: Adjustment[] }): number {
  return sumAdj(row.adjustments);
}

export interface IncomeAdjEntry {
  /** Source-row id this adjustment belongs to. */
  id: string;
  source: string;
  /** Source-row anchor date — what the timeline/ledger renders at. */
  date: string;
  /** Net signed sum of the source's adjustments. */
  amount: number;
}

/**
 * Income adjustments expanded as one entry per source whose anchor date
 * falls in `range`. Income adjustments apply once per period — cadence
 * already drives the per-occurrence count from `amount`, so this stays
 * at one entry per source rather than per occurrence. Sources with
 * net-zero adjustments are omitted.
 */
export function incomeAdjEntries(
  income: Income[],
  range: DateRange | null,
): IncomeAdjEntry[] {
  const out: IncomeAdjEntry[] = [];
  for (const r of income) {
    if (!inRange(r.date, range)) continue;
    const amount = sumAdj(r.adjustments);
    if (amount === 0) continue;
    out.push({ id: r.id, source: r.source, date: r.date, amount });
  }
  return out;
}

/**
 * Total planned income in `range` including per-source adjustments —
 * the two halves a consumer needs to "see all the money this period."
 */
export function scopedIncomeWithAdj(
  income: Income[],
  range: DateRange | null,
): number {
  const fromOccurrences = expandAllIncome(income, range).reduce(
    (s, r) => s + r.amount,
    0,
  );
  const fromAdjustments = incomeAdjEntries(income, range).reduce(
    (s, e) => s + e.amount,
    0,
  );
  return fromOccurrences + fromAdjustments;
}

/**
 * Confirmed-or-received income in `range`, including adjustments on
 * confirmed/received sources whose anchor date is in `range`. Mirrors
 * `confirmedIncomeTotal` but folds in the per-source variance log.
 */
export function confirmedIncomeTotalWithAdj(
  income: Income[],
  range: DateRange | null,
): number {
  const fromOccurrences = expandAllIncome(income, range)
    .filter(isReceivedIncome)
    .reduce((s, r) => s + r.amount, 0);
  const fromAdjustments = income.reduce((s, r) => {
    if (!isReceivedIncome(r)) return s;
    if (!inRange(r.date, range)) return s;
    return s + sumAdj(r.adjustments);
  }, 0);
  return fromOccurrences + fromAdjustments;
}
