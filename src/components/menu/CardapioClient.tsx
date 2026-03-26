'use client'

import { useState, useEffect } from 'react'
import type { Categoria, Produto } from '@/types/product'
import { CategoryChips } from './CategoryChips'
import { ComboDestaque } from './ComboDestaque'
import { CategorySection } from './CategorySection'

interface Props {
  categorias: Categoria[]
  produtosPorCategoria: Record<string, Produto[]>
  combos: Produto[]
}

export function CardapioClient({ categorias, produtosPorCategoria, combos }: Props) {
  const [ativaSlug, setAtivaSlug] = useState(categorias[0]?.slug ?? '')

  // Restore scroll position after returning from product detail page.
  // Two nested rAFs: first frame applies layout, second wins against
  // the browser's own scroll restoration on iOS Safari.
  useEffect(() => {
    try {
      const y = sessionStorage.getItem('restoreScrollY')
      if (y !== null) {
        sessionStorage.removeItem('restoreScrollY')
        const target = parseInt(y, 10)
        if (target > 0) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.scrollTo({ top: target, behavior: 'instant' })
            })
          })
        }
      }
    } catch {
      // sessionStorage unavailable — no scroll restore
    }
  }, [])

  function handleSelectCategoria(slug: string) {
    setAtivaSlug(slug)
    // Scroll suave até a seção correspondente
    const el = document.getElementById(`cat-${slug}`)
    if (el) {
      // Offset: header (≈57px) + chips (≈44px) + margem de respiro (8px)
      const offset = 57 + 44 + 8
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  // Categorias sem combos (combos ficam no destaque separado)
  const categoriasRestantes = categorias.filter((c) => c.slug !== 'combos')

  return (
    <>
      {/* Chips de navegação por categoria */}
      <CategoryChips
        categorias={categorias}
        ativaSlug={ativaSlug}
        onSelect={handleSelectCategoria}
      />

      {/* Destaque de Combos — primeira dobra após os chips */}
      <ComboDestaque combos={combos} />

      {/* Divisor — espaço entre combos e restante do cardápio */}
      <div className="mx-4 mt-5 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

      {/* Blocos de categoria restantes */}
      {categoriasRestantes.map((cat) => {
        const produtos = produtosPorCategoria[cat.slug] ?? []
        return (
          <CategorySection
            key={cat.id}
            categoria={cat}
            produtos={produtos}
            id={`cat-${cat.slug}`}
          />
        )
      })}

      {/* Espaço inferior — altura suficiente para a FloatingCartBar não cobrir conteúdo */}
      <div className="h-28" />
    </>
  )
}
