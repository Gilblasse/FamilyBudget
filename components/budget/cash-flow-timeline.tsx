'use client';

import type { CSSProperties } from 'react';
import { toIso } from '@/lib/date-utils';

export type TxnKind = 'bill' | 'variable' | 'income' | 'info';

export interface TimelineTxn {
  label: string;
  amount: number;
  kind?: TxnKind;
}

export interface TimelineDay {
  date: Date;
  income?: { amount: number; label: string };
  items: TimelineTxn[];
  runningBalance: number;
  isToday?: boolean;
}

export interface CashFlowTimelineProps {
  days: TimelineDay[];
  lowBalanceThreshold?: number;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });

const KIND_DOT: Record<TxnKind, string> = {
  bill: 'bg-red-500',
  variable: 'bg-amber-500',
  income: 'bg-emerald-500',
  info: 'bg-sky-500',
};

function nodeColor(day: TimelineDay): string {
  if (day.isToday) return 'bg-sky-500';
  const hasIncome = (day.income?.amount ?? 0) > 0 || day.items.some((it) => it.amount > 0);
  const hasOutflow = day.items.some((it) => it.amount < 0);
  if (hasIncome && hasOutflow) return 'bg-amber-500';
  if (hasIncome) return 'bg-emerald-500';
  if (hasOutflow) return 'bg-red-500';
  return 'bg-slate-400';
}

// Local-time formatter to match `fromIso` upstream in cash-flow.tsx and
// `todayIso` everywhere else. UTC getters here would re-introduce the DST
// drift the deep-dive flagged.
const dayKey = toIso;

export default function CashFlowTimeline({ days, lowBalanceThreshold = 200 }: CashFlowTimelineProps) {
  return (
    <div className="rounded-xl border border-slate-900/[0.06] bg-white p-5 dark:bg-slate-950 dark:border-slate-100/10">
      <style>{`@keyframes awardFadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-[5px] rounded-full bg-emerald-500" />
          <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">Day-by-day Timeline</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-[5px] rounded-full bg-emerald-500" />Income
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-[5px] rounded-full bg-red-500" />Bill
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-[5px] rounded-full bg-amber-500" />Variable
          </span>
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto [scrollbar-width:thin]">
        {days.length === 0 ? (
          <div className="px-2 py-6 text-center text-[12px] text-slate-400">
            No events in this range — add income or bills, or widen the date filter.
          </div>
        ) : null}
        {days.map((day, i) => {
          const key = dayKey(day.date);
          const rowStyle: CSSProperties = {
            animation: 'awardFadeUp 500ms ease-out both',
            animationDelay: `${i * 40}ms`,
          };
          return (
            <div
              key={key}
              className="grid grid-cols-[64px_28px_1fr] gap-3 rounded-lg px-2 py-3 hover:bg-slate-900/[0.02] dark:hover:bg-slate-100/[0.03]"
              style={rowStyle}
            >
              <div className="self-start rounded-lg border border-slate-900/[0.06] bg-slate-50 px-2.5 py-2 text-center tabular-nums dark:bg-slate-900/40 dark:border-slate-100/10">
                <div className="text-[10px] font-medium uppercase text-slate-400">
                  {monthFmt.format(day.date)}
                </div>
                <div className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
                  {dayFmt.format(day.date)}
                </div>
              </div>

              <div className="relative before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-slate-900/10 dark:before:bg-slate-100/10">
                <div className="relative flex justify-center pt-3">
                  <span
                    aria-hidden
                    className={`relative size-1.5 rounded-full ${nodeColor(day)} shadow-[0_0_0_3px_#fff,0_0_0_4px_rgba(15,23,42,0.08)] dark:shadow-[0_0_0_3px_rgb(2_6_23),0_0_0_4px_rgba(241,245,249,0.12)]`}
                  />
                </div>
              </div>

              <div className="min-w-0">
                {day.isToday ? <div className="text-[11px] text-sky-700">Today</div> : null}

                {day.income ? (
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-emerald-700">
                      {usd.format(day.income.amount)}
                    </span>
                    <span className="truncate text-[12px] text-slate-500">{day.income.label}</span>
                  </div>
                ) : null}

                {day.items.length > 0 ? (
                  <div className="mt-1">
                    {day.items.map((it, j) => {
                      const kind: TxnKind = it.kind ?? (it.amount < 0 ? 'bill' : 'income');
                      const amountClass =
                        it.amount < 0 ? 'text-red-700' : 'text-emerald-700';
                      return (
                        <div
                          key={`${j}-${it.label}`}
                          className="grid grid-cols-[14px_1fr_auto] items-center gap-2.5 border-b border-slate-900/[0.04] py-1.5 last:border-0 dark:border-slate-100/[0.06]"
                        >
                          <span
                            aria-hidden
                            className={`justify-self-center size-1.5 rounded-full ${KIND_DOT[kind]}`}
                          />
                          <span className="truncate text-[13px] text-slate-700 dark:text-slate-300">
                            {it.label}
                          </span>
                          <span className={`text-[13px] font-medium tabular-nums ${amountClass}`}>
                            {usd.format(it.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-1.5 text-[11px] text-slate-400">
                  Running balance{' '}
                  <span
                    className={`font-semibold tabular-nums ${
                      day.runningBalance < lowBalanceThreshold
                        ? 'text-red-700'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {usd.format(day.runningBalance)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
