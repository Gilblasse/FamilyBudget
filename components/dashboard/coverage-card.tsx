'use client';

import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import { useMounted } from '@/lib/use-mounted';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { expandAllIncome } from '@/lib/recurrence';
import { isReceivedIncome } from '@/lib/derived';
import { cn } from '@/lib/utils';

function pct(numer: number, denom: number): number {
  if (denom <= 0) return numer > 0 ? 999 : 0;
  return Math.min(Math.round((numer / denom) * 100), 999);
}

function bucketFor(p: number): 'good' | 'watch' | 'risk' {
  if (p >= 100) return 'good';
  if (p >= 60) return 'watch';
  return 'risk';
}

const BUCKET: Record<
  'good' | 'watch' | 'risk',
  { tone: string; ring: string; copy: string }
> = {
  good: {
    tone: 'text-success-700',
    ring: 'var(--success-500)',
    copy: "You're in great shape — your monthly usage is still very safe.",
  },
  watch: {
    tone: 'text-warning-700',
    ring: 'var(--warning-500)',
    copy: 'Coverage is tight. Watch unpaid critical bills closely.',
  },
  risk: {
    tone: 'text-danger-700',
    ring: 'var(--danger-500)',
    copy: 'Coverage is short. Consider deferring or reducing optional bills.',
  },
};

const ringConfig: ChartConfig = {
  coverage: { label: 'Coverage', color: 'var(--success-500)' },
};

export function CoverageCard() {
  const mounted = useMounted();
  const balance = useBudget((s) => s.balance);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const range = useEffectiveDateRange();

  const stats = useMemo(() => {
    const scopedIncome = expandAllIncome(income, range);
    const scopedBills = bills.filter((b) => inRange(b.date, range));
    const receivedIncome = scopedIncome
      .filter(isReceivedIncome)
      .reduce((s, r) => s + r.amount, 0);
    const resources = balance + receivedIncome;
    const critTotal = scopedBills
      .filter((b) => b.priority === 'crit')
      .reduce((s, b) => s + b.amount, 0);
    const impTotal = scopedBills
      .filter((b) => b.priority === 'imp')
      .reduce((s, b) => s + b.amount, 0);
    const allTotal = scopedBills.reduce((s, b) => s + b.amount, 0);
    const critImpTotal = critTotal + impTotal;

    return {
      resources,
      critTotal,
      critImpTotal,
      allTotal,
      coverageCrit: pct(resources, critTotal),
      coverageCritImp: pct(resources, critImpTotal),
      coverageAll: pct(resources, allTotal),
    };
  }, [balance, income, bills, range]);

  const big = stats.coverageCritImp;
  const bucket = bucketFor(big);
  const message = BUCKET[bucket];
  const ringValue = Math.min(big, 100);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-card p-5 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)]">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-muted-foreground">
            Critical + Important coverage
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            Resources vs. priority bills this period
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-full text-xs text-muted-foreground"
          render={<Link href="/summary" />}
        >
          Budget setting
          <ArrowRight className="size-3" />
        </Button>
      </header>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative size-28 shrink-0">
          <ChartContainer config={ringConfig} className="absolute inset-0 aspect-square">
            <RadialBarChart
              innerRadius="78%"
              outerRadius="100%"
              barSize={10}
              startAngle={90}
              endAngle={-270}
              data={[{ name: 'coverage', value: mounted ? ringValue : 0 }]}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <RadialBar
                dataKey="value"
                background={{ fill: 'var(--gauge-track)' }}
                cornerRadius={6}
                fill={message.ring}
                isAnimationActive={mounted}
              />
            </RadialBarChart>
          </ChartContainer>
          <div className="absolute inset-0 grid place-items-center">
            <div className={cn('text-center', message.tone)}>
              <div className="text-2xl font-semibold leading-none money tracking-tight">
                {mounted ? big : 0}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                %
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">{message.copy}</p>
          <div className="inline-flex items-baseline gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Resources
            </span>
            <span className="money text-sm font-semibold">
              {mounted ? fmt(stats.resources) : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3">
        <CoverageTile
          label="Critical"
          percent={stats.coverageCrit}
          dollar={fmt(stats.critTotal)}
          ringColor="var(--danger-500)"
          mounted={mounted}
        />
        <CoverageTile
          label="All Bills"
          percent={stats.coverageAll}
          dollar={fmt(stats.allTotal)}
          ringColor="var(--info-500)"
          mounted={mounted}
        />
      </div>
    </section>
  );
}

const miniConfig: ChartConfig = {
  v: { label: 'Coverage', color: 'var(--brand-500)' },
};

function CoverageTile({
  label,
  percent,
  dollar,
  ringColor,
  mounted,
}: {
  label: string;
  percent: number;
  dollar: string;
  ringColor: string;
  mounted: boolean;
}) {
  const value = Math.min(percent, 100);
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-2">
      <div className="flex items-center justify-between gap-1">
        <div className="relative h-6 w-6 shrink-0">
          <ChartContainer config={miniConfig} className="absolute inset-0 aspect-square">
            <RadialBarChart
              innerRadius="72%"
              outerRadius="100%"
              barSize={5}
              startAngle={90}
              endAngle={-270}
              data={[{ name: 'v', value: mounted ? value : 0 }]}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <RadialBar
                dataKey="value"
                background={{ fill: 'var(--gauge-track)' }}
                cornerRadius={4}
                fill={ringColor}
                isAnimationActive={mounted}
              />
            </RadialBarChart>
          </ChartContainer>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 text-base font-semibold leading-none money">
            {percent}
            <span className="ml-0.5 text-[10px] text-muted-foreground">%</span>
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
          Budgeted
        </span>
        <span className="text-[11px] font-medium money tabular-nums">{dollar}</span>
      </div>
    </div>
  );
}
