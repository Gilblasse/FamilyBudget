'use client';

import { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useAIStatus } from '@/lib/ai/enabled';
import { useBudget } from '@/lib/store';
import { fmt } from '@/lib/format';
import { ACTION_LABEL, type BillAction } from '@/lib/types';
import { adviseResponseSchema, type AdviseResponse } from '@/lib/ai/schemas';

export function AiAdvisorSheet() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdviseResponse | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const bills = useBudget((s) => s.bills);
  const status = useAIStatus();
  if (status !== 'enabled') return null;

  async function fetchAdvice() {
    setLoading(true);
    setResult(null);
    setApplied(new Set());
    try {
      const { balance, income, bills, paid, periods, activePeriodId } = useBudget.getState();
      const res = await fetch('/api/ai/advise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          snapshot: { balance, income, bills, paid, periods, activePeriodId },
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.message ?? `HTTP ${res.status}`);
      }
      const parsed = adviseResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Bad response shape');
      setResult(parsed.data);
    } catch (err) {
      toast.error('Advisor failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }

  function applyOne(billId: string, action: BillAction) {
    useBudget.getState().updateBill(billId, { action });
    setApplied((s) => new Set(s).add(billId));
  }

  function applyAll() {
    if (!result) return;
    const store = useBudget.getState();
    const next = new Set(applied);
    for (const rec of result.recommendations) {
      if (next.has(rec.billId)) continue;
      store.updateBill(rec.billId, { action: rec.suggestedAction });
      next.add(rec.billId);
    }
    setApplied(next);
    toast.success(`Applied ${result.recommendations.length} suggestions`);
  }

  function billName(id: string): string {
    return bills.find((b) => b.id === id)?.name ?? '(unknown bill)';
  }

  function currentAction(id: string): BillAction | null {
    return bills.find((b) => b.id === id)?.action ?? null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" className="h-10 sm:h-9" />}>
        <Wand2 className="h-4 w-4" /> Get suggestions
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>Suggestions for this period</SheetTitle>
            <SheetDescription>
              Read-only by default. Apply each row individually, or apply all at once.
              Critical bills are never proposed for skip or delay.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!result && !loading && (
              <p className="text-sm text-muted-foreground">
                Click <strong>Analyze</strong> to ask the assistant which bills could be
                delayed, reduced, or skipped to improve this period.
              </p>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your budget…
              </div>
            )}

            {result && (
              <>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {result.summary}
                </div>

                {result.recommendations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No changes recommended.
                  </p>
                ) : (
                  result.recommendations.map((rec) => {
                    const isApplied = applied.has(rec.billId);
                    const current = currentAction(rec.billId);
                    return (
                      <div
                        key={rec.billId}
                        className="space-y-2 rounded-md border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">{billName(rec.billId)}</div>
                          <Badge variant="secondary" className="tabular-nums">
                            saves {fmt(rec.savingsAmount)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {current && (
                            <Badge variant="outline" className="font-normal">
                              now: {ACTION_LABEL[current]}
                            </Badge>
                          )}
                          <Badge className="font-normal">
                            suggest: {ACTION_LABEL[rec.suggestedAction]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={isApplied ? 'ghost' : 'default'}
                            disabled={isApplied}
                            onClick={() => applyOne(rec.billId, rec.suggestedAction)}
                          >
                            {isApplied ? 'Applied' : 'Apply'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchAdvice}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {result ? 'Re-analyze' : 'Analyze'}
            </Button>
            {result && result.recommendations.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={applyAll}
                disabled={result.recommendations.every((r) => applied.has(r.billId))}
              >
                Apply all
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
