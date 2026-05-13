import type { Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

const CLASS: Record<Priority, string> = {
  crit: 'bg-danger-500',
  imp: 'bg-warning-500',
  opt: 'bg-info-500',
  flex: 'bg-neutral-400',
};

export function PriorityDot({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full shrink-0', CLASS[priority], className)}
      aria-hidden
    />
  );
}
