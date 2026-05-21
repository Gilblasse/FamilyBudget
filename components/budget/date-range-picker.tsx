'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Calendar as CalendarIcon, RotateCcw, Trash2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useDateRange } from '@/hooks/use-date-range';
import { useIsNarrowViewport } from '@/hooks/use-narrow-viewport';
import { useBudget } from '@/lib/store';
import { fdRange } from '@/lib/format';
import {
  addDaysIso,
  fromIso,
  rangesEqual,
  toIso,
  todayIso,
} from '@/lib/date-utils';
import { applyRangeClick } from '@/lib/range-update';
import { useMounted } from '@/lib/use-mounted';
import { cn } from '@/lib/utils';
import type { SavedRange } from '@/lib/saved-ranges-store';
import type { BudgetPeriod, DateRange } from '@/lib/types';

export interface DateRangePresetOption {
  id: string;
  label: string;
  /** When set, the preset chip renders icon-only; `label` becomes the aria-label and tooltip. */
  icon?: LucideIcon;
  compute: () => DateRange | null;
}

export interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  activePeriod: BudgetPeriod | undefined;
  savedRanges: SavedRange[];
  onSaveRange?: (range: DateRange) => void;
  onRemoveSavedRange: (id: string) => void;
  presets?: DateRangePresetOption[];
  className?: string;
}

function buildDefaultPresets(): DateRangePresetOption[] {
  return [
    {
      id: 'full-period',
      label: 'Full period',
      compute: () => null,
    },
    {
      id: 'last-7',
      label: 'Last 7 days',
      compute: () => {
        const end = todayIso();
        const start = addDaysIso(end, -6);
        return { start, end };
      },
    },
    {
      id: 'next-7',
      label: 'Next 7 days',
      compute: () => {
        const start = todayIso();
        const end = addDaysIso(start, 6);
        return { start, end };
      },
    },
  ];
}

export function DateRangePicker({
  value,
  onChange,
  activePeriod,
  savedRanges,
  onSaveRange,
  onRemoveSavedRange,
  presets,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const isNarrow = useIsNarrowViewport();
  const mounted = useMounted();

  if (!activePeriod || !value) return null;

  const effectivePresets = presets ?? buildDefaultPresets();
  const label = fdRange(value.start, value.end);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
  };

  // Single-click interpretation: each click is authoritative. Clicks before
  // the current start move start; clicks after end move end; clicks inside
  // collapse to a single-day range. This avoids react-day-picker's range
  // mode treating "click before start" as the from of a brand-new range.
  const handleCalendarSelect = (day: Date | undefined) => {
    if (!day) return;
    const next = applyRangeClick(value, toIso(day));
    onChange(next);
    setOpen(false);
    const isFullPeriod =
      next.start === activePeriod.startDate &&
      next.end === activePeriod.endDate;
    if (onSaveRange && !isFullPeriod) onSaveRange(next);
  };

  const handlePreset = (preset: DateRangePresetOption) => {
    onChange(preset.compute());
    setOpen(false);
  };

  const handleApplySaved = (saved: SavedRange) => {
    onChange({ start: saved.start, end: saved.end });
    setOpen(false);
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'h-9 gap-2 rounded-full border border-input bg-background px-3 text-sm font-medium tabular-nums hover:bg-accent',
        className,
      )}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`Select date range, currently ${label}`}
    >
      <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );

  const panel = (
    <PanelContent
      value={value}
      savedRanges={savedRanges}
      mounted={mounted}
      presets={effectivePresets}
      onCalendarSelect={handleCalendarSelect}
      onApplySaved={handleApplySaved}
      onRemoveSavedRange={onRemoveSavedRange}
      onPreset={handlePreset}
    />
  );

  if (isNarrow) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger render={trigger} />
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-xl p-0"
          aria-label="Date range picker"
          showCloseButton={false}
        >
          {panel}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-lg p-0 ring-1 ring-foreground/10"
        role="dialog"
        aria-label="Date range picker"
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
}

interface PanelContentProps {
  value: DateRange;
  savedRanges: SavedRange[];
  mounted: boolean;
  presets: DateRangePresetOption[];
  onCalendarSelect: (day: Date | undefined) => void;
  onApplySaved: (saved: SavedRange) => void;
  onRemoveSavedRange: (id: string) => void;
  onPreset: (preset: DateRangePresetOption) => void;
}

function PanelContent({
  value,
  savedRanges,
  mounted,
  presets,
  onCalendarSelect,
  onApplySaved,
  onRemoveSavedRange,
  onPreset,
}: PanelContentProps) {
  // Running in single-pick mode, but reuse react-day-picker's range_* modifier
  // slots so the existing calendar.tsx range styling still shades the active
  // window. Each click is interpreted by `applyRangeClick` upstream.
  const rangeModifiers = useMemo(() => {
    const startIso = value.start;
    const endIso = value.end;
    return {
      range_start: (d: Date) => toIso(d) === startIso,
      range_end: (d: Date) => toIso(d) === endIso,
      range_middle: (d: Date) => {
        const iso = toIso(d);
        return iso > startIso && iso < endIso;
      },
    };
  }, [value.start, value.end]);

  return (
    <div className="flex flex-col">
      <Calendar
        mode="single"
        selected={fromIso(value.start)}
        onSelect={onCalendarSelect}
        modifiers={rangeModifiers}
        numberOfMonths={1}
        defaultMonth={fromIso(value.start)}
      />
      <p className="px-3 pb-1.5 text-[11px] text-muted-foreground">
        Click a day before the start to move the start, after the end to move
        the end, or inside to set a new single day.
      </p>
      {mounted ? (
        <SavedRangesList
          ranges={savedRanges}
          activeValue={value}
          onApply={onApplySaved}
          onRemove={onRemoveSavedRange}
        />
      ) : (
        <div className="pt-1.5 pb-1" aria-hidden />
      )}
      <div
        className="flex flex-wrap gap-1 border-t p-2"
        role="group"
        aria-label="Presets"
      >
        {presets.map((p) => {
          const Icon = p.icon;
          return (
            <Button
              key={p.id}
              variant="ghost"
              size="sm"
              className={cn('h-7 text-xs', Icon ? 'w-7 px-0' : 'px-2')}
              aria-label={p.label}
              title={p.label}
              onClick={() => onPreset(p)}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden /> : p.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

interface SavedRangesListProps {
  ranges: SavedRange[];
  activeValue: DateRange;
  onApply: (saved: SavedRange) => void;
  onRemove: (id: string) => void;
}

function SavedRangesList({
  ranges,
  activeValue,
  onApply,
  onRemove,
}: SavedRangesListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo(
    () =>
      ranges.map((r) => {
        const isActive = rangesEqual(
          { start: r.start, end: r.end },
          activeValue,
        );
        return { saved: r, isActive };
      }),
    [ranges, activeValue],
  );

  const defaultFocusId = useMemo(
    () => rows.find((r) => r.isActive)?.saved.id ?? rows[0]?.saved.id ?? null,
    [rows],
  );

  const [focusedId, setFocusedId] = useState<string | null>(null);

  const effectiveFocusedId =
    focusedId && rows.some((r) => r.saved.id === focusedId)
      ? focusedId
      : defaultFocusId;

  const focusRowById = useCallback((id: string) => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLLIElement>(`[data-row-id="${id}"]`);
    el?.focus();
  }, []);

  const moveFocus = useCallback(
    (direction: -1 | 1) => {
      if (rows.length === 0) return;
      const idx = effectiveFocusedId
        ? rows.findIndex((r) => r.saved.id === effectiveFocusedId)
        : -1;
      const base = idx === -1 ? (direction === 1 ? -1 : 0) : idx;
      const nextIdx = (base + direction + rows.length) % rows.length;
      const nextId = rows[nextIdx].saved.id;
      setFocusedId(nextId);
      focusRowById(nextId);
    },
    [focusRowById, effectiveFocusedId, rows],
  );

  const handleRowKeyDown = (
    e: KeyboardEvent<HTMLLIElement>,
    row: (typeof rows)[number],
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onApply(row.saved);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const idx = rows.findIndex((r) => r.saved.id === row.saved.id);
      const surviving = rows.filter((r) => r.saved.id !== row.saved.id);
      const nextFocus =
        surviving[idx]?.saved.id ?? surviving[idx - 1]?.saved.id ?? null;
      onRemove(row.saved.id);
      setFocusedId(nextFocus);
      if (nextFocus) {
        requestAnimationFrame(() => focusRowById(nextFocus));
      }
    }
  };

  if (rows.length === 0) return <div className="pt-1.5 pb-1" aria-hidden />;

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Saved date ranges"
      className="pt-1.5 pb-1"
    >
      {rows.map((row) => {
        const label = fdRange(row.saved.start, row.saved.end);
        const isFocusTarget = row.saved.id === effectiveFocusedId;
        return (
          <li
            key={row.saved.id}
            data-row-id={row.saved.id}
            role="option"
            aria-selected={row.isActive}
            tabIndex={isFocusTarget ? 0 : -1}
            onFocus={() => setFocusedId(row.saved.id)}
            onClick={() => onApply(row.saved)}
            onKeyDown={(e) => handleRowKeyDown(e, row)}
            className="group flex cursor-pointer items-center justify-between px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span
              className={cn(
                'truncate text-[13px] text-muted-foreground transition-colors group-hover:text-foreground group-focus-within:text-foreground tabular-nums',
                row.isActive && 'text-foreground',
              )}
            >
              {label}
            </span>
            <button
              type="button"
              aria-label={`Delete ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(row.saved.id);
              }}
              className="inline-flex size-[18px] items-center justify-center text-muted-foreground/70 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <Trash2 className="size-3" strokeWidth={1.75} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function HeaderDateRangePicker() {
  const {
    effective,
    activePeriod,
    setRange,
    savedRanges,
    addSavedRange,
    removeSavedRange,
  } = useDateRange();

  // The active budget's defaultRange — what setActiveBudget restores on
  // workspace switch. Surfaced as a one-click "Workspace default" preset.
  const workspaceDefault = useBudget((s) =>
    s.budgets.find((b) => b.id === s.activeBudgetId)?.defaultRange,
  );

  const presets = useMemo<DateRangePresetOption[]>(() => {
    const out: DateRangePresetOption[] = [];
    if (workspaceDefault) {
      out.push({
        id: 'workspace-default',
        label: 'Reset to workspace default',
        icon: RotateCcw,
        compute: () => workspaceDefault,
      });
    }
    out.push(
      {
        id: 'full-period',
        label: 'Full period',
        compute: () => null,
      },
      {
        id: 'last-7',
        label: 'Last 7 days',
        compute: () => {
          const end = todayIso();
          return { start: addDaysIso(end, -6), end };
        },
      },
      {
        id: 'next-7',
        label: 'Next 7 days',
        compute: () => {
          const start = todayIso();
          return { start, end: addDaysIso(start, 6) };
        },
      },
    );
    return out;
  }, [workspaceDefault]);

  return (
    <DateRangePicker
      value={effective}
      onChange={setRange}
      activePeriod={activePeriod}
      savedRanges={savedRanges}
      onSaveRange={addSavedRange}
      onRemoveSavedRange={removeSavedRange}
      presets={presets}
    />
  );
}
