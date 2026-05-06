'use client';

import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AiSuggestButton } from './ai/ai-suggest-button';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import {
  ACTION_LABEL,
  PRIORITY_LABEL,
  type Bill,
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
  const [showSubscriptions, setShowSubscriptions] = useState(false);

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

  const { regularBills, subscriptionBills, subscriptionTotal } = useMemo(() => {
    const subs: Bill[] = [];
    const rest: Bill[] = [];
    for (const b of displayedBills) {
      if (b.name.toLowerCase().includes('subscription')) subs.push(b);
      else rest.push(b);
    }
    const total = subs.reduce((s, b) => s + b.amount, 0);
    return { regularBills: rest, subscriptionBills: subs, subscriptionTotal: total };
  }, [displayedBills]);
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

  function renderBillRow(r: Bill) {
    return (
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
          <div className="flex items-center justify-end gap-1">
            <AiSuggestButton bill={r} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${r.name}`}
              onClick={() => removeBill(r.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Active bills" value={fmt(totalActive)} />
        <Metric label="Crit + Important" value={fmt(critImp)} tone="warning" />
        <Metric label="Net" value={fmt(net)} tone={net >= 0 ? 'income' : 'expense'} />
      </div>

      <p className="hidden text-xs text-muted-foreground md:block">
        {isSorted
          ? 'Sorted by due date — click the column header again to clear and re-enable drag reorder.'
          : 'Drag the handle on the left to reorder rows. Click "Due" to sort by date.'}
      </p>
      <p className="text-xs text-muted-foreground md:hidden">
        {isSorted
          ? 'Sorted by due date — tap the sort button again to clear.'
          : 'Use the up/down buttons to reorder. Tap the sort button to sort by date.'}
      </p>

      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDueSort((s) => (s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none'))
          }
          className="h-10"
          aria-label={`Sort by due date (${dueSort})`}
        >
          Sort by due
          {dueSort === 'asc' && <ArrowUp className="h-3 w-3" />}
          {dueSort === 'desc' && <ArrowDown className="h-3 w-3" />}
          {dueSort === 'none' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </Button>
      </div>

      <div className="hidden rounded-lg border md:block">
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
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {regularBills.map(renderBillRow)}
            {subscriptionBills.length > 0 && (
              <TableRow
                className="bg-muted/40 hover:bg-muted/60 cursor-pointer"
                onClick={() => setShowSubscriptions((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowSubscriptions((v) => !v);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={showSubscriptions}
                aria-controls="subscriptions-group"
              >
                <TableCell colSpan={7} className="font-medium">
                  <span className="flex items-center gap-2">
                    {showSubscriptions ? (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    )}
                    Subscriptions
                    <span className="text-xs text-muted-foreground">
                      ({subscriptionBills.length})
                    </span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {fmt(subscriptionTotal)}
                    </span>
                  </span>
                </TableCell>
              </TableRow>
            )}
            {showSubscriptions && subscriptionBills.map(renderBillRow)}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {regularBills.map((b, i) => (
          <BillCard
            key={b.id}
            bill={b}
            prevId={i > 0 ? regularBills[i - 1].id : null}
            nextId={i < regularBills.length - 1 ? regularBills[i + 1].id : null}
            isSorted={isSorted}
            onUpdate={updateBill}
            onRemove={removeBill}
            onReorder={reorderBill}
          />
        ))}
        {subscriptionBills.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSubscriptions((v) => !v)}
            aria-expanded={showSubscriptions}
            className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-3 text-left text-sm font-medium hover:bg-muted/60"
          >
            {showSubscriptions ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
            Subscriptions
            <span className="text-xs text-muted-foreground">
              ({subscriptionBills.length})
            </span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {fmt(subscriptionTotal)}
            </span>
          </button>
        )}
        {showSubscriptions &&
          subscriptionBills.map((b) => (
            <BillCard
              key={b.id}
              bill={b}
              prevId={null}
              nextId={null}
              isSorted
              onUpdate={updateBill}
              onRemove={removeBill}
              onReorder={reorderBill}
            />
          ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addBill}
        className="h-10 w-full sm:h-9 sm:w-auto"
      >
        <Plus className="h-4 w-4" /> Add bill
      </Button>
    </div>
  );
}

function BillCard({
  bill,
  prevId,
  nextId,
  isSorted,
  onUpdate,
  onRemove,
  onReorder,
}: {
  bill: Bill;
  prevId: string | null;
  nextId: string | null;
  isSorted: boolean;
  onUpdate: (id: string, patch: Partial<Bill>) => void;
  onRemove: (id: string) => void;
  onReorder: (from: string, to: string) => void;
}) {
  const canMoveUp = !isSorted && prevId !== null;
  const canMoveDown = !isSorted && nextId !== null;
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <Input
          value={bill.name}
          onChange={(e) => onUpdate(bill.id, { name: e.target.value })}
          placeholder="Name"
          className="h-11 flex-1"
        />
        {!isSorted && (
          <div className="flex shrink-0 flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${bill.name} up`}
              disabled={!canMoveUp}
              onClick={() => prevId && onReorder(bill.id, prevId)}
              className="h-5 w-11"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${bill.name} down`}
              disabled={!canMoveDown}
              onClick={() => nextId && onReorder(bill.id, nextId)}
              className="h-5 w-11"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
        <AiSuggestButton bill={bill} className="h-11 w-11 shrink-0" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${bill.name}`}
          onClick={() => onRemove(bill.id)}
          className="h-11 w-11 shrink-0"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Due</Label>
          <Input
            type="date"
            value={bill.date}
            onChange={(e) => onUpdate(bill.id, { date: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Amount</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={bill.amount}
            onChange={(e) =>
              onUpdate(bill.id, { amount: parseFloat(e.target.value) || 0 })
            }
            className="h-11 tabular-nums"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Priority</Label>
          <Select
            value={bill.priority}
            onValueChange={(v) => onUpdate(bill.id, { priority: v as Priority })}
          >
            <SelectTrigger className="h-11 w-full">
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
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Action</Label>
          <Select
            value={bill.action}
            onValueChange={(v) => onUpdate(bill.id, { action: v as BillAction })}
          >
            <SelectTrigger className="h-11 w-full">
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
        </div>
      </div>
    </div>
  );
}
