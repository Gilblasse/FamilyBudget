'use client';

import { useMemo } from 'react';
import { useBudget } from '@/lib/store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { expandAllIncome } from '@/lib/recurrence';
import { endingBalance, openingBalanceEntry } from '@/lib/derived';
import { fromIso, todayIso } from '@/lib/date-utils';
import type { Bill, IncomeOccurrence, Priority } from '@/lib/types';
import CashFlowPage, { type CashFlowPageProps } from './cash-flow-page';
import type { TimelineDay, TimelineTxn, TxnKind } from './cash-flow-timeline';

function priorityToKind(p: Priority): TxnKind {
  return p === 'crit' || p === 'imp' ? 'bill' : 'variable';
}

interface DayBucket {
  date: string;
  incomes: { source: string; amount: number }[];
  bills: Bill[];
}

export function CashFlow() {
  const balance = useBudget((s) => s.balance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const periods = useBudget((s) => s.periods);
  const range = useEffectiveDateRange();

  const pageProps = useMemo<CashFlowPageProps>(() => {
    const scopedIncome: IncomeOccurrence[] = expandAllIncome(income, range);
    const scopedBills = bills.filter(
      (b) => inRange(b.date, range) && b.action !== 'skip' && b.action !== 'delay',
    );

    const startIso = range?.start ?? periods[0]?.startDate ?? todayIso();

    const allIncome = scopedIncome.reduce((s, r) => s + r.amount, 0);
    const billsTotal = scopedBills.reduce((s, b) => s + b.amount, 0);
    const ending = endingBalance({
      openingBalance: balance,
      scopedIncome,
      scopedBills,
    });

    const buckets = new Map<string, DayBucket>();
    const ensure = (date: string): DayBucket => {
      const existing = buckets.get(date);
      if (existing) return existing;
      const fresh: DayBucket = { date, incomes: [], bills: [] };
      buckets.set(date, fresh);
      return fresh;
    };

    const opening = openingBalanceEntry(balance, startIso);
    if (opening) {
      // Signed amount: negative overdraft flows through the running sum below.
      ensure(opening.date).incomes.push({ source: opening.label, amount: opening.amount });
    }
    for (const r of scopedIncome) ensure(r.date).incomes.push({ source: r.source, amount: r.amount });
    for (const b of scopedBills) ensure(b.date).bills.push(b);

    const sortedDates = [...buckets.keys()].sort();
    const todayKey = todayIso();

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
        date: fromIso(date),
        income: headline ? { amount: headline.amount, label: headline.source } : undefined,
        items,
        runningBalance: running,
        isToday: date === todayKey,
      });
      return acc;
    }, []);

    return {
      openingBalance: balance,
      allIncome,
      bills: billsTotal,
      endingBalance: ending,
      timeline,
    };
  }, [balance, income, bills, periods, range]);

  return <CashFlowPage {...pageProps} />;
}
