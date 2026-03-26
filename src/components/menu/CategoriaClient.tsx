'use client'

import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Categoria, Produto } from '@/types/product'
import { ProductCard } from './ProductCard'

interface Props {
  categorias: Categoria[]
  categoriaAtiva: Categoria
  produtos: Produto[]
}

export function CategoriaClient({ categorias, categoriaAtiva, produtos }: Props) {
  const router = useRouter()
  const chipScrollRef = useRef<HTMLDivElement>(null)

  // Restore scroll position after returning from product detail page.
  // Two nested rAFs are required on iOS Safari: the first frame applies layout,
  // the second is when the browser's own scroll restoration has settled and
  // our programmatic scroll wins without being overridden.
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
    router.push(`/cardapio/${slug}`)
  }

  return (
    <>
      {/* ── Chips de categoria ──────────────────────────────────────────── */}
      <div
        className="sticky z-30 bg-background/90 backdrop-blur-md border-b border-border/30"
        style={{ top: 'calc(env(safe-area-inset-top) + 57px)' }}
      >
        <div
          ref={chipScrollRef}
          className="flex items-center gap-2 px-4 py-3 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {categorias.map((cat) => {
            const isAtiva = cat.slug === categoriaAtiva.slug
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategoria(cat.slug)}
                className="flex-shrink-0 font-sans font-medium rounded-full border transition-all duration-150 active:scale-[0.95]"
                style={{
                  fontSize: '12px',
                  padding: '5px 14px',
                  backgroundColor: isAtiva ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                  borderColor: isAtiva ? 'rgba(201,168,76,0.40)' : 'rgba(255,255,255,0.10)',
                  color: isAtiva ? '#C9A84C' : 'rgba(245,240,232,0.45)',
                }}
              >
                {cat.nome}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Lista de produtos ───────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-2 flex flex-col gap-4">
        {produtos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-ivory/20 font-sans text-[13px]">
              Nenhum produto disponível nesta categoria.
            </span>
          </div>
        ) : (
          produtos.map((produto) => (
            <ProductCard key={produto.id} produto={produto} />
          ))
        )}
      </div>

      {/* Espaço inferior — altura suficiente para a FloatingCartBar não cobrir conteúdo */}
      <div className="h-28" />
    </>
  )
}
