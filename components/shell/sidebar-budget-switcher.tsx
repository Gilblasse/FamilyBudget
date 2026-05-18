'use client';

import { useId, useMemo, useState, type MouseEvent } from 'react';
import { Check, ChevronsUpDown, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBudget } from '@/lib/store';
import type { BudgetMeta, DateRange } from '@/lib/types';
import { addDaysIso, fromIso, toIso, todayIso } from '@/lib/date-utils';
import { fdRange } from '@/lib/format';

type DialogMode = null | 'create' | 'edit' | 'delete';

function defaultNextRange(periods: { id: string; startDate: string; endDate: string }[], activePeriodId: string): DateRange {
  const period = periods.find((p) => p.id === activePeriodId);
  if (period) return { start: period.startDate, end: period.endDate };
  const start = todayIso();
  return { start, end: addDaysIso(start, 29) };
}

export function SidebarBudgetSwitcher() {
  const budgets = useBudget((s) => s.budgets);
  const activeBudgetId = useBudget((s) => s.activeBudgetId);
  const periods = useBudget((s) => s.periods);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const addBudget = useBudget((s) => s.addBudget);
  const setActiveBudget = useBudget((s) => s.setActiveBudget);
  const updateBudget = useBudget((s) => s.updateBudget);
  const removeBudget = useBudget((s) => s.removeBudget);

  const [mode, setMode] = useState<DialogMode>(null);
  const [target, setTarget] = useState<BudgetMeta | null>(null);
  const [name, setName] = useState('');
  const [range, setRange] = useState<DateRange | null>(null);
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);

  const active = budgets.find((b) => b.id === activeBudgetId) ?? budgets[0];
  const onlyOne = budgets.length <= 1;
  const inputId = useId();

  const calendarSelected = useMemo(() => {
    if (pendingFrom) return { from: pendingFrom };
    if (range) return { from: fromIso(range.start), to: fromIso(range.end) };
    return undefined;
  }, [pendingFrom, range]);

  const openCreate = () => {
    setTarget(null);
    setName('');
    setRange(defaultNextRange(periods, activePeriodId));
    setPendingFrom(null);
    setMode('create');
  };
  const openEdit = (b: BudgetMeta) => {
    setTarget(b);
    setName(b.name);
    setRange(b.defaultRange);
    setPendingFrom(null);
    setMode('edit');
  };
  const openDelete = (b: BudgetMeta) => {
    if (onlyOne) return;
    setTarget(b);
    setMode('delete');
  };
  const close = () => {
    setMode(null);
    setTarget(null);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || !range) return;
    addBudget(trimmed, range);
    toast.success(`Created · ${trimmed}`);
    close();
  };

  const handleCalendarSelect = (
    next: { from?: Date; to?: Date } | undefined,
  ) => {
    if (!next?.from) {
      setPendingFrom(null);
      return;
    }
    if (!next.to) {
      setPendingFrom(next.from);
      return;
    }
    setPendingFrom(null);
    setRange({ start: toIso(next.from), end: toIso(next.to) });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || !target || !range) return;
    updateBudget(target.id, { name: trimmed, defaultRange: range });
    toast.success('Saved');
    close();
  };

  const handleDelete = () => {
    if (!target) return;
    const removedName = target.name;
    removeBudget(target.id);
    toast.success(`Deleted · ${removedName}`);
    close();
  };

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-10 w-full justify-between gap-2 rounded-lg bg-surface-1 px-2.5 text-left font-medium hover:bg-surface-2"
              aria-label={`Switch budget. Current: ${active?.name ?? 'My Budget'}`}
            />
          }
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-nav-50 text-nav-700 dark:bg-nav-900/40 dark:text-nav-200">
            <Wallet className="size-4" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            {active?.name ?? 'My Budget'}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Budgets</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            {budgets.map((b) => {
              const isActive = b.id === activeBudgetId;
              return (
                <DropdownMenuItem
                  key={b.id}
                  onClick={() => {
                    if (!isActive) setActiveBudget(b.id);
                  }}
                  className="group gap-2 pr-1"
                >
                  <Check
                    className={
                      isActive
                        ? 'size-4 shrink-0 text-nav-600'
                        : 'size-4 shrink-0 text-transparent'
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{b.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Edit ${b.name}`}
                      onClick={(e) => {
                        stop(e);
                        openEdit(b);
                      }}
                      onPointerDown={stop}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground focus-visible:outline-none"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.8} />
                    </button>
                    {onlyOne ? null : (
                      <button
                        type="button"
                        aria-label={`Delete ${b.name}`}
                        onClick={(e) => {
                          stop(e);
                          openDelete(b);
                        }}
                        onPointerDown={stop}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-expense/10 hover:text-expense focus-visible:bg-expense/10 focus-visible:text-expense focus-visible:outline-none"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.8} />
                      </button>
                    )}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openCreate}>
            <Plus className="size-4" /> New budget…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode === 'create'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New budget</DialogTitle>
            <DialogDescription>
              Copies the current budget&rsquo;s income and bills into a new workspace,
              scoped to the date range you pick. Paid/received markers are cleared.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor={inputId}>Name</Label>
              <Input
                id={inputId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Side hustle"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between">
                <Label>Date range</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pendingFrom
                    ? 'Pick an end date…'
                    : range
                      ? fdRange(range.start, range.end)
                      : 'Pick a start date…'}
                </span>
              </div>
              <div className="flex justify-center overflow-hidden rounded-lg border bg-surface-1 px-2 py-1">
                <Calendar
                  mode="range"
                  selected={calendarSelected}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={1}
                  defaultMonth={range ? fromIso(range.start) : undefined}
                />
              </div>
            </div>
            <DialogFooter className="mt-1">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || !range}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'edit'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit budget</DialogTitle>
            <DialogDescription>
              Update the name or default date range for &ldquo;{target?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor={`${inputId}-edit`}>Name</Label>
              <Input
                id={`${inputId}-edit`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between">
                <Label>Default date range</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pendingFrom
                    ? 'Pick an end date…'
                    : range
                      ? fdRange(range.start, range.end)
                      : 'Pick a start date…'}
                </span>
              </div>
              <div className="flex justify-center overflow-hidden rounded-lg border bg-surface-1 px-2 py-1">
                <Calendar
                  mode="range"
                  selected={calendarSelected}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={1}
                  defaultMonth={range ? fromIso(range.start) : undefined}
                />
              </div>
            </div>
            <DialogFooter className="mt-1 sm:justify-between">
              {onlyOne ? (
                <span aria-hidden className="hidden sm:block" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => target && openDelete(target)}
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-expense/10 hover:text-expense"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.8} />
                  Delete budget
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!name.trim() || !range}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={mode === 'delete'} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes &ldquo;{target?.name}&rdquo; and all of its income, bills,
              periods, and paid markers. Other budgets are unaffected. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
