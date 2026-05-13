'use client';

import { useMemo } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useBudget } from '@/lib/store';
import { fd, fmt } from '@/lib/format';
import { useMounted } from '@/lib/use-mounted';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HeroAmount, OverviewCard } from './overview-card';

const TOOLTIP_MAX_ROWS = 5;

export function ExpenseOverviewCard() {
  const mounted = useMounted();
  const bills = useBudget((s) => s.bills);
  const paid = useBudget((s) => s.paid);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const range = useEffectiveDateRange();

  const stats = useMemo(() => {
    const scoped = bills.filter(
      (b) => b.periodId === activePeriodId && inRange(b.date, range),
    );
    const total = scoped.reduce((s, b) => s + b.amount, 0);
    const paidTotal = scoped
      .filter((b) => paid[`bill_${b.id}`])
      .reduce((s, b) => s + b.amount, 0);
    const paidPct = total > 0 ? Math.min(paidTotal / total, 1) : 0;

    const critScoped = scoped.filter((b) => b.priority === 'crit');
    const unpaidCrit = critScoped
      .filter((b) => !paid[`bill_${b.id}`])
      .sort((a, b) => a.date.localeCompare(b.date));
    const unpaidCritTotal = unpaidCrit.reduce((s, b) => s + b.amount, 0);
    const critPaidTotal = critScoped
      .filter((b) => paid[`bill_${b.id}`])
      .reduce((s, b) => s + b.amount, 0);

    return {
      total,
      paidTotal,
      paidPct,
      critCount: critScoped.length,
      unpaidCrit,
      unpaidCritTotal,
      critPaidTotal,
    };
  }, [bills, paid, activePeriodId, range]);

  const pct = Math.round(stats.paidPct * 100);
  const visibleUnpaid = stats.unpaidCrit.slice(0, TOOLTIP_MAX_ROWS);
  const remainingUnpaid = stats.unpaidCrit.length - visibleUnpaid.length;

  return (
    <OverviewCard title="Total expense">
      <HeroAmount amount={mounted ? stats.total : 0} />

      <div className="mt-3 hidden flex-wrap items-baseline gap-x-3 gap-y-1.5 md:flex">
        {stats.unpaidCrit.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  size="sm"
                  variant="danger"
                  tabIndex={0}
                  aria-label={`${stats.unpaidCrit.length} critical unpaid bills, ${fmt(stats.unpaidCritTotal)} total`}
                  className="cursor-default"
                />
              }
            >
              <AlertTriangle className="size-3" />
              {stats.unpaidCrit.length} critical unpaid
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="w-72 max-w-sm items-stretch px-3 py-2.5"
            >
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-background/70">
                    Critical unpaid
                  </span>
                  <span className="money tabular-nums text-xs font-semibold">
                    {fmt(stats.unpaidCritTotal)}
                  </span>
                </div>
                <div className="h-px bg-background/15" />
                <ul className="flex flex-col gap-1">
                  {visibleUnpaid.map((b) => (
                    <li
                      key={b.id}
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2.5 text-xs"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-danger-500"
                      />
                      <span className="min-w-0 truncate">{b.name}</span>
                      <span className="tabular-nums text-background/70">
                        {fd(b.date)}
                      </span>
                      <span className="money tabular-nums font-semibold">
                        {fmt(b.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                {remainingUnpaid > 0 ? (
                  <div className="text-[11px] text-background/60">
                    +{remainingUnpaid} more
                  </div>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  size="sm"
                  variant="success"
                  tabIndex={0}
                  aria-label={
                    stats.critCount === 0
                      ? 'No critical bills this period'
                      : `All ${stats.critCount} critical bills paid, ${fmt(stats.critPaidTotal)} covered`
                  }
                  className="cursor-default"
                />
              }
            >
              <Check className="size-3" />
              No critical unpaid
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="w-64 max-w-sm items-stretch px-3 py-2.5"
            >
              {stats.critCount === 0 ? (
                <div className="text-xs text-background/80">
                  No critical bills this period
                </div>
              ) : (
                <div className="flex w-full flex-col gap-1.5">
                  <div className="text-xs font-medium">
                    All {stats.critCount} critical{' '}
                    {stats.critCount === 1 ? 'bill' : 'bills'} paid
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] uppercase tracking-wide text-background/70">
                      Covered
                    </span>
                    <span className="money tabular-nums text-xs font-semibold">
                      {fmt(stats.critPaidTotal)}
                    </span>
                  </div>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          Paid <span className="money font-medium text-foreground">{fmt(stats.paidTotal)}</span>
        </span>
      </div>

      <div className="mt-auto hidden pt-6 md:block">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            % paid
          </span>
          <span className="text-2xl font-semibold money tracking-tight">
            {mounted ? pct : 0}
            <span className="ml-0.5 text-sm text-muted-foreground">%</span>
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-success-500 transition-[width] duration-500"
            style={{ width: `${mounted ? pct : 0}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 w-px bg-foreground/40"
            aria-hidden
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>0%</span>
          <span>Goal: 100% paid</span>
        </div>
      </div>
    </OverviewCard>
  );
}
