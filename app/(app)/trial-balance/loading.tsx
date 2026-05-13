import { BudgetTableSkeleton } from '@/components/budget/skeletons';

export default function Loading() {
  return <BudgetTableSkeleton kpis={4} rows={8} />;
}
