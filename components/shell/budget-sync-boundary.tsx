'use client';

import type { ReactNode } from 'react';
import { useBudgetSync } from '@/lib/sync';
import { AILauncherProvider } from '@/components/budget/ai/ai-launcher-provider';

export function BudgetSyncBoundary({ children }: { children: ReactNode }) {
  // useBudgetSync internally no-ops in remote-primary mode, so this is
  // safe to call unconditionally.
  useBudgetSync();
  return <AILauncherProvider>{children}</AILauncherProvider>;
}
