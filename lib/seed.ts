import type { Bill, BudgetPeriod, Income } from './types';

export const DEFAULT_PERIOD_ID = 'seed-period-1';

export const DEFAULT_PERIODS: BudgetPeriod[] = [
  { id: DEFAULT_PERIOD_ID, startDate: '2026-04-09', endDate: '2026-05-14' },
];

export const DEFAULT_INCOME: Income[] = [
  { id: 'seed-i1', periodId: DEFAULT_PERIOD_ID, source: 'Apr 15 paycheck', date: '2026-04-15', amount: 4191.76, status: 'expected' },
  { id: 'seed-i2', periodId: DEFAULT_PERIOD_ID, source: 'RBW-2026-07 / SkyHorizon', date: '2026-04-12', amount: 2250.0, status: 'pending' },
  { id: 'seed-i3', periodId: DEFAULT_PERIOD_ID, source: 'Apr 28 paycheck', date: '2026-04-28', amount: 5805.76, status: 'expected' },
  { id: 'seed-i4', periodId: DEFAULT_PERIOD_ID, source: 'Personal account', date: '2026-04-15', amount: 1575.0, status: 'expected' },
];

export const DEFAULT_BILLS: Bill[] = [
  { id: 'seed-b1', periodId: DEFAULT_PERIOD_ID, name: 'Rent (May 1)', date: '2026-05-01', amount: 2970.95, priority: 'crit', action: 'pay-full' },
  { id: 'seed-b2', periodId: DEFAULT_PERIOD_ID, name: 'Pers. Asst. Loan', date: '2026-05-01', amount: 180.82, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b3', periodId: DEFAULT_PERIOD_ID, name: 'PAL Plus Loan', date: '2026-05-01', amount: 137.99, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b4', periodId: DEFAULT_PERIOD_ID, name: 'Geico Renters', date: '2026-05-01', amount: 22.92, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b5', periodId: DEFAULT_PERIOD_ID, name: 'Kia Telluride', date: '2026-04-20', amount: 989.58, priority: 'crit', action: 'pay-full' },
  { id: 'seed-b6', periodId: DEFAULT_PERIOD_ID, name: 'Zip', date: '2026-04-21', amount: 463.77, priority: 'imp', action: 'partial' },
  { id: 'seed-b7', periodId: DEFAULT_PERIOD_ID, name: 'Citi', date: '2026-04-22', amount: 150.0, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b8', periodId: DEFAULT_PERIOD_ID, name: 'HVFCU CC', date: '2026-04-22', amount: 60.0, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b9', periodId: DEFAULT_PERIOD_ID, name: 'Ready Cash LOC', date: '2026-04-25', amount: 100.0, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b10', periodId: DEFAULT_PERIOD_ID, name: 'Petal', date: '2026-04-26', amount: 185.0, priority: 'imp', action: 'partial' },
  { id: 'seed-b11', periodId: DEFAULT_PERIOD_ID, name: 'Verizon', date: '2026-04-27', amount: 311.86, priority: 'crit', action: 'pay-full' },
  { id: 'seed-b12', periodId: DEFAULT_PERIOD_ID, name: 'Signature Loan', date: '2026-04-28', amount: 436.86, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b13', periodId: DEFAULT_PERIOD_ID, name: 'Ivery Capital One', date: '2026-04-15', amount: 86.0, priority: 'imp', action: 'pay-full' },
  { id: 'seed-b14', periodId: DEFAULT_PERIOD_ID, name: 'Capital One Telly', date: '2026-04-09', amount: 239.18, priority: 'imp', action: 'partial' },
  { id: 'seed-b15', periodId: DEFAULT_PERIOD_ID, name: 'Subscriptions (half)', date: '2026-04-15', amount: 314.36, priority: 'opt', action: 'reduce' },
  { id: 'seed-b16', periodId: DEFAULT_PERIOD_ID, name: 'Groceries', date: '2026-04-14', amount: 600.0, priority: 'crit', action: 'pay-full' },
  { id: 'seed-b17', periodId: DEFAULT_PERIOD_ID, name: 'Groceries', date: '2026-04-28', amount: 600.0, priority: 'crit', action: 'pay-full' },
  { id: 'seed-b18', periodId: DEFAULT_PERIOD_ID, name: 'Gas & Oil', date: '2026-04-14', amount: 85.0, priority: 'crit', action: 'pay-full' },
  { id: 'seed-b19', periodId: DEFAULT_PERIOD_ID, name: 'Blow Money', date: '2026-04-14', amount: 100.0, priority: 'flex', action: 'reduce' },
  { id: 'seed-b20', periodId: DEFAULT_PERIOD_ID, name: 'Car Insurance', date: '2026-04-09', amount: 275.43, priority: 'crit', action: 'pay-full' },
];
