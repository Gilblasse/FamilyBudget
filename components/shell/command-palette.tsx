'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BarChart3,
  CalendarRange,
  ClipboardPaste,
  Compass,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Moon,
  PiggyBank,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useBudget } from '@/lib/store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import { visibleBills, visibleIncomeSources } from '@/lib/visibility';
import { useAILauncher } from '@/components/budget/ai/ai-launcher-provider';
import { fmt, fd } from '@/lib/format';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { status: aiStatus, openAssistant } = useAILauncher();
  const income = useBudget((s) => s.income);
  const bills = useBudget((s) => s.bills);
  const addBill = useBudget((s) => s.addBill);
  const addIncome = useBudget((s) => s.addIncome);
  const range = useEffectiveDateRange();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isPalette =
        e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
      if (isPalette) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const recentIncome = useMemo(
    () => visibleIncomeSources(income, range).slice(0, 6),
    [income, range],
  );
  const recentBills = useMemo(
    () => visibleBills(bills, range).slice(0, 6),
    [bills, range],
  );

  function run(action: () => void) {
    setOpen(false);
    setTimeout(action, 0);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search routes, actions, items…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => router.push('/'))}>
            <LayoutDashboard /> Dashboard
            <CommandShortcut>g d</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/income'))}>
            <TrendingUp /> Income
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/bills'))}>
            <ListChecks /> Bills
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/cash-flow'))}>
            <BarChart3 /> Cash Flow
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/trial-balance'))}>
            <CalendarRange /> Trial Balance
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/summary'))}>
            <PiggyBank /> Summary
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/settings'))}>
            <SettingsIcon /> Settings
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/help-center'))}>
            <HelpCircle /> Help Center
          </CommandItem>
        </CommandGroup>

        {aiStatus === 'enabled' ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="AI">
              <CommandItem onSelect={() => run(() => openAssistant('chat'))}>
                <Sparkles /> Ask AI
                <CommandShortcut>⌘J</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => openAssistant('suggestions'))}>
                <Wand2 /> Get suggestions
              </CommandItem>
              <CommandItem onSelect={() => run(() => openAssistant('extract'))}>
                <ClipboardPaste /> Extract from text
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />

        <CommandGroup heading="Quick actions">
          <CommandItem
            onSelect={() =>
              run(() => {
                addBill();
                toast.success('Bill added', {
                  description: 'Edit the new row on the Bills page.',
                });
                router.push('/bills');
              })
            }
          >
            <Plus /> Add bill
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                addIncome();
                toast.success('Income added', {
                  description: 'Edit the new row on the Income page.',
                });
                router.push('/income');
              })
            }
          >
            <Plus /> Add income
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))
            }
          >
            {theme === 'dark' ? <Sun /> : <Moon />} Toggle theme
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => router.push('/settings'))}
          >
            <Compass /> Manage periods
          </CommandItem>
        </CommandGroup>

        {recentIncome.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Income">
              {recentIncome.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`income ${r.source} ${r.date} ${r.amount}`}
                  onSelect={() => run(() => router.push('/income'))}
                >
                  <TrendingUp />
                  <span className="flex-1 truncate">{r.source}</span>
                  <span className="text-xs text-muted-foreground money">
                    {fmt(r.amount)} · {fd(r.date)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {recentBills.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Bills">
              {recentBills.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`bill ${b.name} ${b.date} ${b.amount}`}
                  onSelect={() => run(() => router.push('/bills'))}
                >
                  <ListChecks />
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground money">
                    {fmt(b.amount)} · {fd(b.date)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
