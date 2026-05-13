import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { AppHeader } from '@/components/shell/app-header';
import { BudgetSyncBoundary } from '@/components/shell/budget-sync-boundary';
import { CommandPalette } from '@/components/shell/command-palette';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BudgetSyncBoundary>
          <AppHeader />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
            <div className="mx-auto w-full max-w-[1360px]">{children}</div>
          </main>
          <CommandPalette />
        </BudgetSyncBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
