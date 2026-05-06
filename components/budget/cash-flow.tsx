'use client';

import { useMemo } from 'react';
import { Metric } from './metric';
import { PriorityDot } from './priority-dot';
import { useBudget } from '@/lib/store';
import { fmt, fd } from '@/lib/format';
import { ACTION_LABEL, type Bill, type Income } from '@/lib/types';
import { cn } from '@/lib/utils';

type IncEvent = {
  type: 'inc';
  date: string;
  label: string;
  amount: number;
  status?: Income['status'] | 'opening';
};
type BillEvent = {
  type: 'bill';
  date: string;
  label: string;
  amount: number;
  priority: Bill['priority'];
  action: Bill['action'];
};
type Event = IncEvent | BillEvent;

export function CashFlow() {
  const balance = useBudget((s) => s.balance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const periods = useBudget((s) => s.periods);

  const { totalInc, totalB, net, groups } = useMemo(() => {
    const scopedIncome = income.filter((r) => r.periodId === activePeriodId);
    const scopedBills = bills.filter((b) => b.periodId === activePeriodId);
    const activePeriod = periods.find((p) => p.id === activePeriodId);
    const openingDate = activePeriod?.startDate ?? '2026-04-09';

    const events: Event[] = [];
    if (balance > 0) {
      events.push({
        type: 'inc',
        date: openingDate,
        label: 'Opening bank balance',
        amount: balance,
        status: 'opening',
      });
    }
    for (const r of scopedIncome) {
      events.push({
        type: 'inc',
        date: r.date,
        label: r.source,
        amount: r.amount,
        status: r.status,
      });
    }
    for (const b of scopedBills) {
      if (b.action === 'skip' || b.action === 'delay') continue;
      events.push({
        type: 'bill',
        date: b.date,
        label: b.name,
        amount: b.amount,
        priority: b.priority,
        action: b.action,
      });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

    const byDate = new Map<string, Event[]>();
    for (const e of events) {
      const arr = byDate.get(e.date) ?? [];
      arr.push(e);
      byDate.set(e.date, arr);
    }

    const groups = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<{ date: string; evs: Event[]; running: number }[]>((acc, [date, evs]) => {
        const dayInc = evs
          .filter((e): e is IncEvent => e.type === 'inc')
          .reduce((s, e) => s + e.amount, 0);
        const dayOut = evs
          .filter((e): e is BillEvent => e.type === 'bill')
          .reduce((s, e) => s + e.amount, 0);
        const prev = acc.length > 0 ? acc[acc.length - 1].running : 0;
        acc.push({ date, evs, running: prev + dayInc - dayOut });
        return acc;
      }, []);

    const totalInc = balance + scopedIncome.reduce((s, r) => s + r.amount, 0);
    const totalB = scopedBills
      .filter((b) => b.action !== 'skip' && b.action !== 'delay')
      .reduce((s, b) => s + b.amount, 0);
    return { totalInc, totalB, net: totalInc - totalB, groups };
  }, [balance, income, bills, activePeriodId, periods]);

  const max = Math.max(totalInc, totalB, 1);
  const incPct = Math.round((totalInc / max) * 100);
  const billPct = Math.round((totalB / max) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Opening balance"
          value={fmt(balance)}
          tone={balance > 0 ? 'income' : 'default'}
        />
        <Metric label="+ All income" value={fmt(totalInc - balance)} tone="income" />
        <Metric label="- Bills" value={fmt(totalB)} />
        <Metric
          label="Ending balance"
          value={fmt(net)}
          tone={net >= 0 ? 'income' : 'expense'}
        />
      </div>

      <div className="space-y-4 sm:space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center justify-between gap-3 sm:contents">
            <span className="text-xs text-muted-foreground sm:min-w-[110px]">
              Income + balance
            </span>
            <span className="order-3 text-xs tabular-nums sm:min-w-[80px] sm:text-right">
              {fmt(totalInc)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:flex-1">
            <div
              className="h-full bg-income transition-all"
              style={{ width: `${incPct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center justify-between gap-3 sm:contents">
            <span className="text-xs text-muted-foreground sm:min-w-[110px]">Total bills</span>
            <span className="order-3 text-xs tabular-nums sm:min-w-[80px] sm:text-right">
              {fmt(totalB)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:flex-1">
            <div
              className="h-full bg-expense transition-all"
              style={{ width: `${billPct}%` }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Day-by-day timeline
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events.</p>
        ) : (
          <div className="space-y-3">
            {groups.map(({ date, evs, running }) => (
              <div key={date} className="flex gap-3">
                <div className="min-w-[56px] pt-0.5 text-xs font-medium text-muted-foreground">
                  {fd(date)}
                </div>
                <div
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                    running >= 0 ? 'bg-income' : 'bg-expense'
                  )}
                />
                <div className="flex-1 space-y-1">
                  {evs
                    .filter((e): e is IncEvent => e.type === 'inc')
                    .map((e, i) => (
                      <div key={`i-${i}`} className="text-sm font-medium text-income tabular-nums">
                        + {fmt(e.amount)} · {e.label}
                        {e.status === 'pending' && (
                          <span className="ml-1 text-xs font-normal text-warning">
                            (pending)
                          </span>
                        )}
                      </div>
                    ))}
                  {evs
                    .filter((e): e is BillEvent => e.type === 'bill')
                    .map((e, i) => (
                      <div
                        key={`b-${i}`}
                        className="flex items-center gap-2 text-sm text-expense tabular-nums"
                      >
                        <PriorityDot priority={e.priority} />
                        <span>
                          - {fmt(e.amount)} {e.label}
                          {e.action !== 'pay-full' && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              [{ACTION_LABEL[e.action]}]
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  <div
                    className={cn(
                      'text-xs tabular-nums',
                      running >= 0 ? 'text-income' : 'text-expense'
                    )}
                  >
                    Running balance: {fmt(running)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
