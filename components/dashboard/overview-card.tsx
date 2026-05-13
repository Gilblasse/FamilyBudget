'use client';

import type { ReactNode } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function OverviewCard({
  title,
  trailing,
  className,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-card p-3 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)] sm:p-5',
        'max-[360px]:min-w-[80%] max-[360px]:snap-start',
        className,
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2 sm:mb-4">
        <h2 className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</h2>
        {trailing}
      </header>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function formatDollar(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${formatted}`;
}

function CountUpDollar({ amount }: { amount: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() => amount);
  const mv = useMotionValue(amount);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(mv, amount, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [amount, mv, reduce]);
  if (reduce) return <span>{formatDollar(amount)}</span>;
  return <span>{formatDollar(display)}</span>;
}

export function HeroAmount({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'money min-w-0 truncate font-semibold tracking-tight',
        'text-[clamp(1rem,4vw,2.25rem)] sm:text-[clamp(1.5rem,3vw,3rem)]',
        className,
      )}
    >
      <CountUpDollar amount={amount} />
    </div>
  );
}
