'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Wand2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Metric } from './metric';
import { PriorityDot } from './priority-dot';
import { AiBoundary } from './ai/ai-boundary';
import { useAILauncher } from './ai/ai-launcher-provider';
import { useBudget } from '@/lib/store';
import { fmt, fd } from '@/lib/format';
import { ACTION_LABEL, PRIORITY_ORDER } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { expandAllIncome } from '@/lib/recurrence';
import { endingBalance, isActiveBill, isImportantBill } from '@/lib/derived';
import { actionVariant } from '@/lib/badges';
import { applySort, dirFor, nextDir, type SortState } from '@/lib/sort';

type AlertTone = 'ok' | 'warn' | 'risk';

function Alert({ tone, icon: Icon, children }: { tone: AlertTone; icon: React.ElementType; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'border-success-500 bg-success-50 text-success-700'
      : tone === 'warn'
      ? 'border-warning-500 bg-warning-50 text-warning-700'
      : 'border-danger-500 bg-danger-50 text-danger-700';
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border-l-4 px-3 py-2 text-sm', cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

type SortCol = 'name' | 'due';

export function Summary() {
  const balance = useBudget((s) => s.balance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const range = useEffectiveDateRange();
  const { openAssistant } = useAILauncher();
  const [sort, setSort] = useState<SortState<SortCol>>(null);

  const { totalInc, totalB, critImp, net, pending, partial, sorted } = useMemo(() => {
    const scopedIncome = expandAllIncome(income, range);
    const scopedBills = bills.filter((b) => inRange(b.date, range));
    const totalInc = endingBalance({
      openingBalance: balance,
      scopedIncome,
      scopedBills: [],
    });
    const active = scopedBills.filter(isActiveBill);
    const totalB = active.reduce((s, b) => s + b.amount, 0);
    const critImp = active
      .filter(isImportantBill)
      .reduce((s, b) => s + b.amount, 0);
    const pending = scopedIncome.filter((r) => r.status === 'pending');
    const partial = scopedBills.filter((b) => b.action === 'partial');
    const sorted = sort
      ? applySort(scopedBills, sort, {
          name: (b) => b.name,
          due: (b) => b.date,
        })
      : [...scopedBills].sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.date.localeCompare(b.date),
        );
    return { totalInc, totalB, critImp, net: totalInc - totalB, pending, partial, sorted };
  }, [balance, income, bills, range, sort]);

  function cycleSort(col: SortCol) {
    setSort((s) => nextDir(s, col));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Bank balance" value={fmt(balance)} tone={balance > 0 ? 'income' : 'default'} />
        <Metric label="Total resources" value={fmt(totalInc)} tone="income" />
        <Metric label="Total bills" value={fmt(totalB)} />
        <Metric label="Net" value={fmt(net)} tone={net >= 0 ? 'income' : 'expense'} />
        <Metric label="Min needed" value={fmt(critImp)} tone="warning" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Coverage check
          </div>
          <AiBoundary>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 sm:h-9"
              onClick={() => openAssistant('suggestions')}
            >
              <Wand2 className="h-4 w-4" /> Get suggestions
            </Button>
          </AiBoundary>
        </div>
        {net < 0 ? (
          <Alert tone="risk" icon={AlertCircle}>
            <strong>Shortfall:</strong> Bills exceed resources by {fmt(Math.abs(net))}. Skip or delay Optional / Flexible items.
          </Alert>
        ) : (
          <Alert tone="ok" icon={CheckCircle2}>
            All active bills covered. Ending surplus: {fmt(net)}.
          </Alert>
        )}
        {totalInc >= critImp ? (
          <Alert tone="ok" icon={CheckCircle2}>Critical + Important fully covered.</Alert>
        ) : (
          <Alert tone="risk" icon={AlertCircle}>
            Resources fall short of Critical + Important by {fmt(critImp - totalInc)}.
          </Alert>
        )}
        {pending.length > 0 && (
          <Alert tone="warn" icon={AlertTriangle}>
            {pending.length} income source{pending.length === 1 ? '' : 's'} still pending — confirm receipt dates.
          </Alert>
        )}
        {partial.length > 0 && (
          <Alert tone="warn" icon={AlertTriangle}>
            Partial pay on: {partial.map((b) => b.name).join(', ')}. Catch up next check.
          </Alert>
        )}
        {balance === 0 && (
          <Alert tone="warn" icon={AlertTriangle}>
            Bank balance not entered — add your current balance above for an accurate starting point.
          </Alert>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          All bills by priority
        </div>
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-card">
          <Table>
            <TableHeader sticky>
              <TableRow>
                <TableHead
                  className="w-[44%]"
                  sortable
                  direction={dirFor(sort, 'name')}
                  onSort={() => cycleSort('name')}
                >
                  Name
                </TableHead>
                <TableHead className="w-[18%] text-right">Amount</TableHead>
                <TableHead
                  className="hidden w-[18%] sm:table-cell"
                  sortable
                  direction={dirFor(sort, 'due')}
                  onSort={() => cycleSort('due')}
                >
                  Due
                </TableHead>
                <TableHead className="w-[20%]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const skipped = r.action === 'skip' || r.action === 'delay';
                return (
                  <TableRow key={r.id} className={cn(skipped && 'opacity-50')}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <PriorityDot priority={r.priority} />
                        {r.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right money">{fmt(r.amount)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{fd(r.date)}</TableCell>
                    <TableCell>
                      <Badge size="sm" variant={actionVariant(r.action)}>
                        {ACTION_LABEL[r.action]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
