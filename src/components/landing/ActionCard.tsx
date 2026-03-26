import Link from 'next/link'
import { cn } from '@/utils/cn'

type ActionVariant = 'primary' | 'secondary' | 'ghost'

interface Props {
  icon?: React.ReactNode
  label: string
  description?: string
  href: string
  isExternal?: boolean
  variant?: ActionVariant
  className?: string
}

export function ActionCard({
  icon,
  label,
  description,
  href,
  isExternal,
  variant = 'secondary',
  className,
}: Props) {
  const inner = (
    <div
      className={cn(
        'relative flex items-center gap-4 overflow-hidden',
        'px-5 py-4 rounded-2xl border',
        'transition-all duration-200 active:scale-[0.97]',

        variant === 'primary' && 'border-gold/35 bg-surface-elevated shadow-gold-sm',
        variant === 'secondary' && 'border-border bg-surface hover:bg-surface-elevated',
        variant === 'ghost' && 'border-border/40 bg-transparent hover:bg-surface/50',
        className
      )}
    >
      {/* Linha dourada superior — apenas no primary */}
      {variant === 'primary' && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      )}

      {/* Ícone */}
      {icon && (
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            variant === 'primary' && 'bg-gold/15 text-gold border border-gold/20',
            variant === 'secondary' && 'bg-surface-elevated text-gold/70 border border-border',
            variant === 'ghost' && 'bg-surface text-ivory/30 border border-border/40',
          )}
        >
          {icon}
        </div>
      )}

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-sans font-medium leading-tight',
            variant === 'primary' && 'text-ivory text-[14px]',
            variant === 'secondary' && 'text-ivory text-[13px]',
            variant === 'ghost' && 'text-ivory/40 text-[12px]',
          )}
        >
          {label}
        </p>
        {description && (
          <p
            className={cn(
              'font-sans mt-0.5 leading-snug',
              variant === 'primary' && 'text-ivory/35 text-[11px]',
              variant === 'secondary' && 'text-ivory/30 text-[11px]',
              variant === 'ghost' && 'text-ivory/20 text-[10px]',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {/* Seta */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className={cn(
          'flex-shrink-0',
          variant === 'primary' && 'text-gold/60',
          variant === 'secondary' && 'text-ivory/20',
          variant === 'ghost' && 'text-ivory/15',
        )}
        aria-hidden
      >
        <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    )
  }

  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  )
}
