'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Metric } from './metric';
import { useBudget } from '@/lib/store';
import { fmt, fd } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Entry {
  key: string;
  date: string;
  label: string;
  amount: number;
  type: 'inc' | 'exp';
  paid: boolean;
  note?: string;
  isOpening?: boolean;
}

export function TrialBalance() {
  const balance = useBudget((s) => s.balance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const paid = useBudget((s) => s.paid);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const periods = useBudget((s) => s.periods);
  const togglePaid = useBudget((s) => s.togglePaid);

  const { totals, groupsByDate, openingDate } = useMemo(() => {
    const scopedIncome = income.filter((r) => r.periodId === activePeriodId);
    const scopedBills = bills.filter((b) => b.periodId === activePeriodId);
    const activePeriod = periods.find((p) => p.id === activePeriodId);
    const openingDate = activePeriod?.startDate ?? '2026-04-09';

    const list: Entry[] = [];
    if (balance > 0) {
      list.push({
        key: 'open',
        date: openingDate,
        label: 'Opening bank balance',
        amount: balance,
        type: 'inc',
        paid: true,
        isOpening: true,
      });
    }
    for (const r of scopedIncome) {
      const key = `inc_${r.id}`;
      list.push({
        key,
        date: r.date,
        label: r.source,
        amount: r.amount,
        type: 'inc',
        paid: !!paid[key],
        note: r.status === 'pending' ? 'pending' : undefined,
      });
    }
    for (const b of scopedBills) {
      if (b.action === 'skip' || b.action === 'delay') continue;
      const key = `bill_${b.id}`;
      list.push({
        key,
        date: b.date,
        label: b.name,
        amount: b.amount,
        type: 'exp',
        paid: !!paid[key],
      });
    }
    list.sort((a, b) => {
      if (a.isOpening && !b.isOpening) return -1;
      if (!a.isOpening && b.isOpening) return 1;
      return a.date.localeCompare(b.date) || a.type.localeCompare(b.type);
    });

    let actualNow = 0;
    let paidOut = 0;
    let paidIn = 0;
    let pendingIn = 0;
    for (const e of list) {
      if (e.paid) {
        if (e.type === 'inc') {
          actualNow += e.amount;
          paidIn += e.amount;
        } else {
          actualNow -= e.amount;
          paidOut += e.amount;
        }
      } else if (e.type === 'inc') {
        pendingIn += e.amount;
      }
    }

    const withBal = list.reduce<(Entry & { balBefore: number; balAfter: number; projected: number })[]>(
      (acc, e) => {
        const before = acc.length > 0 ? acc[acc.length - 1].balAfter : 0;
        const delta = e.type === 'inc' ? e.amount : -e.amount;
        const balAfter = e.paid ? before + delta : before;
        const projected = e.paid ? balAfter : balAfter + delta;
        acc.push({ ...e, balBefore: before, balAfter, projected });
        return acc;
      },
      []
    );

    const groupsByDate = new Map<string, typeof withBal>();
    for (const w of withBal) {
      const arr = groupsByDate.get(w.date) ?? [];
      arr.push(w);
      groupsByDate.set(w.date, arr);
    }

    return {
      totals: { actualNow, paidOut, paidIn, pendingIn },
      groupsByDate,
      openingDate,
    };
  }, [balance, income, bills, paid, activePeriodId, periods]);

  const sortedDates = [...groupsByDate.keys()].sort();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Actual balance now"
          value={fmt(totals.actualNow)}
          tone={totals.actualNow >= 0 ? 'income' : 'expense'}
        />
        <Metric label="Paid out" value={fmt(totals.paidOut)} tone="expense" />
        <Metric label="Received" value={fmt(totals.paidIn)} tone="income" />
        <Metric label="Still pending" value={fmt(totals.pendingIn)} tone="warning" />
      </div>

      <p className="text-xs text-muted-foreground">
        Running ledger — mark each item as paid when it clears.
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[13%]">Date</TableHead>
              <TableHead className="w-[30%]">Description</TableHead>
              <TableHead className="w-[13%] text-right">In (+)</TableHead>
              <TableHead className="w-[13%] text-right">Out (−)</TableHead>
              <TableHead className="w-[16%] text-right">Balance</TableHead>
              <TableHead className="w-[15%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDates.map((date) => (
              <RowGroup
                key={date}
                date={date}
                openingDate={openingDate}
                rows={groupsByDate.get(date) ?? []}
                onToggle={togglePaid}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        * Muted balance = projected if this clears. Toggle items paid/received to update your
        actual running balance.
      </p>
    </div>
  );
}

function RowGroup({
  date,
  openingDate,
  rows,
  onToggle,
}: {
  date: string;
  openingDate: string;
  rows: (Entry & { balBefore: number; balAfter: number; projected: number })[];
  onToggle: (key: string) => void;
}) {
  const isOpeningOnly = rows.length > 0 && rows.every((r) => r.isOpening);
  const label = isOpeningOnly && date === openingDate ? 'Opening' : fd(date);
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={6} className="py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </TableCell>
      </TableRow>
      {rows.map((r) => {
        const isInc = r.type === 'inc';
        return (
          <TableRow key={r.key} className={cn(r.paid && 'opacity-60')}>
            <TableCell className="text-xs text-muted-foreground">{fd(r.date)}</TableCell>
            <TableCell className="text-sm">
              <span className={cn(r.paid && 'line-through')}>{r.label}</span>
              {r.note && (
                <span className="ml-1 text-[10px] text-warning">({r.note})</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {isInc && (
                <span className={cn('font-medium text-income', r.paid && 'line-through')}>
                  {fmt(r.amount)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {!isInc && (
                <span className={cn('text-expense', r.paid && 'line-through')}>{fmt(r.amount)}</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.paid ? (
                <span
                  className={cn(
                    'font-medium',
                    r.balAfter >= 0 ? 'text-income' : 'text-expense'
                  )}
                >
                  {fmt(r.balAfter)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{fmt(r.projected)}*</span>
              )}
            </TableCell>
            <TableCell>
              {r.isOpening ? (
                <span className="text-xs font-medium text-income">Opening</span>
              ) : (
                <Button
                  size="sm"
                  variant={r.paid ? 'default' : 'outline'}
                  className="h-6 rounded-full px-3 text-[11px]"
                  onClick={() => onToggle(r.key)}
                >
                  {r.paid ? (isInc ? 'Received' : 'Paid') : isInc ? 'Mark received' : 'Mark paid'}
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
