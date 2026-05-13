'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PriorityDot } from '@/components/budget/priority-dot';
import { fmt, fd } from '@/lib/format';
import type { Priority } from '@/lib/types';

export type SparkEventKind = 'opening' | 'income' | 'bill';

export type SparkPoint = {
  idx: number;
  date: string | null;
  balance: number;
  delta: number;
  eventKind: SparkEventKind;
  eventLabel: string;
  priority?: Priority;
};

type RechartsActiveDotProps = {
  cx?: number;
  cy?: number;
  payload?: SparkPoint;
};

const DOT_FILL: Record<SparkEventKind, string> = {
  opening: 'var(--muted-foreground)',
  income: 'var(--brand-500)',
  bill: 'var(--expense)',
};

export function BalanceSparkActiveDot(props: RechartsActiveDotProps) {
  const { cx, cy, payload } = props;
  if (typeof cx !== 'number' || typeof cy !== 'number') return null;
  const fill = DOT_FILL[payload?.eventKind ?? 'income'];
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={10} fill={fill} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={fill} strokeOpacity={0.45} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={4} fill={fill} stroke="var(--background)" strokeWidth={2} />
    </g>
  );
}

type RechartsTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: SparkPoint }>;
};

export function BalanceSparkTooltip(props: RechartsTooltipProps) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const isIncome = point.delta > 0;
  const contextLabel =
    point.eventKind === 'opening'
      ? 'Period start'
      : point.eventKind === 'income'
        ? `From ${point.eventLabel}`
        : `After ${point.eventLabel}`;

  return (
    <div className="pointer-events-none w-max max-w-[240px] min-w-[180px] rounded-xl border border-border/60 bg-popover/95 px-3 py-2.5 text-sm shadow-xl backdrop-blur-md supports-[backdrop-filter]:bg-popover/80">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {point.date ? fd(point.date) : 'Opening balance'}
        </span>
        {point.eventKind === 'bill' && point.priority ? (
          <PriorityDot priority={point.priority} />
        ) : null}
      </div>

      <div className="money mt-1.5 text-xl font-semibold tabular-nums text-foreground">
        {fmt(point.balance)}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        {point.delta !== 0 ? (
          <Badge size="sm" variant={isIncome ? 'success' : 'danger'}>
            {isIncome ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            <span className="money tabular-nums">{fmt(Math.abs(point.delta))}</span>
          </Badge>
        ) : null}
        <span className="truncate text-xs text-muted-foreground">{contextLabel}</span>
      </div>
    </div>
  );
}
