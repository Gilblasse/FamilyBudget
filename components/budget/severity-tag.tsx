import { Badge } from '@/components/ui/badge';
import { PRIORITY_LABEL, type Priority } from '@/lib/types';

const PRIORITY_VARIANT: Record<Priority, 'danger' | 'warning' | 'info' | 'neutral'> = {
  crit: 'danger',
  imp: 'warning',
  opt: 'info',
  flex: 'neutral',
};

export function SeverityTag({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <Badge size="sm" variant={PRIORITY_VARIANT[priority]} className={className}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
