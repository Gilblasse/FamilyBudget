'use client';

import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export function MetricChip({
  icon: Icon,
  label,
  value,
  tone = 'muted',
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'muted' | 'income' | 'expense' | 'warning';
  className?: string;
}) {
  const toneClasses = {
    muted: 'bg-muted/60 text-foreground',
    income: 'bg-income-soft text-income',
    expense: 'bg-expense-soft text-expense',
    warning: 'bg-warning-soft text-warning',
  }[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses,
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-4 place-items-center rounded-md bg-card/60">
          <Icon className="size-3" />
        </span>
      ) : null}
      <span className="text-muted-foreground/80">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
