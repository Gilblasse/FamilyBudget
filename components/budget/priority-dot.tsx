import type { Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

const CLASS: Record<Priority, string> = {
  crit: 'bg-pri-crit',
  imp: 'bg-pri-imp',
  opt: 'bg-pri-opt',
  flex: 'bg-pri-flex',
};

export function PriorityDot({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', CLASS[priority], className)}
      aria-hidden
    />
  );
}
