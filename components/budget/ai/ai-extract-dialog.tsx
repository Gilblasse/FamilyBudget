'use client';

import { useState } from 'react';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAIStatus } from '@/lib/ai/enabled';
import { useBudget } from '@/lib/store';
import { fmt, fd } from '@/lib/format';
import { extractResponseSchema, type Proposal } from '@/lib/ai/schemas';

type Row = Proposal & { _selected: boolean; _idx: number };

export function AiExtractDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<string | undefined>();
  const status = useAIStatus();
  if (status !== 'enabled') return null;

  function reset() {
    setText('');
    setRows([]);
    setNotes(undefined);
  }

  async function onExtract() {
    if (!text.trim()) return;
    setLoading(true);
    setRows([]);
    setNotes(undefined);
    try {
      const activePeriodId = useBudget.getState().activePeriodId;
      const periods = useBudget.getState().periods;
      const period = periods.find((p) => p.id === activePeriodId);
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          kind: 'auto',
          defaultDate: period?.startDate,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.message ?? `HTTP ${res.status}`);
      }
      const parsed = extractResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Bad response shape');
      if (parsed.data.items.length === 0) {
        toast.info('No items detected');
      }
      setRows(
        parsed.data.items.map((p, idx) => ({ ...p, _selected: true, _idx: idx })),
      );
      setNotes(parsed.data.notes);
    } catch (err) {
      toast.error('Extract failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(idx: number) {
    setRows((rs) => rs.map((r) => (r._idx === idx ? { ...r, _selected: !r._selected } : r)));
  }

  function applySelected() {
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) {
      toast.info('Nothing selected');
      return;
    }
    const store = useBudget.getState();
    let billCount = 0;
    let incomeCount = 0;
    for (const item of selected) {
      if (item.kind === 'bill') {
        store.addBill();
        const newBill = useBudget.getState().bills.at(-1);
        if (!newBill) continue;
        store.updateBill(newBill.id, {
          name: item.name,
          date: item.date,
          amount: item.amount,
          priority: item.priority,
          action: item.action,
        });
        billCount += 1;
      } else {
        store.addIncome();
        const newIncome = useBudget.getState().income.at(-1);
        if (!newIncome) continue;
        store.updateIncome(newIncome.id, {
          source: item.source,
          date: item.date,
          amount: item.amount,
          status: item.status,
        });
        incomeCount += 1;
      }
    }
    toast.success(
      `Added ${billCount} bill${billCount === 1 ? '' : 's'}, ${incomeCount} income`,
    );
    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="h-10 sm:h-9" />}
      >
        <ClipboardPaste className="h-4 w-4" /> Paste to extract
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste to extract</DialogTitle>
          <DialogDescription>
            Paste an email, statement, or freeform text. The assistant returns rows
            you can review and selectively apply. Budget data stays local; only the
            pasted text is sent to your AI provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comcast $129 due 3/15&#10;Electric $87 due 3/20&#10;Paycheck $2,400 expected 3/15"
            rows={6}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={onExtract} disabled={loading || !text.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Extract
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Type</TableHead>
                    <TableHead>Name / source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Tag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r._idx}>
                      <TableCell>
                        <Checkbox
                          checked={r._selected}
                          onCheckedChange={() => toggleRow(r._idx)}
                          aria-label={`Toggle row ${r._idx + 1}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.kind === 'bill' ? 'destructive' : 'default'}>
                          {r.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.kind === 'bill' ? r.name : r.source}
                      </TableCell>
                      <TableCell className="tabular-nums">{fd(r.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(r.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.kind === 'bill' ? `${r.priority} · ${r.action}` : r.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={applySelected}
            disabled={rows.length === 0 || rows.every((r) => !r._selected)}
          >
            Apply selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
