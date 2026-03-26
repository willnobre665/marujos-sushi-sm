'use client'

import { useRef } from 'react'
import type { Categoria } from '@/types/product'

interface Props {
  categorias: Categoria[]
  ativaSlug: string
  onSelect: (slug: string) => void
}

export function CategoryChips({ categorias, ativaSlug, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="sticky top-[57px] z-30 bg-background/90 backdrop-blur-md border-b border-border/30">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 px-4 py-3 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categorias.map((cat) => {
          const ativa = cat.slug === ativaSlug
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.slug)}
              className={[
                'flex-shrink-0 px-3.5 py-1.5 rounded-full font-sans transition-all duration-150',
                'text-[11px] font-medium border',
                ativa
                  ? 'bg-gold/15 border-gold/40 text-gold'
                  : 'bg-surface border-border/60 text-ivory/50 hover:text-ivory/80 hover:border-border active:scale-95',
              ].join(' ')}
              style={{ letterSpacing: '0.02em' }}
            >
              {cat.nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}
