'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useBudget } from '@/lib/store';
import { ACTION_LABEL, PRIORITY_LABEL, type Bill } from '@/lib/types';
import { classifyResponseSchema } from '@/lib/ai/schemas';

export function AiSuggestButton({ bill, className }: { bill: Bill; className?: string }) {
  const [loading, setLoading] = useState(false);

  async function suggest() {
    if (!bill.name.trim()) {
      toast.error('Add a name first');
      return;
    }
    setLoading(true);
    const before = { priority: bill.priority, action: bill.action };
    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: bill.name, date: bill.date, amount: bill.amount }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.message ?? `HTTP ${res.status}`);
      }
      const parsed = classifyResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Bad response shape');
      const { priority, action, rationale } = parsed.data;
      useBudget.getState().updateBill(bill.id, { priority, action });
      toast.success(`${PRIORITY_LABEL[priority]} · ${ACTION_LABEL[action]}`, {
        description: rationale,
        action: {
          label: 'Undo',
          onClick: () => useBudget.getState().updateBill(bill.id, before),
        },
      });
    } catch (err) {
      toast.error('Suggestion failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={suggest}
      disabled={loading}
      aria-label={`Suggest priority and action for ${bill.name}`}
      className={className}
    >
      <Sparkles className={loading ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
    </Button>
  );
}
