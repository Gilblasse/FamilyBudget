'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, HelpCircle, Inbox, Settings as SettingsIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeaderDateRangePicker } from '@/components/budget/date-range-picker';
import { AILauncherButton } from '@/components/budget/ai/ai-launcher-button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useBudget } from '@/lib/store';
import { fd } from '@/lib/format';
import { useMemo } from 'react';

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Track, assess, and improve your finances.',
  },
  '/income': { title: 'Income' },
  '/bills': { title: 'Bills' },
  '/cash-flow': { title: 'Cash Flow' },
  '/trial-balance': { title: 'Trial Balance' },
  '/summary': { title: 'Summary' },
  '/settings': { title: 'Settings', subtitle: 'Data, periods, appearance, and AI.' },
  '/help-center': { title: 'Help Center' },
};

const USER_EMAIL = 'gilblasse@gmail.com';
const USER_NAME = 'Nethelbert Blasse';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AppHeader() {
  const pathname = usePathname() ?? '/';
  const meta = TITLES[pathname] ?? TITLES['/'];

  const bills = useBudget((s) => s.bills);
  const paid = useBudget((s) => s.paid);

  const { dueSoon, overdueCount } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    const unpaid = bills.filter((b) => !paid[`bill_${b.id}`]);
    const dueSoon = unpaid
      .filter((b) => b.date >= today && b.date <= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));
    const overdueCount = unpaid.filter((b) => b.date < today).length;
    return { dueSoon, overdueCount };
  }, [bills, paid]);

  const hasOverdue = overdueCount > 0;

  // Pages can opt-in to the picker by removing themselves from this set and
  // rendering <HeaderDateRangePicker /> (or <DateRangePicker /> with custom props) inline.
  const hideDateRangeOn = new Set(['/settings', '/help-center']);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border-subtle bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6 lg:px-8">
      <SidebarTrigger className="md:hidden" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {meta.title}
        </h1>
        {meta.subtitle ? (
          <p className="mt-0.5 hidden text-xs text-muted-foreground md:block md:text-sm">
            {meta.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {!hideDateRangeOn.has(pathname) ? <HeaderDateRangePicker /> : null}
        <ThemeToggle />
        <AILauncherButton />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="relative size-9 rounded-full"
                aria-label={
                  dueSoon.length > 0
                    ? `Notifications (${dueSoon.length} bills due soon)`
                    : 'Notifications'
                }
              />
            }
          >
            <Bell className="size-4" />
            {dueSoon.length > 0 || hasOverdue ? (
              <span
                className={`absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full text-[10px] font-semibold ${
                  hasOverdue
                    ? 'bg-danger-500 text-white'
                    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-100 dark:text-neutral-800'
                }`}
              >
                {hasOverdue ? overdueCount + dueSoon.length : dueSoon.length}
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Bills due in 7 days</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {dueSoon.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Nothing due soon — nice.
              </div>
            ) : (
              dueSoon.slice(0, 6).map((b) => (
                <DropdownMenuItem key={b.id} className="flex items-center gap-2">
                  <Inbox className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground money">
                    {fd(b.date)}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-10 gap-2 rounded-full px-1.5 pr-3"
                aria-label="Account menu"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand-500 text-sm font-semibold text-brand-foreground">
                {getInitials(USER_NAME)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-left text-xs font-semibold leading-tight sm:block">
              {USER_NAME}
            </span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{USER_NAME}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {USER_EMAIL}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/help-center" />}>
              <HelpCircle /> Help Center
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
