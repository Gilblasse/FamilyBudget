'use client';

import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
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
import { PriorityDot } from './priority-dot';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import {
  ACTION_LABEL,
  PRIORITY_LABEL,
  type BillAction,
  type Priority,
} from '@/lib/types';
import { cn } from '@/lib/utils';

export function BillsTable() {
  const bills = useBudget((s) => s.bills);
  const income = useBudget((s) => s.income);
  const balance = useBudget((s) => s.balance);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const addBill = useBudget((s) => s.addBill);
  const updateBill = useBudget((s) => s.updateBill);
  const removeBill = useBudget((s) => s.removeBill);
  const reorderBill = useBudget((s) => s.reorderBill);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dueSort, setDueSort] = useState<'none' | 'asc' | 'desc'>('none');

  const scopedBills = useMemo(
    () => bills.filter((b) => b.periodId === activePeriodId),
    [bills, activePeriodId],
  );
  const displayedBills = useMemo(() => {
    if (dueSort === 'none') return scopedBills;
    const dir = dueSort === 'asc' ? 1 : -1;
    return [...scopedBills].sort((a, b) => a.date.localeCompare(b.date) * dir);
  }, [scopedBills, dueSort]);
  const isSorted = dueSort !== 'none';
  const scopedIncome = useMemo(
    () => income.filter((r) => r.periodId === activePeriodId),
    [income, activePeriodId],
  );

  const { totalActive, critImp, net } = useMemo(() => {
    const active = scopedBills.filter((b) => b.action !== 'skip' && b.action !== 'delay');
    const totalActive = active.reduce((s, b) => s + b.amount, 0);
    const critImp = active
      .filter((b) => b.priority === 'crit' || b.priority === 'imp')
      .reduce((s, b) => s + b.amount, 0);
    const totalInc = scopedIncome.reduce((s, r) => s + r.amount, 0) + balance;
    return { totalActive, critImp, net: totalInc - totalActive };
  }, [scopedBills, scopedIncome, balance]);

  function onDragStart(e: DragEvent<HTMLTableRowElement>, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }
  function onDragOver(e: DragEvent<HTMLTableRowElement>, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragId && dragId !== id) setOverId(id);
  }
  function onDrop(e: DragEvent<HTMLTableRowElement>, id: string) {
    e.preventDefault();
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (from) reorderBill(from, id);
  }
  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Active bills" value={fmt(totalActive)} />
        <Metric label="Crit + Important" value={fmt(critImp)} tone="warning" />
        <Metric label="Net" value={fmt(net)} tone={net >= 0 ? 'income' : 'expense'} />
      </div>

      <p className="text-xs text-muted-foreground">
        {isSorted
          ? 'Sorted by due date — click the column header again to clear and re-enable drag reorder.'
          : 'Drag the handle on the left to reorder rows. Click "Due" to sort by date.'}
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-[26%]">Name</TableHead>
              <TableHead className="w-[14%]">
                <button
                  type="button"
                  onClick={() =>
                    setDueSort((s) => (s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none'))
                  }
                  aria-label={`Sort by due date (${dueSort})`}
                  className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground"
                >
                  Due
                  {dueSort === 'asc' && <ArrowUp className="h-3 w-3" />}
                  {dueSort === 'desc' && <ArrowDown className="h-3 w-3" />}
                  {dueSort === 'none' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </TableHead>
              <TableHead className="w-[14%]">Amount</TableHead>
              <TableHead className="w-[16%]">Priority</TableHead>
              <TableHead className="w-[16%]">Action</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedBills.map((r) => (
              <TableRow
                key={r.id}
                draggable={!isSorted}
                onDragStart={isSorted ? undefined : (e) => onDragStart(e, r.id)}
                onDragOver={isSorted ? undefined : (e) => onDragOver(e, r.id)}
                onDragLeave={isSorted ? undefined : () => setOverId((p) => (p === r.id ? null : p))}
                onDrop={isSorted ? undefined : (e) => onDrop(e, r.id)}
                onDragEnd={isSorted ? undefined : onDragEnd}
                className={cn(
                  'transition-colors',
                  !isSorted && overId === r.id && 'border-t-2 border-t-primary',
                  !isSorted && dragId === r.id && 'opacity-40'
                )}
              >
                <TableCell className="text-center">
                  <GripVertical
                    className={cn(
                      'mx-auto h-4 w-4 text-muted-foreground',
                      isSorted ? 'opacity-20' : 'cursor-grab active:cursor-grabbing',
                    )}
                    aria-hidden
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={r.name}
                    onChange={(e) => updateBill(r.id, { name: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={r.date}
                    onChange={(e) => updateBill(r.id, { date: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) =>
                      updateBill(r.id, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="tabular-nums"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={r.priority}
                    onValueChange={(v) => updateBill(r.id, { priority: v as Priority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <PriorityDot priority={p} />
                            {PRIORITY_LABEL[p]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={r.action}
                    onValueChange={(v) => updateBill(r.id, { action: v as BillAction })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABEL) as BillAction[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          {ACTION_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => removeBill(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" size="sm" onClick={addBill}>
        <Plus className="h-4 w-4" /> Add bill
      </Button>
    </div>
  );
}
