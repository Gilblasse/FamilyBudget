'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Inbox,
  ListFilter,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBudget } from '@/lib/store';
import { useUIStore, type TxTypeFilter } from '@/lib/ui-store';
import { useMounted } from '@/lib/use-mounted';
import { fmt, fd, toTitleCase } from '@/lib/format';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { STATUS_LABEL } from '@/lib/types';
import type { Bill, Income, IncomeStatus } from '@/lib/types';
import { SeverityTag } from '@/components/budget/severity-tag';

type TxRow =
  | { kind: 'income'; row: Income; paidKey: string }
  | { kind: 'bill'; row: Bill; paidKey: string };

const ROW_LIMIT = 50;

const TX_FILTER_LABEL: Record<TxTypeFilter, string> = {
  all: 'All Transactions',
  income: 'Income only',
  bills: 'Bills only',
};

function incomeStatusVariant(s: IncomeStatus): 'success' | 'info' | 'warning' | 'neutral' {
  if (s === 'received') return 'success';
  if (s === 'confirmed') return 'info';
  if (s === 'pending') return 'warning';
  return 'neutral';
}

export function TransactionHistory() {
  const mounted = useMounted();
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const paid = useBudget((s) => s.paid);
  const togglePaid = useBudget((s) => s.togglePaid);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const clearSearchQuery = useUIStore((s) => s.clearSearchQuery);
  const txTypeFilter = useUIStore((s) => s.txTypeFilter);
  const setTxTypeFilter = useUIStore((s) => s.setTxTypeFilter);
  const txColumns = useUIStore((s) => s.txColumns);
  const setTxColumn = useUIStore((s) => s.setTxColumn);
  const range = useEffectiveDateRange();

  const rows = useMemo<TxRow[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesIncome = (r: Income) =>
      q ? r.source.toLowerCase().includes(q) : true;
    const matchesBill = (b: Bill) =>
      q ? b.name.toLowerCase().includes(q) : true;

    const inc: TxRow[] =
      txTypeFilter === 'bills'
        ? []
        : income
            .filter(
              (r) =>
                r.periodId === activePeriodId &&
                inRange(r.date, range) &&
                matchesIncome(r),
            )
            .map((r) => ({ kind: 'income' as const, row: r, paidKey: `inc_${r.id}` }));
    const bil: TxRow[] =
      txTypeFilter === 'income'
        ? []
        : bills
            .filter(
              (b) =>
                b.periodId === activePeriodId &&
                inRange(b.date, range) &&
                matchesBill(b),
            )
            .map((b) => ({ kind: 'bill' as const, row: b, paidKey: `bill_${b.id}` }));
    const all = [...inc, ...bil];
    all.sort((a, b) => a.row.date.localeCompare(b.row.date));
    return all.slice(0, ROW_LIMIT);
  }, [income, bills, activePeriodId, searchQuery, range, txTypeFilter]);

  const colSpan =
    2 +
    Number(txColumns.date) +
    Number(txColumns.transaction) +
    Number(txColumns.status) +
    1;

  function handleToggle(key: string, label: string, wasPaid: boolean, kind: 'income' | 'bill') {
    togglePaid(key);
    toast.success(
      wasPaid
        ? `Marked ${kind === 'income' ? 'unreceived' : 'unpaid'} · ${label}`
        : `Marked ${kind === 'income' ? 'received' : 'paid'} · ${label}`,
      {
        action: { label: 'Undo', onClick: () => togglePaid(key) },
      },
    );
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-5 shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Transaction History</h2>
          {searchQuery ? (
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm">
                Filtered: &ldquo;{searchQuery}&rdquo; · {rows.length} result
                {rows.length === 1 ? '' : 's'}
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear filter"
                onClick={clearSearchQuery}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-md px-3 text-xs"
                >
                  <ListFilter className="size-3.5" />
                  {TX_FILTER_LABEL[txTypeFilter]}
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={txTypeFilter}
                onValueChange={(v) => setTxTypeFilter(v as TxTypeFilter)}
              >
                <DropdownMenuRadioItem value="all">
                  All Transactions
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="income">
                  Income only
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="bills">
                  Bills only
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-md"
                  aria-label="Adjust columns"
                >
                  <SlidersHorizontal className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={txColumns.date}
                  onCheckedChange={(v) => setTxColumn('date', v === true)}
                >
                  Date
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={txColumns.transaction}
                  onCheckedChange={(v) => setTxColumn('transaction', v === true)}
                >
                  Transaction
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={txColumns.status}
                  onCheckedChange={(v) => setTxColumn('status', v === true)}
                >
                  Status
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Table>
        <TableHeader sticky>
          <TableRow>
            <TableHead className="w-[26%]">Name</TableHead>
            {txColumns.date ? <TableHead className="w-[14%]">Date</TableHead> : null}
            {txColumns.transaction ? (
              <TableHead className="w-[18%]">Transaction</TableHead>
            ) : null}
            <TableHead className="w-[14%] text-right">Amount</TableHead>
            {txColumns.status ? <TableHead className="w-[16%]">Status</TableHead> : null}
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!mounted ? null : rows.length === 0 ? (
            <TableEmpty colSpan={colSpan}>
              <EmptyState
                icon={Inbox}
                title={
                  searchQuery
                    ? 'No matching transactions'
                    : txTypeFilter !== 'all'
                      ? `No ${txTypeFilter === 'income' ? 'income' : 'bills'} in this view`
                      : 'No transactions yet'
                }
                description={
                  searchQuery
                    ? 'Try clearing the filter or switching periods.'
                    : txTypeFilter !== 'all'
                      ? 'Switch the filter or pick a different period to see more.'
                      : 'Add income and bills to see them flow through your ledger.'
                }
                cta={
                  searchQuery ? (
                    <Button size="sm" variant="outline" onClick={clearSearchQuery}>
                      Clear filter
                    </Button>
                  ) : txTypeFilter !== 'all' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTxTypeFilter('all')}
                    >
                      Show all transactions
                    </Button>
                  ) : (
                    <Button size="sm" render={<Link href="/bills" />}>
                      <Plus className="size-3.5" /> Add a bill
                    </Button>
                  )
                }
                size="sm"
              />
            </TableEmpty>
          ) : (
            rows.map((tx) => {
              const isPaid = !!paid[tx.paidKey];
              if (tx.kind === 'income') {
                const variant = isPaid
                  ? 'success'
                  : incomeStatusVariant(tx.row.status);
                return (
                  <TableRow key={tx.paidKey}>
                    <TableCell className="font-medium">
                      {toTitleCase(tx.row.source)}
                    </TableCell>
                    {txColumns.date ? (
                      <TableCell className="text-muted-foreground money">
                        {fd(tx.row.date)}
                      </TableCell>
                    ) : null}
                    {txColumns.transaction ? (
                      <TableCell>
                        <Badge size="sm" variant="success">
                          <ArrowDown className="size-3 rotate-180" /> Income
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right font-medium money text-success-700">
                      +{fmt(tx.row.amount)}
                    </TableCell>
                    {txColumns.status ? (
                      <TableCell>
                        <Badge size="sm" variant={variant}>
                          {isPaid ? 'Received' : STATUS_LABEL[tx.row.status]}
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right">
                      <RowActions
                        paid={isPaid}
                        editHref="/income"
                        onTogglePaid={() =>
                          handleToggle(tx.paidKey, tx.row.source, isPaid, 'income')
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              }
              const b = tx.row;
              return (
                <TableRow key={tx.paidKey}>
                  <TableCell className="font-medium">{toTitleCase(b.name)}</TableCell>
                  {txColumns.date ? (
                    <TableCell className="text-muted-foreground money">
                      {fd(b.date)}
                    </TableCell>
                  ) : null}
                  {txColumns.transaction ? (
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge size="sm" variant="neutral">
                          <ArrowUp className="size-3" /> Bill
                        </Badge>
                        <SeverityTag priority={b.priority} />
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right font-medium money text-danger-700">
                    −{fmt(b.amount)}
                  </TableCell>
                  {txColumns.status ? (
                    <TableCell>
                      <Badge size="sm" variant={isPaid ? 'success' : 'neutral'}>
                        {isPaid ? (
                          <>
                            <Check className="size-3" /> Paid
                          </>
                        ) : (
                          'Pending'
                        )}
                      </Badge>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <RowActions
                      paid={isPaid}
                      editHref="/bills"
                      onTogglePaid={() =>
                        handleToggle(tx.paidKey, b.name, isPaid, 'bill')
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <footer className="mt-3 flex justify-end">
        <Link
          href="/trial-balance"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View ledger →
        </Link>
      </footer>
    </section>
  );
}

function RowActions({
  paid,
  editHref,
  onTogglePaid,
}: {
  paid: boolean;
  editHref: string;
  onTogglePaid: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="size-8 rounded-full" aria-label="Row actions">
            <MoreHorizontal className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onTogglePaid}>
          Mark as {paid ? 'unpaid' : 'paid'}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={editHref} />}>Edit details</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
