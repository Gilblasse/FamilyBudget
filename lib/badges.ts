/**
 * Unified badge variant helpers. Single source of truth — feature components
 * must import from here instead of defining local copies.
 *
 * Return type intentionally matches a subset of `components/ui/badge.tsx`'s
 * `variant` prop union, so callers can pass results directly to `<Badge variant={...} />`.
 */

import type { BillAction, IncomeStatus, Priority } from './types';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

/**
 * `pay-full` → `'success'` (the consensus from `summary.tsx`).
 * Previously `bills-table.tsx` returned `'default'` for the same input — that
 * disagreement is resolved here.
 */
export function actionVariant(action: BillAction): BadgeVariant {
  switch (action) {
    case 'pay-full':
      return 'success';
    case 'partial':
    case 'reduce':
      return 'warning';
    case 'skip':
    case 'delay':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function incomeStatusVariant(status: IncomeStatus): BadgeVariant {
  switch (status) {
    case 'received':
      return 'success';
    case 'confirmed':
      return 'info';
    case 'pending':
      return 'warning';
    case 'expected':
    default:
      return 'neutral';
  }
}

export function priorityVariant(priority: Priority): BadgeVariant {
  switch (priority) {
    case 'crit':
      return 'danger';
    case 'imp':
      return 'warning';
    case 'opt':
      return 'info';
    case 'flex':
    default:
      return 'neutral';
  }
}
