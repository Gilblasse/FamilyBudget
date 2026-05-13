'use client';

import { useMemo } from 'react';
import { useBudget } from '@/lib/store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import type { Bill, Income, Priority } from '@/lib/types';
import CashFlowPage, { type CashFlowPageProps } from './cash-flow-page';
import type { TimelineDay, TimelineTxn, TxnKind } from './cash-flow-timeline';

const DEFAULT_USER = { name: 'Family Budget', initials: 'FB' } as const;

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function todayUtcKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function priorityToKind(p: Priority): TxnKind {
  return p === 'crit' || p === 'imp' ? 'bill' : 'variable';
}

interface DayBucket {
  date: string;
  incomes: Income[];
  bills: Bill[];
}

export function CashFlow() {
  const balance = useBudget((s) => s.balance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const periods = useBudget((s) => s.periods);
  const range = useEffectiveDateRange();

  const pageProps = useMemo<CashFlowPageProps>(() => {
    const scopedIncome = income.filter(
      (r) => r.periodId === activePeriodId && inRange(r.date, range),
    );
    const scopedBills = bills.filter(
      (b) =>
        b.periodId === activePeriodId &&
        inRange(b.date, range) &&
        b.action !== 'skip' &&
        b.action !== 'delay',
    );

    const activePeriod = periods.find((p) => p.id === activePeriodId);
    const startIso = range?.start ?? activePeriod?.startDate ?? '2026-04-09';
    const endIso = range?.end ?? activePeriod?.endDate ?? '2026-05-14';

    const allIncome = scopedIncome.reduce((s, r) => s + r.amount, 0);
    const billsTotal = scopedBills.reduce((s, b) => s + b.amount, 0);
    const endingBalance = balance + allIncome - billsTotal;

    const buckets = new Map<string, DayBucket>();
    const ensure = (date: string): DayBucket => {
      const existing = buckets.get(date);
      if (existing) return existing;
      const fresh: DayBucket = { date, incomes: [], bills: [] };
      buckets.set(date, fresh);
      return fresh;
    };

    if (balance > 0) {
      ensure(startIso).incomes.push({
        id: 'opening',
        periodId: activePeriodId,
        source: 'Opening balance',
        date: startIso,
        amount: balance,
        status: 'received',
      });
    }
    for (const r of scopedIncome) ensure(r.date).incomes.push(r);
    for (const b of scopedBills) ensure(b.date).bills.push(b);

    const sortedDates = [...buckets.keys()].sort();
    const todayIso = todayUtcKey();

    const timeline = sortedDates.reduce<TimelineDay[]>((acc, date) => {
      const bucket = buckets.get(date);
      if (!bucket) return acc;

      const sortedIncomes = [...bucket.incomes].sort((a, b) => b.amount - a.amount);
      const headline = sortedIncomes[0];
      const extraIncomes = sortedIncomes.slice(1);

      const items: TimelineTxn[] = [
        ...extraIncomes.map<TimelineTxn>((r) => ({
          label: r.source,
          amount: r.amount,
          kind: 'income',
        })),
        ...bucket.bills.map<TimelineTxn>((b) => ({
          label: b.name,
          amount: -b.amount,
          kind: priorityToKind(b.priority),
        })),
      ];

      const dayIncomeTotal = bucket.incomes.reduce((s, r) => s + r.amount, 0);
      const dayBillTotal = bucket.bills.reduce((s, b) => s + b.amount, 0);
      const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
      const running = prev + dayIncomeTotal - dayBillTotal;

      acc.push({
        date: parseUtc(date),
        income: headline ? { amount: headline.amount, label: headline.source } : undefined,
        items,
        runningBalance: running,
        isToday: date === todayIso,
      });
      return acc;
    }, []);

    return {
      dateRange: { start: parseUtc(startIso), end: parseUtc(endIso) },
      user: { ...DEFAULT_USER },
      openingBalance: balance,
      allIncome,
      bills: billsTotal,
      endingBalance,
      timeline,
    };
  }, [balance, income, bills, activePeriodId, periods, range]);

  return <CashFlowPage {...pageProps} />;
}
