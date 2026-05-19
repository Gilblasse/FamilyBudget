'use client';

import type { ReactNode } from 'react';
import { AILauncherProvider } from '@/components/budget/ai/ai-launcher-provider';
import { useRemoteStoreBridge } from '@/lib/remote/store-bridge';
import { RemoteMigrationModal } from './remote-migration-modal';

/**
 * Remote-primary replacement for `BudgetSyncBoundary`. Mounts the
 * envelope bridge (which keeps `useBudget` synced to the server), shows
 * a skeleton while the first fetch is in flight, and surfaces the
 * migration modal when the cloud is empty on first load.
 */
export function RemoteModeBoundary({ children }: { children: ReactNode }) {
  const { status } = useRemoteStoreBridge();

  if (status === 'idle') {
    return (
      <AILauncherProvider>
        <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading cloud data…
        </div>
      </AILauncherProvider>
    );
  }

  return (
    <AILauncherProvider>
      {status === 'first-load-empty' ? <RemoteMigrationModal /> : null}
      {children}
    </AILauncherProvider>
  );
}
