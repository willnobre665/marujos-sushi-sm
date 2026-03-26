'use client'

import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { PageTransition } from '@/components/layout/PageTransition'
import { CheckoutResumo } from '@/components/checkout/CheckoutResumo'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CheckoutPage() {
  const hasHydrated = useCartStore((s) => s._hasHydrated)
  const total = useCartStore((s) => s.total)
  const itens = useCartStore((s) => s.itens)

  if (!hasHydrated || itens.length === 0) {
    return (
      <PageTransition>
        <main className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-5">
          <span style={{ fontSize: '48px', lineHeight: 1 }}>🍱</span>
          <p className="font-sans text-center" style={{ fontSize: '15px', color: 'rgba(245,240,232,0.50)' }}>
            Seu carrinho está vazio.
          </p>
          <Link
            href="/cardapio"
            className="font-sans font-bold rounded-2xl px-6 py-3.5"
            style={{ fontSize: '14px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
          >
            Ver cardápio
          </Link>
        </main>
      </PageTransition>
    )
  }

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
            href="/carrinho"
            className="flex items-center gap-1.5 text-ivory/50 hover:text-ivory/80 transition-colors"
          >
            <IconArrowLeft />
            <span className="font-sans" style={{ fontSize: '13px' }}>Carrinho</span>
          </Link>

          <h1 className="font-display text-ivory font-semibold" style={{ fontSize: '17px' }}>
            Finalizar Pedido
          </h1>

          <div className="w-16" />
        </div>

        {/* Order summary */}
        <CheckoutResumo />

        {/* Form: address + payment + CTA */}
        <CheckoutForm total={total()} />

      </main>
    </PageTransition>
  )
}
