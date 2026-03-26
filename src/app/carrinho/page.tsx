'use client'

import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'
import { PageTransition } from '@/components/layout/PageTransition'
import { CartItemList } from '@/components/cart/CartItemList'
import { CartUpsell } from '@/components/cart/CartUpsell'
import { CartProgressBar } from '@/components/cart/CartProgressBar'
import { CartSummary } from '@/components/cart/CartSummary'
import type { Produto } from '@/types/product'

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M3 6.5h7M7 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Popular combos — static mock, will be dynamic with Saipos
const COMBOS_POPULARES: Pick<Produto, 'id' | 'nome' | 'slug' | 'descricaoResumida' | 'preco' | 'precoOriginal' | 'categoriaId'> [] = [
  {
    id: 'prod-combo-executivo',
    nome: 'Combo Executivo',
    slug: 'combo-executivo',
    descricaoResumida: '16 uramakis + 4 niguiris + missoshiru',
    preco: 6990,
    precoOriginal: 8500,
    categoriaId: 'cat-combos',
  },
  {
    id: 'prod-combo-premium',
    nome: 'Combo Premium',
    slug: 'combo-premium',
    descricaoResumida: '24 uramakis + 6 niguiris + 2 temakis + sobremesa',
    preco: 12990,
    precoOriginal: 16000,
    categoriaId: 'cat-combos',
  },
]

function EmptyCart() {
  return (
    <div className="flex-1 flex flex-col px-5 pt-10 pb-8">

      {/* Hero message */}
      <div className="flex flex-col items-center text-center gap-3 mb-8">
        <span style={{ fontSize: '52px', lineHeight: 1 }}>🍱</span>
        <h2 className="font-display text-ivory font-semibold leading-snug" style={{ fontSize: '22px' }}>
          Que tal começar pelos<br />favoritos da casa?
        </h2>
        <p className="font-sans" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.45)' }}>
          Escolha seu combo em segundos.
        </p>
        <Link
          href="/cardapio/combos"
          className="mt-1 flex items-center gap-2 font-sans font-bold rounded-2xl px-6 py-3.5 active:scale-[0.97] transition-transform duration-150"
          style={{ fontSize: '14px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
        >
          Escolher meu pedido
          <IconArrowRight />
        </Link>
      </div>

      {/* Suggestion section */}
      <div>
        <p
          className="font-sans font-semibold mb-3"
          style={{ fontSize: '12px', color: 'rgba(245,240,232,0.40)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          🔥 Mais pedidos hoje
        </p>
        <div className="flex flex-col gap-2.5">
          {COMBOS_POPULARES.map((combo) => (
            <Link
              key={combo.id}
              href={`/cardapio/${combo.categoriaId.replace('cat-', '')}/${combo.slug}`}
              className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 active:scale-[0.985] transition-transform duration-150"
              style={{ backgroundColor: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-sans font-medium text-ivory leading-tight" style={{ fontSize: '14px' }}>
                  {combo.nome}
                </p>
                <p className="font-sans mt-0.5 truncate" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.38)' }}>
                  {combo.descricaoResumida}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-sans font-bold text-gold" style={{ fontSize: '14px' }}>
                  {formatarPreco(combo.preco)}
                </span>
                <span style={{ color: 'rgba(245,240,232,0.25)' }}>
                  <IconArrowRight />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CarrinhoPage() {
  const hasHydrated = useCartStore((s) => s._hasHydrated)
  const itens = useCartStore((s) => s.itens)
  const quantidadeTotal = useCartStore((s) => s.quantidadeTotal)
  const limparCarrinho = useCartStore((s) => s.limparCarrinho)

  // Treat cart as empty until persist has rehydrated from localStorage.
  // Prevents SSR/client mismatch: SSR sees itens=[], client sees real data.
  const isEmpty = !hasHydrated || itens.length === 0

  return (
    <PageTransition>
      <main className="min-h-dvh bg-background flex flex-col">

        {/* Header */}
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-5 bg-background/90 backdrop-blur-md border-b"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 14px)',
            paddingBottom: '14px',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Link
            href="/cardapio"
            className="flex items-center gap-1.5 text-ivory/50 hover:text-ivory/80 transition-colors"
          >
            <IconArrowLeft />
            <span className="font-sans" style={{ fontSize: '13px' }}>Cardápio</span>
          </Link>

          <h1 className="font-display text-ivory font-semibold" style={{ fontSize: '17px' }}>
            Meu Pedido
          </h1>

          {!isEmpty && (
            <button
              onClick={limparCarrinho}
              className="font-sans transition-colors active:opacity-40"
              style={{ fontSize: '12px', color: 'rgba(245,240,232,0.28)' }}
            >
              Limpar
            </button>
          )}
          {isEmpty && <div className="w-12" />}
        </div>

        {/* Conteúdo */}
        {isEmpty ? (
          <EmptyCart />
        ) : (
          <>
            <div className="flex-1 pt-4">
              <div className="px-5">
                <CartItemList />
              </div>
              <CartUpsell />
            </div>

            {/* Rodapé fixo */}
            <div
              className="sticky bottom-0 bg-background border-t"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              <CartProgressBar />
              <CartSummary />

              <div className="px-5 pb-5">
                <p
                  className="font-sans text-center mb-3"
                  style={{ fontSize: '11px', color: 'rgba(245,240,232,0.28)' }}
                >
                  🔒 Pedido seguro • preparo imediato
                </p>
                <Link
                  href="/checkout"
                  className="w-full flex items-center justify-center rounded-2xl py-4 font-sans font-bold active:scale-[0.98] transition-transform duration-150"
                  style={{ fontSize: '15px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
                >
                  Finalizar Pedido · {quantidadeTotal()} {quantidadeTotal() === 1 ? 'item' : 'itens'}
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </PageTransition>
  )
}
