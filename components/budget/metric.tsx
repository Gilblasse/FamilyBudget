import { cn } from '@/lib/utils';

type Tone = 'default' | 'income' | 'expense' | 'warning';

const TONE: Record<Tone, string> = {
  default: 'text-foreground',
  income: 'text-income',
  expense: 'text-expense',
  warning: 'text-warning',
};

export function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn('text-xl font-medium tabular-nums', TONE[tone])}>{value}</div>
    </div>
  );
}
