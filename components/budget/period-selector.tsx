'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select';
import { useBudget } from '@/lib/store';
import { fdRange } from '@/lib/format';
import { useMounted } from '@/lib/use-mounted';

const CUSTOM_VALUE = '__custom__';

function periodLabel(startDate: string, endDate: string, label?: string): string {
  const base = fdRange(startDate, endDate);
  return label ? `${base} · ${label}` : base;
}

export function PeriodSelector() {
  const mounted = useMounted();
  const periods = useBudget((s) => s.periods);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const setActivePeriod = useBudget((s) => s.setActivePeriod);
  const addPeriod = useBudget((s) => s.addPeriod);
  const removePeriod = useBudget((s) => s.removePeriod);
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');
  const [copyIncome, setCopyIncome] = useState(true);
  const [copyBills, setCopyBills] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods],
  );
  const activePeriod = useMemo(
    () => periods.find((p) => p.id === activePeriodId),
    [periods, activePeriodId],
  );
  const pendingDeletePeriod = useMemo(
    () => (pendingDeleteId ? periods.find((p) => p.id === pendingDeleteId) ?? null : null),
    [periods, pendingDeleteId],
  );
  const pendingImpact = useMemo(() => {
    if (!pendingDeleteId) return { incomeCount: 0, billCount: 0 };
    return {
      incomeCount: income.filter((r) => r.periodId === pendingDeleteId).length,
      billCount: bills.filter((b) => b.periodId === pendingDeleteId).length,
    };
  }, [income, bills, pendingDeleteId]);
  const previousCounts = useMemo(() => {
    if (!activePeriod) return { incomeCount: 0, billCount: 0 };
    return {
      incomeCount: income.filter((r) => r.periodId === activePeriod.id).length,
      billCount: bills.filter((b) => b.periodId === activePeriod.id).length,
    };
  }, [income, bills, activePeriod]);
  const overlappingPeriod = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return null;
    return (
      periods.find((p) => p.startDate <= endDate && startDate <= p.endDate) ?? null
    );
  }, [periods, startDate, endDate]);

  const canDelete = periods.length > 1;

  function handleValueChange(v: string | null) {
    if (v === null) return;
    if (v === CUSTOM_VALUE) {
      setStartDate('');
      setEndDate('');
      setLabel('');
      setCopyIncome(true);
      setCopyBills(true);
      setDialogOpen(true);
      return;
    }
    setActivePeriod(v);
  }

  function handleCreate() {
    if (!startDate || !endDate) {
      toast.error('Pick both a start and end date.');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date must be on or before end date.');
      return;
    }
    addPeriod({
      startDate,
      endDate,
      label: label.trim() || undefined,
      copyIncome,
      copyBills,
    });
    setDialogOpen(false);
    toast.success('Period added');
  }

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setPendingDeleteId(id);
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    removePeriod(pendingDeleteId);
    setPendingDeleteId(null);
    toast.success('Period deleted');
  }

  const triggerText = mounted && activePeriod
    ? periodLabel(activePeriod.startDate, activePeriod.endDate, activePeriod.label)
    : 'Select period';

  return (
    <>
      <Select value={activePeriodId} onValueChange={handleValueChange}>
        <SelectTrigger size="sm" aria-label="Select budget period">
          <span className="text-xs">{triggerText}</span>
        </SelectTrigger>
        <SelectContent>
          {sortedPeriods.map((p) => (
            <SelectItem key={p.id} value={p.id} className="pr-10">
              <span className="flex-1">{periodLabel(p.startDate, p.endDate, p.label)}</span>
              {canDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${periodLabel(p.startDate, p.endDate, p.label)}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleDeleteClick(e, p.id)}
                  className="absolute right-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-expense"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM_VALUE}>Custom date range…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New date range</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="period-start">Start date</Label>
              <Input
                id="period-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="period-end">End date</Label>
              <Input
                id="period-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="period-label">Label (optional)</Label>
              <Input
                id="period-label"
                type="text"
                placeholder="e.g. June cycle"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            {overlappingPeriod && (
              <p className="text-xs text-warning">
                This range overlaps with {periodLabel(overlappingPeriod.startDate, overlappingPeriod.endDate, overlappingPeriod.label)}.
              </p>
            )}
            {activePeriod && (
              <div className="grid gap-2 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Copy from {periodLabel(activePeriod.startDate, activePeriod.endDate, activePeriod.label)}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={copyIncome}
                    onCheckedChange={(v) => setCopyIncome(v === true)}
                  />
                  Income sources ({previousCounts.incomeCount})
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={copyBills}
                    onCheckedChange={(v) => setCopyBills(v === true)}
                  />
                  Bills ({previousCounts.billCount})
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this date range?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePeriod
                ? `${periodLabel(pendingDeletePeriod.startDate, pendingDeletePeriod.endDate, pendingDeletePeriod.label)} — will remove ${pendingImpact.incomeCount} income and ${pendingImpact.billCount} bill entries tied to this range. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete range
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
