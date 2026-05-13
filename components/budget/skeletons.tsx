import { Skeleton } from '@/components/ui/skeleton';
import { TableCardSkeleton } from '@/components/dashboard/skeletons';

const GRID_CLASSES: Record<number, string> = {
  2: 'grid grid-cols-2 gap-3',
  3: 'grid grid-cols-2 gap-3 sm:grid-cols-3',
  4: 'grid grid-cols-2 gap-3 sm:grid-cols-4',
  5: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5',
};

function StripSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={GRID_CLASSES[count] ?? GRID_CLASSES[3]}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

export function BudgetTableSkeleton({ kpis = 3, rows = 6 }: { kpis?: number; rows?: number }) {
  return (
    <div className="space-y-6">
      <StripSkeleton count={kpis} />
      <Skeleton className="h-4 w-72" />
      <TableCardSkeleton rows={rows} />
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="space-y-6">
      <StripSkeleton count={5} />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <TableCardSkeleton rows={6} />
    </div>
  );
}

export function CashFlowSkeleton() {
  return (
    <div className="space-y-6">
      <StripSkeleton count={4} />
      <Skeleton className="h-[300px] w-full rounded-2xl" />
    </div>
  );
}
