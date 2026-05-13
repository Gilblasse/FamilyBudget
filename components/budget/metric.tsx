import { cn } from '@/lib/utils';

type Tone = 'default' | 'income' | 'expense' | 'warning';

const TONE: Record<Tone, string> = {
  default: 'text-foreground',
  income: 'text-success-700',
  expense: 'text-danger-700',
  warning: 'text-warning-700',
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
    <div className="rounded-2xl border border-border-subtle bg-card px-4 py-3 shadow-[var(--shadow-xs)]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn('mt-1 text-xl font-semibold money', TONE[tone])}>
        {value}
      </div>
    </div>
  );
}
