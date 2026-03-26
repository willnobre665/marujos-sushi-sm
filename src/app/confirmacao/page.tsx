'use client'

import Link from 'next/link'
import { PageTransition } from '@/components/layout/PageTransition'

export default function ConfirmacaoPage() {
  return (
    <PageTransition>
      <main className="min-h-dvh bg-background flex flex-col items-center justify-center px-5 text-center gap-6">

        {/* Success icon */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.30)',
          }}
        >
          <span style={{ fontSize: '36px', lineHeight: 1 }}>✅</span>
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2">
          <h1
            className="font-display text-ivory font-semibold"
            style={{ fontSize: '24px' }}
          >
            Pedido recebido!
          </h1>
          <p
            className="font-sans"
            style={{ fontSize: '14px', color: 'rgba(245,240,232,0.50)', maxWidth: '280px', lineHeight: '1.55' }}
          >
            Estamos preparando tudo com cuidado. Você receberá seu pedido em aproximadamente 40 minutos.
          </p>
        </div>

        {/* Delivery info pill */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-5 py-3"
          style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>🛵</span>
          <p className="font-sans font-medium text-ivory" style={{ fontSize: '13px' }}>
            Entrega estimada em ~40 min
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/cardapio"
          className="font-sans font-semibold rounded-2xl px-6 py-3.5 active:scale-[0.97] transition-transform duration-150"
          style={{
            fontSize: '14px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'rgba(245,240,232,0.65)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          Voltar ao cardápio
        </Link>

      </main>
    </PageTransition>
  )
}
