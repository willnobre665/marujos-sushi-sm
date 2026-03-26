'use client'

import { cn } from '@/utils/cn'

interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantitySelectorProps) {
  const decrement = () => onChange(Math.max(min, value - 1))
  const increment = () => onChange(Math.min(max, value + 1))

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 bg-surface border border-border rounded-xl px-1',
        className
      )}
    >
      <button
        onClick={decrement}
        disabled={value <= min}
        aria-label="Diminuir quantidade"
        className="w-8 h-8 flex items-center justify-center text-ivory/60 hover:text-ivory disabled:opacity-30 transition-colors rounded-lg"
      >
        <MinusIcon />
      </button>

      <span className="w-6 text-center font-semibold text-ivory tabular-nums">{value}</span>

      <button
        onClick={increment}
        disabled={value >= max}
        aria-label="Aumentar quantidade"
        className="w-8 h-8 flex items-center justify-center text-ivory/60 hover:text-ivory disabled:opacity-30 transition-colors rounded-lg"
      >
        <PlusIcon />
      </button>
    </div>
  )
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
