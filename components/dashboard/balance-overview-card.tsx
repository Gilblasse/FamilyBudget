'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Line, LineChart, Tooltip } from 'recharts';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import { useMounted } from '@/lib/use-mounted';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { OverviewCard, HeroAmount } from './overview-card';
import {
  BalanceSparkActiveDot,
  BalanceSparkTooltip,
  type SparkPoint,
} from './balance-spark-tooltip';

const sparkConfig: ChartConfig = {
  balance: { label: 'Balance', color: 'var(--brand-500)' },
};

export function BalanceOverviewCard() {
  const mounted = useMounted();
  const balance = useBudget((s) => s.balance);
  const setBalance = useBudget((s) => s.setBalance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const paid = useBudget((s) => s.paid);
  const periods = useBudget((s) => s.periods);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const dateRange = useEffectiveDateRange();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [periods],
  );
  const activeIdx = sortedPeriods.findIndex((p) => p.id === activePeriodId);
  const previousPeriod = activeIdx > 0 ? sortedPeriods[activeIdx - 1] : null;

  const earnedLastTime = useMemo(() => {
    if (!previousPeriod) return null;
    return income
      .filter((r) => r.periodId === previousPeriod.id)
      .filter((r) => r.status === 'received' || r.status === 'confirmed')
      .reduce((sum, r) => sum + r.amount, 0);
  }, [income, previousPeriod]);

  const totalReceived = useMemo(() => {
    return income
      .filter((r) => r.periodId === activePeriodId && inRange(r.date, dateRange))
      .filter((r) => r.status === 'received' || r.status === 'confirmed')
      .reduce((sum, r) => sum + r.amount, 0);
  }, [income, activePeriodId, dateRange]);

  const delta = useMemo(() => {
    if (earnedLastTime === null || earnedLastTime === 0) return null;
    const diff = totalReceived - earnedLastTime;
    return {
      value: diff,
      pct: Math.round((diff / earnedLastTime) * 100),
    };
  }, [earnedLastTime, totalReceived]);

  const sparkData = useMemo<SparkPoint[]>(() => {
    type Event = {
      date: string;
      delta: number;
      kind: 'income' | 'bill';
      label: string;
      priority?: SparkPoint['priority'];
    };
    const periodIncome: Event[] = income
      .filter((r) => r.periodId === activePeriodId && inRange(r.date, dateRange))
      .filter((r) => paid[`inc_${r.id}`])
      .map((r) => ({ date: r.date, delta: r.amount, kind: 'income', label: r.source }));
    const periodBills: Event[] = bills
      .filter((b) => b.periodId === activePeriodId && inRange(b.date, dateRange))
      .filter((b) => paid[`bill_${b.id}`])
      .map((b) => ({
        date: b.date,
        delta: -b.amount,
        kind: 'bill',
        label: b.name,
        priority: b.priority,
      }));
    const events = [...periodIncome, ...periodBills].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    let running = balance;
    const points: SparkPoint[] = [
      {
        idx: 0,
        date: null,
        balance: running,
        delta: 0,
        eventKind: 'opening',
        eventLabel: 'Opening balance',
      },
    ];
    events.forEach((ev, i) => {
      running += ev.delta;
      points.push({
        idx: i + 1,
        date: ev.date,
        balance: running,
        delta: ev.delta,
        eventKind: ev.kind,
        eventLabel: ev.label,
        priority: ev.priority,
      });
    });
    return points;
  }, [balance, income, bills, paid, activePeriodId, dateRange]);

  function startEditing() {
    setDraft(String(balance));
    setEditing(true);
  }
  function commit() {
    const v = parseFloat(draft);
    setBalance(Number.isFinite(v) ? v : 0);
    setEditing(false);
  }

  return (
    <OverviewCard title="My Balance" className="overflow-visible">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Total balance
      </p>
      {editing ? (
        <Input
          autoFocus
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-10 max-w-[10rem] text-[clamp(1rem,4vw,2.25rem)] font-semibold money sm:h-14 sm:max-w-[16rem] sm:text-5xl"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="-mx-1 self-start rounded-md px-1 text-left transition-colors hover:bg-surface-2"
          aria-label="Edit current balance"
        >
          <HeroAmount amount={mounted ? balance : 0} />
        </button>
      )}

      <div className="mt-3 hidden flex-wrap items-baseline gap-2 md:flex">
        {mounted && delta !== null ? (
          <Badge
            size="md"
            variant={delta.value > 0 ? 'success' : delta.value < 0 ? 'danger' : 'neutral'}
          >
            {delta.value > 0 ? (
              <ArrowUp className="size-3" />
            ) : delta.value < 0 ? (
              <ArrowDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            <span className="money">
              {fmt(Math.abs(delta.value))} vs last period
            </span>
          </Badge>
        ) : null}
        {mounted && totalReceived > 0 ? (
          <span className="text-xs text-muted-foreground">
            Received <span className="money font-medium text-foreground">{fmt(totalReceived)}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-auto hidden pt-6 md:block">
        <ChartContainer
          config={sparkConfig}
          className="aspect-auto h-16 w-full"
        >
          <LineChart
            data={mounted ? sparkData : []}
            margin={{ top: 10, right: 12, bottom: 0, left: 12 }}
          >
            <Tooltip
              content={<BalanceSparkTooltip />}
              cursor={{
                stroke: 'var(--brand-500)',
                strokeOpacity: 0.25,
                strokeDasharray: '3 3',
                strokeWidth: 1,
              }}
              isAnimationActive={false}
              offset={14}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ outline: 'none', zIndex: 50 }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--brand-500)"
              strokeWidth={2}
              dot={false}
              activeDot={<BalanceSparkActiveDot />}
              isAnimationActive={mounted}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </OverviewCard>
  );
}
