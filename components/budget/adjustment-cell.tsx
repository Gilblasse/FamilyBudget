'use client';

import { Plus, Sliders, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { fmt, signedMoney, uid } from '@/lib/format';
import { effectivePlanned, sumAdj } from '@/lib/derived';
import { type Adjustment, MAX_ADJUSTMENTS_PER_ROW } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AdjustmentCellProps {
  value: Adjustment[] | undefined;
  onChange: (next: Adjustment[] | undefined) => void;
  /** Aria label for the trigger button. */
  label: string;
  /**
   * `income` flips the color semantics: positive variance is "good" (more
   * money landing) and shows as income-toned; negative as expense-toned.
   * `bill` is the inverse — a positive adjustment to a bill is bad news.
   */
  flavor?: 'income' | 'bill';
  className?: string;
  /**
   * Render the trigger as an icon-only button with a count badge instead
   * of the full money-style button. Mirrors the TagsButton pattern; use
   * on mobile / dense icon rows where there's no space for the signed
   * total inline. The popover content is unchanged.
   */
  compact?: boolean;
}

export function AdjustmentCell({
  value,
  onChange,
  label,
  flavor = 'bill',
  className,
  compact = false,
}: AdjustmentCellProps) {
  const entries = value ?? [];
  const total = sumAdj(entries);
  const hasEntries = entries.length > 0;
  const isFavorable = flavor === 'income' ? total >= 0 : total <= 0;
  const toneClass = !hasEntries || total === 0
    ? 'text-muted-foreground'
    : isFavorable
      ? 'text-success-700'
      : 'text-danger-700';

  function update(next: Adjustment[]) {
    onChange(next.length > 0 ? next : undefined);
  }

  function addEntry() {
    if (entries.length >= MAX_ADJUSTMENTS_PER_ROW) return;
    update([...entries, { id: uid(), amount: 0, note: '' }]);
  }

  function patchEntry(id: string, patch: Partial<Adjustment>) {
    update(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(id: string) {
    update(entries.filter((e) => e.id !== id));
  }

  const triggerAriaLabel = hasEntries
    ? `${label} (${entries.length} adjustment${entries.length === 1 ? '' : 's'}, ${signedMoney(total)})`
    : `${label} (no adjustments)`;

  return (
    <Popover>
      <PopoverTrigger
        render={
          compact ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={triggerAriaLabel}
              className={cn('relative', className)}
            >
              <Sliders className={cn('size-3.5', hasEntries ? toneClass : 'text-muted-foreground')} />
              {hasEntries ? (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-primary text-[9px] font-semibold leading-none text-primary-foreground"
                >
                  {entries.length}
                </span>
              ) : null}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={triggerAriaLabel}
              className={cn(
                'h-9 w-full justify-end gap-1.5 px-2 money tabular-nums',
                'border border-transparent shadow-none hover:border-border-subtle focus-visible:border-input focus-visible:bg-card',
                toneClass,
                className,
              )}
            >
              <Sliders className="size-3" aria-hidden />
              {hasEntries ? (
                <>
                  <span>{signedMoney(total)}</span>
                  {entries.length > 1 ? (
                    <Badge
                      variant="neutral"
                      size="sm"
                      className="ml-1 h-4 min-w-4 justify-center px-1 text-[10px]"
                    >
                      {entries.length}
                    </Badge>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">±</span>
              )}
            </Button>
          )
        }
      />
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Adjustments</Label>
          <p className="text-[11px] text-muted-foreground">
            Signed deltas vs the planned amount. Use a note for the audit trail.
          </p>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            No adjustments yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[5rem_1fr_auto] items-center gap-2"
              >
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={Number.isFinite(e.amount) ? e.amount : ''}
                  onChange={(ev) =>
                    patchEntry(e.id, {
                      amount: ev.target.value === '' ? 0 : parseFloat(ev.target.value) || 0,
                    })
                  }
                  aria-label="Amount"
                  placeholder="±0"
                  className="h-8 text-right money tabular-nums"
                />
                <Input
                  value={e.note ?? ''}
                  onChange={(ev) => patchEntry(e.id, { note: ev.target.value })}
                  aria-label="Note (optional)"
                  placeholder="note (optional)"
                  maxLength={200}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove adjustment"
                  onClick={() => removeEntry(e.id)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addEntry}
          disabled={entries.length >= MAX_ADJUSTMENTS_PER_ROW}
          className="w-full h-8"
        >
          <Plus className="size-3.5" /> Add entry
        </Button>

        {entries.length > 1 ? (
          <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-xs">
            <span className="font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className={cn('money tabular-nums font-semibold', toneClass)}>
              {signedMoney(total)}
            </span>
          </div>
        ) : null}

        {entries.length >= MAX_ADJUSTMENTS_PER_ROW ? (
          <p className="text-[11px] text-warning-700">
            Limit of {MAX_ADJUSTMENTS_PER_ROW} adjustments per row.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Mobile-card label for an Adjustment cell. Shows "Adjust ±" with an
 * inline "effective $X" readout when the row has nonzero adjustments.
 */
export function AdjustLabel({
  row,
}: {
  row: { amount: number; adjustments?: Adjustment[] };
}) {
  return (
    <Label className="text-[11px] text-muted-foreground">
      Adjust ±
      {sumAdj(row.adjustments) !== 0 ? (
        <span className="ml-2 money tabular-nums text-foreground">
          effective {fmt(effectivePlanned(row))}
        </span>
      ) : null}
    </Label>
  );
}
