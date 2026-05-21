'use client';

import { useMemo } from 'react';
import { useBudget } from '@/lib/store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { expandAllIncome } from '@/lib/recurrence';
import {
  ADJ_LABEL_SUFFIX,
  effectivePlanned,
  endingBalance,
  incomeAdjEntries,
  openingBalanceEntry,
} from '@/lib/derived';
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
  bills: { bill: Bill; effective: number }[];
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

    const incomeAdjs = incomeAdjEntries(income, range);
    const incomeAdjTotal = incomeAdjs.reduce((s, e) => s + e.amount, 0);

    // Precompute effective planned once per bill — read 3x below in
    // the timeline + total + ending-balance passes.
    const effectiveBills = scopedBills.map((b) => ({
      bill: b,
      effective: effectivePlanned(b),
    }));

    const allIncome =
      scopedIncome.reduce((s, r) => s + r.amount, 0) + incomeAdjTotal;
    const billsTotal = effectiveBills.reduce((s, e) => s + e.effective, 0);
    const ending = endingBalance({
      openingBalance: balance,
      scopedIncome: [...scopedIncome, ...incomeAdjs],
      scopedBills: effectiveBills.map((e) => ({ amount: e.effective })),
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
    for (const e of incomeAdjs) {
      ensure(e.date).incomes.push({
        source: `${e.source}${ADJ_LABEL_SUFFIX}`,
        amount: e.amount,
      });
    }
    for (const e of effectiveBills) ensure(e.bill.date).bills.push(e);

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
        ...bucket.bills.map<TimelineTxn>(({ bill, effective }) => ({
          label: bill.name,
          amount: -effective,
          kind: priorityToKind(bill.priority),
        })),
      ];

      const dayIncomeTotal = bucket.incomes.reduce((s, r) => s + r.amount, 0);
      const dayBillTotal = bucket.bills.reduce((s, e) => s + e.effective, 0);
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
