import { clsx } from 'clsx';

export const Skeleton = ({ className }) => (
  <div className={clsx('skeleton rounded-lg', className)} />
);

export const ProductCardSkeleton = () => (
  <div className="group relative">
    <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
    <Skeleton className="absolute right-3 top-3 h-8 w-8 rounded-full" />
    <Skeleton className="mt-2 h-4 w-3/4" />
    <div className="mt-1 flex items-center gap-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  </div>
);
