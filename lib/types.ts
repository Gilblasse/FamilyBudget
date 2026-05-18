export type IncomeStatus = 'expected' | 'confirmed' | 'pending' | 'received';
export type IncomeCadence = 'once' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type Priority = 'crit' | 'imp' | 'opt' | 'flex';
export type BillAction = 'pay-full' | 'partial' | 'delay' | 'reduce' | 'skip';

export interface BudgetPeriod {
  id: string;
  startDate: string;
  endDate: string;
  label?: string;
}

export interface Income {
  id: string;
  periodId: string;
  source: string;
  // Anchor date — first occurrence when cadence is recurring.
  date: string;
  amount: number;
  // For recurring rows, this is the default status applied to every projected
  // occurrence; per-occurrence "received" lives in PaidState under occurrenceKey().
  status: IncomeStatus;
  cadence?: IncomeCadence;
  // Only used when cadence === 'semimonthly'. 1–31; clamped to month-end.
  secondDay?: number;
  // Optional inclusive cutoff (ISO). Missing = indefinite.
  endDate?: string;
}

export interface IncomeOccurrence {
  incomeId: string;
  periodId: string;
  source: string;
  amount: number;
  status: IncomeStatus;
  cadence: IncomeCadence;
  date: string;
  key: string;
  isRecurring: boolean;
}

export interface Bill {
  id: string;
  periodId: string;
  name: string;
  date: string;
  amount: number;
  priority: Priority;
  action: BillAction;
  // Optional categorical tags. Added in store v8 to replace the brittle
  // substring match on `name`. The `'subscription'` tag drives the
  // collapsible "Subscriptions" bucket in the bills table.
  tags?: string[];
}

export type PaidState = Record<string, boolean>;

export interface DateRange {
  start: string;
  end: string;
}

export interface BudgetSnapshot {
  balance: number;
  income: Income[];
  bills: Bill[];
  paid: PaidState;
  periods: BudgetPeriod[];
  activePeriodId: string;
  dateRange: DateRange | null;
}

export interface BudgetMeta {
  id: string;
  name: string;
  createdAt: string;
  defaultRange: DateRange;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  crit: 'Critical',
  imp: 'Important',
  opt: 'Optional',
  flex: 'Flexible',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  crit: 0,
  imp: 1,
  opt: 2,
  flex: 3,
};

export const ACTION_LABEL: Record<BillAction, string> = {
  'pay-full': 'Pay full',
  partial: 'Partial',
  delay: 'Delay',
  reduce: 'Reduce',
  skip: 'Skip',
};

export const STATUS_LABEL: Record<IncomeStatus, string> = {
  expected: 'Expected',
  confirmed: 'Confirmed',
  pending: 'Pending',
  received: 'Received',
};

export const CADENCE_LABEL: Record<IncomeCadence, string> = {
  once: 'Once',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semimonthly: 'Semi-monthly',
  monthly: 'Monthly',
};
