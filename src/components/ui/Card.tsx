import { cn } from '@/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className, onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-elevated border border-border rounded-2xl overflow-hidden',
        'shadow-card',
        hoverable && 'cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:border-border hover:bg-surface-hover',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
