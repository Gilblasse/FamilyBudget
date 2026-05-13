'use client';

import type { ReactNode } from 'react';
import { useBudgetSync } from '@/lib/sync';
import { AILauncherProvider } from '@/components/budget/ai/ai-launcher-provider';

export function BudgetSyncBoundary({ children }: { children: ReactNode }) {
  useBudgetSync();
  return <AILauncherProvider>{children}</AILauncherProvider>;
}
