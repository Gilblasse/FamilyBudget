import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-9 w-44 rounded-md" />
    </div>
  );
}
