'use client';

import { useMemo, useState } from 'react';
import { Inbox, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Metric } from './metric';
import { RangeStatus } from './range-status';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import {
  CADENCE_LABEL,
  STATUS_LABEL,
  type Income,
  type IncomeCadence,
  type IncomeStatus,
} from '@/lib/types';
import { useUIStore } from '@/lib/ui-store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { expandAllIncome } from '@/lib/recurrence';
import { visibleIncomeSources } from '@/lib/visibility';
import { incomeStatusVariant } from '@/lib/badges';
import { applySort, dirFor, nextDir, type SortState } from '@/lib/sort';
import { isReceivedIncome } from '@/lib/derived';

const CADENCE_VALUES: IncomeCadence[] = [
  'once',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
];

function applyCadenceChange(prev: Income, next: IncomeCadence): Partial<Income> {
  const patch: Partial<Income> = { cadence: next };
  if (next === 'semimonthly') {
    if (prev.secondDay === undefined) patch.secondDay = 28;
  } else {
    patch.secondDay = undefined;
  }
  if (next === 'once') patch.endDate = undefined;
  return patch;
}

function clampSecondDay(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(31, Math.max(1, n));
}

type SortCol = 'source' | 'date';

export function IncomeTable() {
  const income = useBudget((s) => s.income);
  const balance = useBudget((s) => s.balance);
  const addIncome = useBudget((s) => s.addIncome);
  const updateIncome = useBudget((s) => s.updateIncome);
  const removeIncome = useBudget((s) => s.removeIncome);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const clearSearchQuery = useUIStore((s) => s.clearSearchQuery);
  const range = useEffectiveDateRange();

  const [sort, setSort] = useState<SortState<SortCol>>(null);
  const [viewMode, setViewMode] = useState<'filtered' | 'all'>('filtered');
  const effectiveRange = viewMode === 'all' ? null : range;

  const sourcesInRange = useMemo(
    () => visibleIncomeSources(income, range),
    [income, range],
  );
  const scoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visible = visibleIncomeSources(income, effectiveRange);
    return q
      ? visible.filter((r) => r.source.toLowerCase().includes(q))
      : visible;
  }, [income, effectiveRange, searchQuery]);

  const displayed = useMemo(
    () =>
      applySort(scoped, sort, {
        source: (r) => r.source,
        date: (r) => r.date,
      }),
    [scoped, sort],
  );

  function cycleSort(col: SortCol) {
    setSort((s) => nextDir(s, col));
  }

  const { totalAll, totalConfirmed } = useMemo(() => {
    const occurrences = expandAllIncome(scoped, effectiveRange);
    let all = balance;
    let conf = balance;
    for (const r of occurrences) {
      all += r.amount;
      if (isReceivedIncome(r)) conf += r.amount;
    }
    return { totalAll: all, totalConfirmed: conf };
  }, [scoped, balance, effectiveRange]);

  function handleRemove(row: Income) {
    const snapshot: Income = { ...row };
    removeIncome(row.id);
    toast.success(`Removed "${snapshot.source}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          const id = addIncome();
          updateIncome(id, {
            source: snapshot.source,
            date: snapshot.date,
            amount: snapshot.amount,
            status: snapshot.status,
            cadence: snapshot.cadence,
            secondDay: snapshot.secondDay,
            endDate: snapshot.endDate,
          });
        },
      },
    });
  }

  function handleAdd() {
    addIncome();
    toast.success('Income source added');
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Bank balance" value={fmt(balance)} tone={balance > 0 ? 'income' : 'default'} />
        <Metric label="Income + balance" value={fmt(totalAll)} tone="income" />
        <Metric label="Confirmed" value={fmt(totalConfirmed)} />
        <Metric label="Sources" value={String(scoped.length)} />
      </div>

      <RangeStatus
        range={range}
        mode={viewMode}
        shown={sourcesInRange.length}
        total={income.length}
        noun="source"
        onToggle={() =>
          setViewMode((m) => (m === 'filtered' ? 'all' : 'filtered'))
        }
      />

      {searchQuery ? (
        <div className="flex items-center gap-2">
          <Badge variant="info">
            Filtered: &ldquo;{searchQuery}&rdquo; · {scoped.length} result{scoped.length === 1 ? '' : 's'}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear filter"
            onClick={clearSearchQuery}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-2xl border border-border-subtle bg-card md:block">
        <Table>
          <TableHeader sticky>
            <TableRow>
              <TableHead
                className="w-[24%]"
                sortable
                direction={dirFor(sort, 'source')}
                onSort={() => cycleSort('source')}
              >
                Source
              </TableHead>
              <TableHead
                className="w-[16%]"
                sortable
                direction={dirFor(sort, 'date')}
                onSort={() => cycleSort('date')}
              >
                Date
              </TableHead>
              <TableHead className="w-[14%] text-right">Amount</TableHead>
              <TableHead className="w-[18%]">Cadence</TableHead>
              <TableHead className="w-[18%]">Status</TableHead>
              <TableHead className="w-[10%] text-right" aria-label="Row actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {scoped.length === 0 ? (
              <TableEmpty colSpan={6}>
                <EmptyState
                  icon={Inbox}
                  title="No income in the selected date range"
                  description={searchQuery ? 'Try clearing the filter.' : 'Add your first income source.'}
                  cta={
                    !searchQuery ? (
                      <Button size="sm" onClick={handleAdd}>
                        <Plus className="size-3.5" /> Add income
                      </Button>
                    ) : undefined
                  }
                  size="sm"
                />
              </TableEmpty>
            ) : (
              displayed.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input
                      value={r.source}
                      onChange={(e) => updateIncome(r.id, { source: e.target.value })}
                      className="h-9 border-transparent bg-transparent shadow-none hover:border-border-subtle focus:border-input focus:bg-card"
                    />
                  </TableCell>
                  <TableCell>
                    <DatePicker
                      value={r.date}
                      onChange={(v) => updateIncome(r.id, { date: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={r.amount}
                      onChange={(e) =>
                        updateIncome(r.id, { amount: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 border-transparent bg-transparent text-right money shadow-none hover:border-border-subtle focus:border-input focus:bg-card"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={r.cadence ?? 'once'}
                          onValueChange={(v) =>
                            updateIncome(r.id, applyCadenceChange(r, v as IncomeCadence))
                          }
                        >
                          <SelectTrigger className="h-9 flex-1 border-transparent shadow-none hover:border-border-subtle focus:border-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CADENCE_VALUES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {CADENCE_LABEL[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {r.cadence === 'semimonthly' ? (
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={31}
                            value={r.secondDay ?? ''}
                            onChange={(e) =>
                              updateIncome(r.id, { secondDay: clampSecondDay(e.target.value) })
                            }
                            aria-label="Second day of month"
                            className="h-9 w-14 tabular-nums"
                          />
                        ) : null}
                      </div>
                      {r.cadence && r.cadence !== 'once' ? (
                        <Input
                          type="date"
                          value={r.endDate ?? ''}
                          onChange={(e) =>
                            updateIncome(r.id, { endDate: e.target.value || undefined })
                          }
                          aria-label="Ends on (optional)"
                          placeholder="Ends"
                          className="h-7 tabular-nums text-xs border-transparent shadow-none hover:border-border-subtle focus:border-input"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateIncome(r.id, { status: v as IncomeStatus })}
                    >
                      <SelectTrigger className="h-9 border-transparent shadow-none hover:border-border-subtle focus:border-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as IncomeStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-2">
                              <Badge size="sm" variant={incomeStatusVariant(s)}>
                                {STATUS_LABEL[s]}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${r.source}`}
                      onClick={() => handleRemove(r)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {scoped.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-card">
            <EmptyState
              icon={Inbox}
              title="No income in the selected date range"
              description="Add your first income source."
              cta={
                <Button size="sm" onClick={handleAdd}>
                  <Plus className="size-3.5" /> Add income
                </Button>
              }
              size="sm"
            />
          </div>
        ) : (
          displayed.map((r) => (
            <div
              key={r.id}
              className="space-y-3 rounded-2xl border border-border-subtle bg-card p-3 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-start gap-2">
                <Input
                  value={r.source}
                  onChange={(e) => updateIncome(r.id, { source: e.target.value })}
                  placeholder="Source"
                  className="h-11 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${r.source}`}
                  onClick={() => handleRemove(r)}
                  className="h-11 w-11 shrink-0"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Date</Label>
                  <DatePicker value={r.date} onChange={(v) => updateIncome(r.id, { date: v })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Amount</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) =>
                      updateIncome(r.id, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="h-11 money"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Cadence</Label>
                  <Select
                    value={r.cadence ?? 'once'}
                    onValueChange={(v) =>
                      updateIncome(r.id, applyCadenceChange(r, v as IncomeCadence))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CADENCE_VALUES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CADENCE_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {r.cadence === 'semimonthly' ? (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Second day</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      value={r.secondDay ?? ''}
                      onChange={(e) =>
                        updateIncome(r.id, { secondDay: clampSecondDay(e.target.value) })
                      }
                      className="h-11 tabular-nums"
                    />
                  </div>
                ) : null}
              </div>
              {r.cadence && r.cadence !== 'once' ? (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Ends (optional)</Label>
                  <Input
                    type="date"
                    value={r.endDate ?? ''}
                    onChange={(e) =>
                      updateIncome(r.id, { endDate: e.target.value || undefined })
                    }
                    className="h-11 tabular-nums"
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                <Select
                  value={r.status}
                  onValueChange={(v) => updateIncome(r.id, { status: v as IncomeStatus })}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as IncomeStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>

      <Button variant="outline" size="sm" onClick={handleAdd} className="h-10 w-full sm:h-9 sm:w-auto">
        <Plus className="size-4" /> Add income
      </Button>
    </div>
  );
}
