'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import { useMounted } from '@/lib/use-mounted';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { OverviewCard, HeroAmount } from './overview-card';
import type { IncomeStatus } from '@/lib/types';

const STATUS_COLOR: Record<IncomeStatus, string> = {
  received: 'bg-success-500',
  confirmed: 'bg-info-500',
  pending: 'bg-warning-500',
  expected: 'bg-neutral-400',
};

const STATUS_LABEL_SHORT: Record<IncomeStatus, string> = {
  received: 'received',
  confirmed: 'confirmed',
  pending: 'pending',
  expected: 'expected',
};

const LEGEND_ORDER: IncomeStatus[] = ['received', 'confirmed', 'pending', 'expected'];

export function IncomeOverviewCard() {
  const mounted = useMounted();
  const income = useBudget((s) => s.income);
  const addIncome = useBudget((s) => s.addIncome);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const range = useEffectiveDateRange();

  const totals = useMemo(() => {
    const scoped = income.filter(
      (r) => r.periodId === activePeriodId && inRange(r.date, range),
    );
    const byStatus: Record<IncomeStatus, number> = {
      received: 0,
      confirmed: 0,
      pending: 0,
      expected: 0,
    };
    for (const r of scoped) byStatus[r.status] += r.amount;
    const total = LEGEND_ORDER.reduce((sum, key) => sum + byStatus[key], 0);
    const pendingCount = scoped.filter((r) => r.status === 'pending').length;
    return { byStatus, total, pendingCount };
  }, [income, activePeriodId, range]);

  const isEmpty = mounted && totals.total === 0;

  function handleLogIncome() {
    addIncome();
    toast.success('Income source added', {
      description: 'Edit it on the Income page.',
    });
  }

  return (
    <OverviewCard title="My Income">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Total income
      </p>
      <HeroAmount amount={mounted ? totals.total : 0} />

      {isEmpty ? (
        <div className="mt-4 hidden flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-2 px-3 py-2.5 md:flex">
          <p className="text-xs text-muted-foreground">
            All <span className="money font-medium text-foreground">$0.00</span> across
            received, confirmed, pending, expected.
          </p>
          <Button size="sm" variant="secondary" onClick={handleLogIncome}>
            <Plus className="size-3.5" /> Log income
          </Button>
        </div>
      ) : (
        <div className="mt-4 hidden space-y-1.5 md:block">
          {LEGEND_ORDER.map((s) => (
            <div key={s} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`size-2 rounded-full ${STATUS_COLOR[s]}`} />
                {STATUS_LABEL_SHORT[s]}
              </span>
              <span className="money font-medium">
                {mounted ? fmt(totals.byStatus[s]) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {totals.pendingCount > 0 ? (
        <div className="mt-auto hidden justify-end pt-6 md:flex">
          <Badge size="sm" variant="warning">
            {totals.pendingCount} pending
          </Badge>
        </div>
      ) : null}
    </OverviewCard>
  );
}
