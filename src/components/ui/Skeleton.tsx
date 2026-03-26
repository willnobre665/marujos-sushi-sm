import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton rounded-lg bg-surface-elevated',
        className
      )}
      aria-hidden="true"
    />
  )
}
