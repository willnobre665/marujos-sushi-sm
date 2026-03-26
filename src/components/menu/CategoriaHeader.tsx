'use client'

import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'

interface Props {
  nomeCategoria: string
  descricao?: string
  mesa?: string
}

function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M12.5 5L7.5 10l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3 6h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CategoriaHeader({ nomeCategoria, descricao, mesa }: Props) {
  const hasHydrated = useCartStore((s) => s._hasHydrated)
  const quantidadeTotal = useCartStore((s) => s.quantidadeTotal)
  // Only read qtd after hydration — pre-hydration value is always 0 to match SSR
  const qtd = hasHydrated ? quantidadeTotal() : 0

  return (
    <header
      className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}
    >
      <div className="flex items-center justify-between px-4">
        {/* Voltar ao cardápio */}
        <Link
          href="/cardapio"
          className="flex items-center gap-1 text-ivory/50 hover:text-ivory/80 transition-colors"
          aria-label="Voltar ao cardápio"
        >
          <IconChevronLeft />
          <span className="font-sans text-[12px]">Cardápio</span>
        </Link>

        {/* Título central */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <p className="font-display text-ivory font-semibold" style={{ fontSize: '15px' }}>
            {nomeCategoria}
          </p>
          {mesa && (
            <p className="text-gold/60 font-sans" style={{ fontSize: '10px' }}>
              Mesa {mesa}
            </p>
          )}
        </div>

        {/* Carrinho — ícone secundário com badge de contagem */}
        <Link
          href="/carrinho"
          className="relative flex items-center justify-center w-9 h-9 rounded-xl border bg-surface text-ivory/50 hover:text-ivory/80 hover:border-border transition-colors"
          style={{ borderColor: qtd > 0 ? 'rgba(201,168,76,0.35)' : 'rgba(42,42,42,0.6)' }}
          aria-label={qtd > 0 ? `Ver carrinho — ${qtd} ${qtd === 1 ? 'item' : 'itens'}` : 'Ver carrinho'}
        >
          <IconCart />
          {qtd > 0 && (
            <span
              className="absolute flex items-center justify-center font-sans font-bold"
              style={{
                top: '-5px',
                right: '-5px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '99px',
                backgroundColor: '#C9A84C',
                color: '#0A0A0A',
                fontSize: '9px',
                paddingInline: '3px',
                lineHeight: 1,
              }}
            >
              {qtd > 9 ? '9+' : qtd}
            </span>
          )}
        </Link>
      </div>

      {/* Descrição da categoria — abaixo da barra, só se houver */}
      {descricao && (
        <p
          className="text-ivory/30 font-sans px-4 mt-1.5"
          style={{ fontSize: '10px' }}
        >
          {descricao}
        </p>
      )}
    </header>
  )
}
