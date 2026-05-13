export type IncomeStatus = 'expected' | 'confirmed' | 'pending' | 'received';
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
  date: string;
  amount: number;
  status: IncomeStatus;
}

export interface Bill {
  id: string;
  periodId: string;
  name: string;
  date: string;
  amount: number;
  priority: Priority;
  action: BillAction;
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
