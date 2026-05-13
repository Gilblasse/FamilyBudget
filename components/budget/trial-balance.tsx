'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { fmt, fd, fdRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';

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
  const rawRange = useBudget((s) => s.dateRange);
  const range = useEffectiveDateRange();

  const { totals, groupsByDate, openingDate } = useMemo(() => {
    const scopedIncome = income.filter(
      (r) => r.periodId === activePeriodId && inRange(r.date, range),
    );
    const scopedBills = bills.filter(
      (b) => b.periodId === activePeriodId && inRange(b.date, range),
    );
    const activePeriod = periods.find((p) => p.id === activePeriodId);
    const openingDate = range?.start ?? activePeriod?.startDate ?? '2026-04-09';

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
  }, [balance, income, bills, paid, activePeriodId, periods, range]);

  const sortedDates = [...groupsByDate.keys()].sort();

  function handleToggle(key: string, label: string, type: 'inc' | 'exp', wasPaid: boolean) {
    togglePaid(key);
    const action = wasPaid
      ? 'Reverted'
      : type === 'inc'
      ? 'Marked received'
      : 'Marked paid';
    toast.success(`${action} · ${label}`, {
      action: {
        label: 'Undo',
        onClick: () => togglePaid(key),
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {rawRange && range ? (
        <div className="rounded-lg border border-info-500/30 bg-info-50 px-3 py-2 text-xs text-info-700">
          <span className="font-medium">Filtered:</span> {fdRange(range.start, range.end)} — showing a slice of the period.
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-2xl border border-border-subtle bg-card md:block">
        <Table>
          <TableHeader sticky>
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
                onToggle={handleToggle}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-4 md:hidden">
        {sortedDates.map((date) => {
          const rows = groupsByDate.get(date) ?? [];
          const isOpeningOnly = rows.length > 0 && rows.every((r) => r.isOpening);
          const label = isOpeningOnly && date === openingDate ? 'Opening' : fd(date);
          return (
            <div key={date} className="space-y-2">
              <div className="rounded-md bg-muted/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const isInc = r.type === 'inc';
                  return (
                    <div
                      key={r.key}
                      className={cn(
                        'space-y-2 rounded-2xl border border-border-subtle bg-card p-3',
                        r.paid && 'opacity-60'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {r.paid ? (
                            <Check className="size-3.5 text-success-500" aria-hidden />
                          ) : null}
                          {r.label}
                          {r.note && (
                            <span className="ml-1 text-[10px] text-warning-700">({r.note})</span>
                          )}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-medium money',
                            isInc ? 'text-success-700' : 'text-danger-700',
                          )}
                        >
                          {isInc ? '+ ' : '− '}
                          {fmt(r.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Balance</span>
                        {r.paid ? (
                          <span
                            className={cn(
                              'font-medium money',
                              r.balAfter >= 0 ? 'text-success-700' : 'text-danger-700'
                            )}
                          >
                            {fmt(r.balAfter)}
                          </span>
                        ) : (
                          <span className="money text-muted-foreground">
                            {fmt(r.projected)}*
                          </span>
                        )}
                      </div>
                      {r.isOpening ? (
                        <Badge size="sm" variant="success">Opening</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggle(r.key, r.label, r.type, r.paid)}
                          className="h-10 w-full"
                        >
                          {r.paid
                            ? isInc
                              ? 'Received'
                              : 'Paid'
                            : isInc
                            ? 'Mark received'
                            : 'Mark paid'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
  onToggle: (key: string, label: string, type: 'inc' | 'exp', wasPaid: boolean) => void;
}) {
  const isOpeningOnly = rows.length > 0 && rows.every((r) => r.isOpening);
  const label = isOpeningOnly && date === openingDate ? 'Opening' : fd(date);
  return (
    <>
      <TableRow className="bg-surface-2 hover:bg-surface-2">
        <TableCell colSpan={6} className="py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </TableCell>
      </TableRow>
      {rows.map((r) => {
        const isInc = r.type === 'inc';
        return (
          <TableRow key={r.key} className={cn(r.paid && 'opacity-60')}>
            <TableCell className="text-xs text-muted-foreground">{fd(r.date)}</TableCell>
            <TableCell className="text-sm">
              <span className="inline-flex items-center gap-1.5">
                {r.paid ? (
                  <Check className="size-3.5 text-success-500" aria-hidden />
                ) : null}
                {r.label}
              </span>
              {r.note && (
                <span className="ml-1 text-[10px] text-warning-700">({r.note})</span>
              )}
            </TableCell>
            <TableCell className="text-right money">
              {isInc && (
                <span className="font-medium text-success-700">{fmt(r.amount)}</span>
              )}
            </TableCell>
            <TableCell className="text-right money">
              {!isInc && (
                <span className="text-danger-700">{fmt(r.amount)}</span>
              )}
            </TableCell>
            <TableCell className="text-right money">
              {r.paid ? (
                <span
                  className={cn(
                    'font-medium',
                    r.balAfter >= 0 ? 'text-success-700' : 'text-danger-700'
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
                <Badge size="sm" variant="success">Opening</Badge>
              ) : r.paid ? (
                <Badge size="sm" variant="success">
                  <Check className="size-3" /> {isInc ? 'Received' : 'Paid'}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-full px-2.5 text-[11px]"
                  onClick={() => onToggle(r.key, r.label, r.type, r.paid)}
                >
                  {isInc ? 'Mark received' : 'Mark paid'}
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
