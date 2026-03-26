'use client'

import { useState } from 'react'
import { cn } from '@/utils/cn'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9' }

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className={cn('flex gap-1', className)} role="group" aria-label="Avaliação em estrelas">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(0)}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
            className={cn(
              'transition-transform duration-100',
              !readOnly && 'hover:scale-110 cursor-pointer',
              readOnly && 'cursor-default'
            )}
          >
            <svg
              className={cn(sizeClasses[size])}
              viewBox="0 0 24 24"
              fill={active ? '#C9A84C' : 'none'}
              stroke={active ? '#C9A84C' : '#444444'}
              strokeWidth="1.5"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
