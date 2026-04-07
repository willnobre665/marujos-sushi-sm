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

  // Promoções — banner section (cat-combos / slug promocoes)
  const promocoes = produtosPorCategoria['promocoes'] ?? []

  // All categories except promocoes — rendered in ordemExibicao order (Mais Pedidos, Combos, ...)
  // combos products come from the `combos` prop passed by page.tsx
  const categoriasRestantes = categorias.filter((c) => c.slug !== 'promocoes')

  return (
    <>
      {/* Chips de navegação por categoria */}
      <CategoryChips
        categorias={categorias}
        ativaSlug={ativaSlug}
        onSelect={handleSelectCategoria}
      />

      {/* 1 — Promoções: banner-style horizontal scroll */}
      <ComboDestaque promocoes={promocoes} />

      {/* Divisor */}
      <div className="mx-4 mt-5 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

      {/* 2 — Mais Pedidos → 3 — Combos → rest, in ordemExibicao order */}
      {categoriasRestantes.map((cat) => {
        // Combos products come from the dedicated prop (cat-combos-novos)
        const produtos = cat.slug === 'combos'
          ? combos
          : (produtosPorCategoria[cat.slug] ?? [])
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
