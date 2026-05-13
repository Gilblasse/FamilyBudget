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
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import { STATUS_LABEL, type Income, type IncomeStatus } from '@/lib/types';
import { useUIStore } from '@/lib/ui-store';

function statusVariant(s: IncomeStatus): 'success' | 'info' | 'warning' | 'neutral' {
  if (s === 'received') return 'success';
  if (s === 'confirmed') return 'info';
  if (s === 'pending') return 'warning';
  return 'neutral';
}

type SortDir = 'asc' | 'desc' | 'none';
type SortCol = 'source' | 'date';
type SortState = { col: SortCol; dir: 'asc' | 'desc' } | null;

function nextDir(current: SortState, col: SortCol): SortState {
  if (!current || current.col !== col) return { col, dir: 'asc' };
  if (current.dir === 'asc') return { col, dir: 'desc' };
  return null;
}

function dirFor(state: SortState, col: SortCol): SortDir {
  if (state && state.col === col) return state.dir;
  return 'none';
}

export function IncomeTable() {
  const income = useBudget((s) => s.income);
  const balance = useBudget((s) => s.balance);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const addIncome = useBudget((s) => s.addIncome);
  const updateIncome = useBudget((s) => s.updateIncome);
  const removeIncome = useBudget((s) => s.removeIncome);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const clearSearchQuery = useUIStore((s) => s.clearSearchQuery);

  const [sort, setSort] = useState<SortState>(null);

  const scoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return income
      .filter((r) => r.periodId === activePeriodId)
      .filter((r) => (q ? r.source.toLowerCase().includes(q) : true));
  }, [income, activePeriodId, searchQuery]);

  const displayed = useMemo(() => {
    if (!sort) return scoped;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const copy = [...scoped];
    if (sort.col === 'date') {
      copy.sort((a, b) => a.date.localeCompare(b.date) * dir);
    } else {
      copy.sort((a, b) => a.source.localeCompare(b.source, undefined, { sensitivity: 'base' }) * dir);
    }
    return copy;
  }, [scoped, sort]);

  function cycleSort(col: SortCol) {
    setSort((s) => nextDir(s, col));
  }

  const { totalAll, totalConfirmed } = useMemo(() => {
    let all = balance;
    let conf = balance;
    for (const r of scoped) {
      all += r.amount;
      if (r.status === 'confirmed' || r.status === 'received') conf += r.amount;
    }
    return { totalAll: all, totalConfirmed: conf };
  }, [scoped, balance]);

  function handleRemove(row: Income) {
    const snapshot: Income = { ...row };
    removeIncome(row.id);
    toast.success(`Removed "${snapshot.source}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          addIncome();
          const created = useBudget.getState().income.at(-1);
          if (!created) return;
          updateIncome(created.id, {
            source: snapshot.source,
            date: snapshot.date,
            amount: snapshot.amount,
            status: snapshot.status,
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
                className="w-[30%]"
                sortable
                direction={dirFor(sort, 'source')}
                onSort={() => cycleSort('source')}
              >
                Source
              </TableHead>
              <TableHead
                className="w-[20%]"
                sortable
                direction={dirFor(sort, 'date')}
                onSort={() => cycleSort('date')}
              >
                Date
              </TableHead>
              <TableHead className="w-[18%] text-right">Amount</TableHead>
              <TableHead className="w-[22%]">Status</TableHead>
              <TableHead className="w-[10%] text-right" aria-label="Row actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {scoped.length === 0 ? (
              <TableEmpty colSpan={5}>
                <EmptyState
                  icon={Inbox}
                  title="No income in this period"
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
                              <Badge size="sm" variant={statusVariant(s)}>
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
              title="No income in this period"
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
