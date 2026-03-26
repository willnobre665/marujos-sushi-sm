import { cn } from '@/utils/cn'
import type { TagProduto } from '@/types/product'

type BadgeVariant = 'gold' | 'green' | 'red' | 'gray' | 'blue'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  gold: 'bg-gold/15 text-gold border border-gold/20',
  green: 'bg-success/15 text-success border border-success/20',
  red: 'bg-danger/15 text-danger border border-danger/20',
  gray: 'bg-white/5 text-ivory/60 border border-white/10',
  blue: 'bg-info/15 text-info border border-info/20',
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-medium tracking-wide uppercase',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// Mapa de tag → variante e label em português
const tagConfig: Record<TagProduto, { label: string; variant: BadgeVariant }> = {
  popular: { label: 'Popular', variant: 'gold' },
  novo: { label: 'Novo', variant: 'blue' },
  vegano: { label: 'Vegano', variant: 'green' },
  vegetariano: { label: 'Vegetariano', variant: 'green' },
  picante: { label: 'Picante', variant: 'red' },
  'sem-gluten': { label: 'Sem Glúten', variant: 'green' },
  promocao: { label: 'Promoção', variant: 'red' },
  'destaque-chef': { label: 'Chef', variant: 'gold' },
}

interface TagBadgeProps {
  tag: TagProduto
  className?: string
}

export function TagBadge({ tag, className }: TagBadgeProps) {
  const { label, variant } = tagConfig[tag]
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
