'use client';

import { useTheme } from 'next-themes';
import { useMounted } from '@/lib/use-mounted';
import CashFlowTimeline, {
  type TimelineDay,
} from './cash-flow-timeline';

export interface CashFlowPageProps {
  dateRange: { start: Date; end: Date };
  user: { name: string; initials: string };
  openingBalance: number;
  allIncome: number;
  bills: number;
  endingBalance: number;
  timeline: TimelineDay[];
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const rangeStartFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const rangeEndFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-3 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-3.5 text-slate-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 text-slate-700 dark:text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 text-slate-700 dark:text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 text-slate-700 dark:text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-100/[0.06]"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function formatRange(start: Date, end: Date): string {
  return `${rangeStartFmt.format(start)} – ${rangeEndFmt.format(end)}`;
}

interface KpiCardProps {
  label: string;
  dotClass: string;
  value: number;
}

function KpiCard({ label, dotClass, value }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-900/[0.06] bg-white px-4 py-3.5 hover:bg-slate-50 hover:border-slate-900/[0.12] dark:bg-slate-950 dark:border-slate-100/10 dark:hover:bg-slate-100/[0.03] dark:hover:border-slate-100/20">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`size-1.5 rounded-full ${dotClass}`} />
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
      </div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
        {usd.format(value)}
      </div>
    </div>
  );
}

export default function CashFlowPage({
  dateRange,
  user,
  openingBalance,
  allIncome,
  bills,
  endingBalance,
  timeline,
}: CashFlowPageProps) {
  const denom = openingBalance + allIncome;
  const billsPct = denom > 0 ? Math.min(100, Math.max(0, (bills / denom) * 100)) : 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Cash Flow
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-white px-3.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-100/10 dark:text-slate-300 dark:hover:bg-slate-100/[0.04]"
          >
            <CalendarIcon />
            {formatRange(dateRange.start, dateRange.end)}
          </button>
          <ThemeButton />
          <button
            type="button"
            aria-label="Insights"
            className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-100/[0.06]"
          >
            <SparkIcon />
          </button>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-[12px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
            >
              {user.initials}
            </span>
            <span className="text-[12px] text-slate-700 dark:text-slate-300">{user.name}</span>
            <ChevronDownIcon />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Opening balance" dotClass="bg-slate-300" value={openingBalance} />
        <KpiCard label="+ All income" dotClass="bg-emerald-500" value={allIncome} />
        <KpiCard label="− Bills" dotClass="bg-red-500" value={bills} />
        <KpiCard label="Ending balance" dotClass="bg-slate-900" value={endingBalance} />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-900/[0.06] bg-white p-5 dark:bg-slate-950 dark:border-slate-100/10">
        <div className="flex items-center gap-3">
          <span className="min-w-[110px] text-[12px] font-medium text-slate-500">All income</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-100/10">
            <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
          </div>
          <span className="min-w-[80px] text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {usd.format(allIncome)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-[110px] text-[12px] font-medium text-slate-500">Bills</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-100/10">
            <div className="h-full bg-red-500" style={{ width: `${billsPct}%` }} />
          </div>
          <span className="min-w-[80px] text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {usd.format(bills)}
          </span>
        </div>
      </div>

      <CashFlowTimeline days={timeline} />
    </div>
  );
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

export const sampleCashFlowProps: CashFlowPageProps = {
  dateRange: { start: utcDate(2026, 4, 11), end: utcDate(2026, 4, 31) },
  user: { name: 'Nethelbert Blasse', initials: 'NB' },
  openingBalance: 977.79,
  allIncome: 6906.25,
  bills: 4095.49,
  endingBalance: 3788.55,
  timeline: [
    {
      date: utcDate(2026, 4, 11),
      income: { amount: 977.79, label: 'Opening balance' },
      items: [
        { label: 'Groceries', amount: -200, kind: 'bill' },
        { label: 'Gas and oil', amount: -60, kind: 'variable' },
        { label: 'Toll', amount: -40, kind: 'variable' },
        { label: 'Quicksilver-Telly', amount: -50, kind: 'variable' },
        { label: 'Subscription', amount: -258, kind: 'variable' },
      ],
      runningBalance: 369.79,
    },
    {
      date: utcDate(2026, 4, 12),
      isToday: true,
      items: [{ label: 'Extra spendings', amount: -200, kind: 'variable' }],
      runningBalance: 169.79,
    },
    {
      date: utcDate(2026, 4, 15),
      income: { amount: 4000, label: 'Take 2' },
      items: [],
      runningBalance: 4169.79,
    },
    {
      date: utcDate(2026, 4, 18),
      income: { amount: 800, label: 'Side gig' },
      items: [{ label: 'Health insurance', amount: -300, kind: 'bill' }],
      runningBalance: 4669.79,
    },
    {
      date: utcDate(2026, 4, 22),
      items: [
        { label: 'Internet', amount: -450, kind: 'bill' },
        { label: 'Streaming', amount: -120, kind: 'variable' },
      ],
      runningBalance: 4099.79,
    },
    {
      date: utcDate(2026, 4, 25),
      income: { amount: 2106.25, label: 'Take 3' },
      items: [{ label: 'Dining out', amount: -200, kind: 'variable' }],
      runningBalance: 6006.04,
    },
    {
      date: utcDate(2026, 4, 28),
      items: [
        { label: 'Rent', amount: -1800, kind: 'bill' },
        { label: 'Utilities', amount: -417.49, kind: 'bill' },
      ],
      runningBalance: 3788.55,
    },
  ],
};
