import Link from 'next/link';
import { Compass, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { AppHeader } from '@/components/shell/app-header';
import { BudgetSyncBoundary } from '@/components/shell/budget-sync-boundary';

export const metadata = {
  title: 'Page not found · Family Budget',
};

export default function NotFound() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BudgetSyncBoundary>
          <AppHeader />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
            <div className="mx-auto w-full max-w-[1360px]">
              <Card>
                <CardContent className="py-4">
                  <EmptyState
                    icon={Compass}
                    title="Page not found"
                    description="That route doesn't exist (yet). Head back to the dashboard or report the broken link if you got here from somewhere inside the app."
                    cta={
                      <Button render={<Link href="/" />}>
                        <Compass className="size-4" /> Back to Dashboard
                      </Button>
                    }
                    secondary={
                      <Button
                        variant="ghost"
                        render={
                          <a
                            href="https://github.com/Gilblasse/family-budget/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <MessageCircle className="size-4" /> Report an issue
                      </Button>
                    }
                    size="lg"
                  />
                </CardContent>
              </Card>
            </div>
          </main>
        </BudgetSyncBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
