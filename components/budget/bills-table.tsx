'use client';

import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Inbox,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { PriorityDot } from './priority-dot';
import { SeverityTag } from './severity-tag';
import { AiSuggestButton } from './ai/ai-suggest-button';
import { useBudget } from '@/lib/store';
import { useUIStore } from '@/lib/ui-store';
import { fmt } from '@/lib/format';
import {
  ACTION_LABEL,
  PRIORITY_LABEL,
  type Bill,
  type BillAction,
  type Priority,
} from '@/lib/types';
import { cn } from '@/lib/utils';

function actionVariant(a: BillAction): 'default' | 'warning' | 'danger' | 'neutral' {
  if (a === 'pay-full') return 'default';
  if (a === 'partial' || a === 'reduce') return 'warning';
  if (a === 'skip' || a === 'delay') return 'danger';
  return 'neutral';
}

type SortDir = 'asc' | 'desc' | 'none';
type SortCol = 'name' | 'due' | 'amount';
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

export function BillsTable() {
  const bills = useBudget((s) => s.bills);
  const income = useBudget((s) => s.income);
  const balance = useBudget((s) => s.balance);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const addBill = useBudget((s) => s.addBill);
  const updateBill = useBudget((s) => s.updateBill);
  const removeBill = useBudget((s) => s.removeBill);
  const reorderBill = useBudget((s) => s.reorderBill);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const clearSearchQuery = useUIStore((s) => s.clearSearchQuery);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [showSubscriptions, setShowSubscriptions] = useState(false);

  const scopedBills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bills
      .filter((b) => b.periodId === activePeriodId)
      .filter((b) => (q ? b.name.toLowerCase().includes(q) : true));
  }, [bills, activePeriodId, searchQuery]);
  const displayedBills = useMemo(() => {
    if (!sort) return scopedBills;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const copy = [...scopedBills];
    if (sort.col === 'due') {
      copy.sort((a, b) => a.date.localeCompare(b.date) * dir);
    } else if (sort.col === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir);
    } else if (sort.col === 'amount') {
      copy.sort((a, b) => (a.amount - b.amount) * dir);
    }
    return copy;
  }, [scopedBills, sort]);
  const isSorted = sort !== null;

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

  function handleRemove(r: Bill) {
    const snapshot: Bill = { ...r };
    removeBill(r.id);
    toast.success(`Removed "${snapshot.name}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          addBill();
          const created = useBudget.getState().bills.at(-1);
          if (!created) return;
          updateBill(created.id, {
            name: snapshot.name,
            date: snapshot.date,
            amount: snapshot.amount,
            priority: snapshot.priority,
            action: snapshot.action,
          });
        },
      },
    });
  }

  function cycleSort(col: SortCol) {
    setSort((s) => nextDir(s, col));
  }

  function handleAdd() {
    addBill();
    toast.success('Bill added');
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
          'group/billrow',
          !isSorted && overId === r.id && 'border-t-2 border-t-brand-500',
          !isSorted && dragId === r.id && 'opacity-40',
        )}
      >
        <TableCell className="w-8 text-center">
          <GripVertical
            className={cn(
              'mx-auto size-4 text-muted-foreground transition-opacity',
              isSorted
                ? 'opacity-20'
                : 'cursor-grab opacity-0 active:cursor-grabbing group-hover/billrow:opacity-100',
            )}
            aria-hidden
          />
        </TableCell>
        <TableCell>
          <NameCell
            value={r.name}
            onChange={(v) => updateBill(r.id, { name: v })}
          />
        </TableCell>
        <TableCell>
          <DatePicker value={r.date} onChange={(v) => updateBill(r.id, { date: v })} />
        </TableCell>
        <TableCell className="text-right">
          <AmountCell
            value={r.amount}
            onChange={(v) => updateBill(r.id, { amount: v })}
          />
        </TableCell>
        <TableCell>
          <Select
            value={r.priority}
            onValueChange={(v) => updateBill(r.id, { priority: v as Priority })}
          >
            <SelectTrigger className="h-9 border-transparent shadow-none hover:border-border-subtle focus:border-input">
              <SelectValue>
                <SeverityTag priority={r.priority} />
              </SelectValue>
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
            <SelectTrigger className="h-9 border-transparent shadow-none hover:border-border-subtle focus:border-input">
              <SelectValue>
                <Badge size="sm" variant={actionVariant(r.action)}>
                  {ACTION_LABEL[r.action]}
                </Badge>
              </SelectValue>
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
            <DeleteBillButton bill={r} onConfirm={() => handleRemove(r)} />
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Active bills" value={fmt(totalActive)} />
        <Metric label="Crit + Important" value={fmt(critImp)} tone="warning" />
        <Metric label="Net" value={fmt(net)} tone={net >= 0 ? 'income' : 'expense'} />
      </div>

      {searchQuery ? (
        <div className="flex items-center gap-2">
          <Badge variant="info">
            Filtered: &ldquo;{searchQuery}&rdquo; · {scopedBills.length} result
            {scopedBills.length === 1 ? '' : 's'}
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

      <p className="hidden text-xs text-muted-foreground md:block">
        {isSorted
          ? 'Sorted by due date — click the column header again to clear and re-enable drag reorder.'
          : 'Hover a row to reveal the drag handle. Click "Due" to sort by date.'}
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
          onClick={() => cycleSort('due')}
          className="h-10"
          aria-label={`Sort by due date (${dirFor(sort, 'due')})`}
        >
          Sort by due
          {dirFor(sort, 'due') === 'asc' && <ArrowUp className="size-3" />}
          {dirFor(sort, 'due') === 'desc' && <ArrowDown className="size-3" />}
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border-subtle bg-card md:block">
        <Table>
          <TableHeader sticky>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead
                className="w-[24%]"
                sortable
                direction={dirFor(sort, 'name')}
                onSort={() => cycleSort('name')}
              >
                Name
              </TableHead>
              <TableHead
                className="w-[14%]"
                sortable
                direction={dirFor(sort, 'due')}
                onSort={() => cycleSort('due')}
              >
                Due
              </TableHead>
              <TableHead
                className="w-[16%] text-right"
                sortable
                direction={dirFor(sort, 'amount')}
                onSort={() => cycleSort('amount')}
              >
                Amount
              </TableHead>
              <TableHead className="w-[16%]">Priority</TableHead>
              <TableHead className="w-[18%]">Action</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regularBills.length === 0 && subscriptionBills.length === 0 ? (
              <TableEmpty colSpan={7}>
                <EmptyState
                  icon={Inbox}
                  title="No bills in this period"
                  description={
                    searchQuery
                      ? 'Try clearing the filter.'
                      : 'Add your first bill to get started.'
                  }
                  cta={
                    !searchQuery ? (
                      <Button size="sm" onClick={handleAdd}>
                        <Plus className="size-3.5" /> Add bill
                      </Button>
                    ) : undefined
                  }
                  size="sm"
                />
              </TableEmpty>
            ) : (
              <>
                {regularBills.map(renderBillRow)}
                {subscriptionBills.length > 0 && (
                  <TableRow
                    className="cursor-pointer bg-surface-2 hover:bg-surface-2"
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
                          <ChevronDown className="size-4" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden />
                        )}
                        Subscriptions
                        <span className="text-xs text-muted-foreground">
                          ({subscriptionBills.length})
                        </span>
                        <span className="ml-auto money text-muted-foreground">
                          {fmt(subscriptionTotal)}
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {showSubscriptions && subscriptionBills.map(renderBillRow)}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {regularBills.length === 0 && subscriptionBills.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-card">
            <EmptyState
              icon={Inbox}
              title="No bills in this period"
              description="Add your first bill to get started."
              cta={
                <Button size="sm" onClick={handleAdd}>
                  <Plus className="size-3.5" /> Add bill
                </Button>
              }
              size="sm"
            />
          </div>
        ) : (
          regularBills.map((b, i) => (
            <BillCard
              key={b.id}
              bill={b}
              prevId={i > 0 ? regularBills[i - 1].id : null}
              nextId={i < regularBills.length - 1 ? regularBills[i + 1].id : null}
              isSorted={isSorted}
              onUpdate={updateBill}
              onRemove={handleRemove}
              onReorder={reorderBill}
            />
          ))
        )}
        {subscriptionBills.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSubscriptions((v) => !v)}
            aria-expanded={showSubscriptions}
            className="flex w-full items-center gap-2 rounded-2xl border border-border-subtle bg-surface-2 px-3 py-3 text-left text-sm font-medium hover:bg-surface-2/80"
          >
            {showSubscriptions ? (
              <ChevronDown className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )}
            Subscriptions
            <span className="text-xs text-muted-foreground">
              ({subscriptionBills.length})
            </span>
            <span className="ml-auto money text-muted-foreground">
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
              onRemove={handleRemove}
              onReorder={reorderBill}
            />
          ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="h-10 w-full sm:h-9 sm:w-auto"
      >
        <Plus className="size-4" /> Add bill
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
  onRemove: (b: Bill) => void;
  onReorder: (from: string, to: string) => void;
}) {
  const canMoveUp = !isSorted && prevId !== null;
  const canMoveDown = !isSorted && nextId !== null;
  return (
    <div className="space-y-3 rounded-2xl border border-border-subtle bg-card p-3 shadow-[var(--shadow-xs)]">
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
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${bill.name} down`}
              disabled={!canMoveDown}
              onClick={() => nextId && onReorder(bill.id, nextId)}
              className="h-5 w-11"
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>
        )}
        <AiSuggestButton bill={bill} className="h-11 w-11 shrink-0" />
        <DeleteBillButton
          bill={bill}
          onConfirm={() => onRemove(bill)}
          className="h-11 w-11"
          iconClassName="size-4"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Due</Label>
          <DatePicker value={bill.date} onChange={(v) => onUpdate(bill.id, { date: v })} />
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
            className="h-11 money"
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
              <SelectValue>
                <SeverityTag priority={bill.priority} />
              </SelectValue>
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

function NameCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="group/name relative">
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 border-transparent bg-transparent pr-7 shadow-none hover:border-border-subtle focus:border-input focus:bg-card"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Edit name"
        onClick={() => {
          ref.current?.focus();
          ref.current?.select();
        }}
        className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-within/name:opacity-0"
      >
        <Pencil className="size-3" aria-hidden />
      </button>
    </div>
  );
}

function AmountCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  function commit() {
    const parsed = parseFloat(draft);
    onChange(Number.isFinite(parsed) ? parsed : 0);
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        ref={ref}
        autoFocus
        type="number"
        inputMode="decimal"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-9 border-input bg-card text-right money shadow-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className="-mr-1 inline-flex h-9 w-full items-center justify-end rounded-md border border-transparent px-2 text-right money tabular-nums transition-colors hover:border-border-subtle focus-visible:border-input focus-visible:bg-card"
    >
      {fmt(value)}
    </button>
  );
}

function DeleteBillButton({
  bill,
  onConfirm,
  className,
  iconClassName,
}: {
  bill: Bill;
  onConfirm: () => void;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${bill.name || 'bill'}`}
            className={className}
          >
            <Trash2 className={cn('size-3.5 text-muted-foreground', iconClassName)} />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{bill.name || 'Untitled bill'}&rdquo; will be removed. You can
            undo right after from the toast.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
