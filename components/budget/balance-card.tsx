'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBudget } from '@/lib/store';

export function BalanceCard() {
  const balance = useBudget((s) => s.balance);
  const setBalance = useBudget((s) => s.setBalance);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <Label htmlFor="bank-balance" className="text-sm font-medium whitespace-nowrap">
          Current bank balance
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium text-muted-foreground">$</span>
          <Input
            id="bank-balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={balance === 0 ? '' : balance}
            onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
            className="w-40 text-xl font-medium tabular-nums"
          />
        </div>
      </CardContent>
    </Card>
  );
}
