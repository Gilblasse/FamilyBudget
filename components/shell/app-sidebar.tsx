'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  BarChart3,
  CalendarRange,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  Settings as SettingsIcon,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useBudget } from '@/lib/store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { inRange } from '@/lib/filters';
import { SidebarSearch } from './sidebar-search';
import { SidebarDataCard } from './sidebar-data-card';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
  badgeTone?: 'neutral' | 'danger';
}

export function AppSidebar() {
  const pathname = usePathname();

  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const paid = useBudget((s) => s.paid);
  const activePeriodId = useBudget((s) => s.activePeriodId);
  const range = useEffectiveDateRange();

  const { pendingIncome, unpaidImportant, untoggled } = useMemo(() => {
    const periodIncome = income.filter(
      (r) => r.periodId === activePeriodId && inRange(r.date, range),
    );
    const periodBills = bills.filter(
      (b) => b.periodId === activePeriodId && inRange(b.date, range),
    );
    const pendingIncome = periodIncome.filter((r) => r.status === 'pending').length;
    const unpaidImportant = periodBills.filter(
      (b) => (b.priority === 'crit' || b.priority === 'imp') && !paid[`bill_${b.id}`],
    ).length;
    const untoggledIncome = periodIncome.filter((r) => !paid[`inc_${r.id}`]).length;
    const untoggledBills = periodBills.filter((b) => !paid[`bill_${b.id}`]).length;
    return {
      pendingIncome,
      unpaidImportant,
      untoggled: untoggledIncome + untoggledBills,
    };
  }, [income, bills, paid, activePeriodId, range]);

  const menuItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    {
      label: 'Income',
      href: '/income',
      icon: TrendingUp,
      badge: pendingIncome,
      badgeTone: 'neutral',
    },
    {
      label: 'Bills',
      href: '/bills',
      icon: ListChecks,
      badge: unpaidImportant,
      badgeTone: 'neutral',
    },
    { label: 'Cash Flow', href: '/cash-flow', icon: BarChart3 },
    {
      label: 'Trial Balance',
      href: '/trial-balance',
      icon: CalendarRange,
      badge: untoggled,
      badgeTone: 'neutral',
    },
    { label: 'Summary', href: '/summary', icon: PiggyBank },
  ];

  const toolItems: NavItem[] = [
    { label: 'Settings', href: '/settings', icon: SettingsIcon },
    { label: 'Help Center', href: '/help-center', icon: HelpCircle },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={active}
          tooltip={item.label}
          size="lg"
          render={
            <Link
              href={item.href}
              className="relative rounded-xl data-active:bg-nav-50 data-active:font-medium data-active:text-nav-700 data-active:before:absolute data-active:before:left-0 data-active:before:top-1/2 data-active:before:h-5 data-active:before:w-0.5 data-active:before:-translate-y-1/2 data-active:before:rounded-full data-active:before:bg-nav-500 hover:bg-surface-2"
            />
          }
        >
          <Icon
            className={
              active
                ? 'size-[18px] text-nav-600'
                : 'size-[18px] text-muted-foreground'
            }
            strokeWidth={1.6}
          />
          <span>{item.label}</span>
        </SidebarMenuButton>
        {item.badge && item.badge > 0 ? (
          <SidebarMenuBadge className="top-1/2 -translate-y-1/2 bg-transparent p-0">
            <Badge
              size="sm"
              variant={item.badgeTone === 'danger' ? 'danger' : 'neutral'}
            >
              {item.badge}
            </Badge>
          </SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold text-sidebar-foreground"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-nav-500 text-nav-foreground shadow-[var(--shadow-sm)]">
              <Wallet className="size-5" strokeWidth={1.8} />
            </span>
            <span className="group-data-[collapsible=icon]:hidden">Family Budget</span>
          </Link>
          <SidebarTrigger className="size-8 text-foreground/80 hover:text-foreground group-data-[collapsible=icon]:size-7" />
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <SidebarSearch />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>MENU</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{menuItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        <SidebarGroup className="p-0 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>TOOLS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{toolItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="group-data-[collapsible=icon]:hidden">
          <SidebarDataCard />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
