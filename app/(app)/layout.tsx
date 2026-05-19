import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { AppHeader } from '@/components/shell/app-header';
import { BudgetSyncBoundary } from '@/components/shell/budget-sync-boundary';
import { RemoteModeBoundary } from '@/components/shell/remote-mode-boundary';
import { CommandPalette } from '@/components/shell/command-palette';
import { isRemotePrimary } from '@/lib/remote-mode';

export default function AppLayout({ children }: { children: ReactNode }) {
  const Boundary = isRemotePrimary() ? RemoteModeBoundary : BudgetSyncBoundary;
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Boundary>
          <AppHeader />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
            <div className="mx-auto w-full max-w-[1360px]">{children}</div>
          </main>
          <CommandPalette />
        </Boundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
