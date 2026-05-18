'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fdRange } from '@/lib/format';
import type { DateRange } from '@/lib/types';

export interface RangeStatusProps {
  range: DateRange | null;
  mode: 'filtered' | 'all';
  shown: number;
  total: number;
  onToggle: () => void;
  /** Singular noun for the count label (e.g. "bill", "source"). */
  noun: string;
}

export function RangeStatus({
  range,
  mode,
  shown,
  total,
  onToggle,
  noun,
}: RangeStatusProps) {
  const plural = (n: number) => (n === 1 ? noun : `${noun}s`);

  if (mode === 'filtered') {
    if (!range) return null;
    const isFiltering = shown < total;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info" size="md">
          Date range: {fdRange(range.start, range.end)} ·{' '}
          {isFiltering ? `${shown} of ${total} ${plural(total)}` : `${total} ${plural(total)}`}
        </Badge>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          Show all
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="warning" size="md">
        Showing all {total} {plural(total)} · date range ignored
      </Badge>
      <Button size="sm" variant="ghost" onClick={onToggle}>
        Filtered
      </Button>
    </div>
  );
}
