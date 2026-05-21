'use client';

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBudget } from '@/lib/store';
import { useMounted } from '@/lib/use-mounted';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { effectivePlanned, scopedIncomeWithAdj } from '@/lib/derived';
import { fmt } from '@/lib/format';
import type { DateRange } from '@/lib/types';

const config: ChartConfig = {
  income: {
    label: 'Income',
    color: 'var(--chart-income)',
  },
  expense: {
    label: 'Expense',
    color: 'var(--chart-expense)',
  },
};

function shortLabel(startDate: string): string {
  const [, m, d] = startDate.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(m, 10) - 1] ?? m} ${parseInt(d, 10)}`;
}

export function MoneyFlowChart() {
  const mounted = useMounted();
  const periods = useBudget((s) => s.periods);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const range = useEffectiveDateRange();

  const data = useMemo(() => {
    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return sorted.map((p) => {
      const active = p.id === activePeriodId;
      // Per-period bar: clamp the user range to this period's window so each bar
      // stays scoped to its own period. (Period-bound by chart design.)
      const barRange: DateRange =
        active && range
          ? {
              start: range.start > p.startDate ? range.start : p.startDate,
              end: range.end < p.endDate ? range.end : p.endDate,
            }
          : { start: p.startDate, end: p.endDate };
      const periodIncomeTotal = scopedIncomeWithAdj(income, barRange);
      const periodBillsTotal = bills
        .filter((b) => inRange(b.date, barRange))
        .reduce((s, b) => s + effectivePlanned(b), 0);
      return {
        id: p.id,
        label: shortLabel(p.startDate),
        income: periodIncomeTotal,
        expense: periodBillsTotal,
        active,
      };
    });
  }, [periods, income, bills, activePeriodId, range]);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border-subtle bg-card p-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)]">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-medium text-muted-foreground">Money Flow</h2>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-income" /> Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-expense" /> Expense
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 rounded-full text-xs text-muted-foreground"
                >
                  Periods
                  <ChevronDown className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>By period</DropdownMenuItem>
              <DropdownMenuItem disabled>By month (coming soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ChartContainer
        config={config}
        className="aspect-auto h-[200px] w-full sm:h-[240px]"
      >
        <BarChart
          data={mounted ? data : []}
          barCategoryGap={data.length > 6 ? '20%' : '40%'}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            fontSize={11}
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v: number) => fmt(v)}
            tickLine={false}
            axisLine={false}
            width={72}
            fontSize={11}
            tickMargin={4}
            className="text-muted-foreground"
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
          <ChartTooltip
            cursor={{ fill: 'var(--chart-track)', fillOpacity: 0.5 }}
            content={
              <ChartTooltipContent
                indicator="dot"
                formatter={(value, name) => (
                  <span className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${name === 'income' ? 'bg-chart-income' : 'bg-chart-expense'}`}
                    />
                    <span className="capitalize">{name}</span>
                    <span className="ml-auto money font-medium">
                      {fmt(Number(value))}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Bar
            dataKey="income"
            fill="var(--chart-income)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            isAnimationActive={mounted}
          />
          <Bar
            dataKey="expense"
            fill="var(--chart-expense)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            isAnimationActive={mounted}
          />
        </BarChart>
      </ChartContainer>
    </section>
  );
}
