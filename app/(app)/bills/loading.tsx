import { BudgetTableSkeleton } from '@/components/budget/skeletons';

export default function Loading() {
  return <BudgetTableSkeleton kpis={3} rows={8} />;
}
