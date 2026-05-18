'use client';

import CashFlowTimeline, {
  type TimelineDay,
} from './cash-flow-timeline';

export interface CashFlowPageProps {
  openingBalance: number;
  allIncome: number;
  bills: number;
  endingBalance: number;
  timeline: TimelineDay[];
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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
