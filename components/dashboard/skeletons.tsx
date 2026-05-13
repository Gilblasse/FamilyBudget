import { Skeleton } from '@/components/ui/skeleton';

function CardShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-card p-5 shadow-[var(--shadow-sm)] ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function BalanceCardSkeleton() {
  return (
    <CardShell>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-3 w-32" />
      <Skeleton className="h-12 w-56" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      <Skeleton className="mt-auto h-16 w-full" />
    </CardShell>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <CardShell>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-3 w-32" />
      <Skeleton className="h-10 w-40" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </CardShell>
  );
}

export function ChartCardSkeleton() {
  return (
    <CardShell>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className="h-[260px] w-full sm:h-[320px]" />
    </CardShell>
  );
}

export function CoverageSkeleton() {
  return (
    <CardShell>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="size-28 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </CardShell>
  );
}

export function TableCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <CardShell>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
      <div className="md:col-span-12 lg:col-span-8">
        <BalanceCardSkeleton />
      </div>
      <div className="md:col-span-6 lg:col-span-4">
        <CardSkeleton />
      </div>
      <div className="md:col-span-6 lg:col-span-4">
        <CardSkeleton />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <ChartCardSkeleton />
      </div>
      <div className="md:col-span-12 lg:col-span-12">
        <CoverageSkeleton />
      </div>
      <div className="md:col-span-12">
        <TableCardSkeleton />
      </div>
    </div>
  );
}
