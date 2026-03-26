import { cn } from '@/utils/cn'

interface ProgressBarProps {
  value: number    // 0 a 1
  className?: string
  color?: 'gold' | 'green'
}

export function ProgressBar({ value, className, color = 'gold' }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, value * 100))

  return (
    <div className={cn('h-1.5 bg-surface rounded-full overflow-hidden', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          color === 'gold' ? 'bg-gradient-gold' : 'bg-success'
        )}
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}
