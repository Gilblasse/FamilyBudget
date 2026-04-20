'use client';

import { useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
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
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import { STATUS_LABEL, type IncomeStatus } from '@/lib/types';

export function IncomeTable() {
  const income = useBudget((s) => s.income);
  const balance = useBudget((s) => s.balance);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const addIncome = useBudget((s) => s.addIncome);
  const updateIncome = useBudget((s) => s.updateIncome);
  const removeIncome = useBudget((s) => s.removeIncome);

  const scoped = useMemo(
    () => income.filter((r) => r.periodId === activePeriodId),
    [income, activePeriodId],
  );

  const { totalAll, totalConfirmed } = useMemo(() => {
    let all = balance;
    let conf = balance;
    for (const r of scoped) {
      all += r.amount;
      if (r.status === 'confirmed' || r.status === 'received') conf += r.amount;
    }
    return { totalAll: all, totalConfirmed: conf };
  }, [scoped, balance]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Bank balance" value={fmt(balance)} tone={balance > 0 ? 'income' : 'default'} />
        <Metric label="Income + balance" value={fmt(totalAll)} tone="income" />
        <Metric label="Confirmed" value={fmt(totalConfirmed)} />
        <Metric label="Sources" value={String(scoped.length)} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Source</TableHead>
              <TableHead className="w-[20%]">Date</TableHead>
              <TableHead className="w-[18%]">Amount</TableHead>
              <TableHead className="w-[22%]">Status</TableHead>
              <TableHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {scoped.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Input
                    value={r.source}
                    onChange={(e) => updateIncome(r.id, { source: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={r.date}
                    onChange={(e) => updateIncome(r.id, { date: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) =>
                      updateIncome(r.id, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="tabular-nums"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(v) => updateIncome(r.id, { status: v as IncomeStatus })}
                  >
                    <SelectTrigger>
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
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.source}`}
                    onClick={() => removeIncome(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" size="sm" onClick={addIncome}>
        <Plus className="h-4 w-4" /> Add income
      </Button>
    </div>
  );
}
