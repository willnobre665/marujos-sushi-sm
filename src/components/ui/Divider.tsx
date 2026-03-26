import { cn } from '@/utils/cn'

interface DividerProps {
  label?: string
  className?: string
}

export function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-ivory/40 font-medium uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    )
  }

  return <div className={cn('h-px bg-border', className)} />
}
