'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { orderService } from '@/services/orderService'
import { formatarPreco } from '@/utils/currency'
import { PageTransition } from '@/components/layout/PageTransition'
import type { Pedido } from '@/types/order'

interface Props {
  params: { pedidoId: string }
}

function IconCheck() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M6 17l7 7 13-13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ConfirmacaoPage({ params }: Props) {
  const [pedido, setPedido] = useState<Pedido | null>(null)

  useEffect(() => {
    orderService.buscarPedido(params.pedidoId).then(setPedido)
  }, [params.pedidoId])

  const numeroPedido = pedido
    ? String(pedido.numeroPedido).padStart(4, '0')
    : '—'

  // Mode is derived from the order itself — no session dependency.
  // The order always carries mesa (restaurant) or endereco (delivery).
  const isRestaurante = Boolean(pedido?.mesa)

  return (
    <PageTransition>
      <main className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center gap-8">

        {/* ── Success icon ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: '88px',
            height: '88px',
            backgroundColor: 'rgba(201,168,76,0.10)',
            border: '1px solid rgba(201,168,76,0.35)',
            color: '#C9A84C',
          }}
        >
          <IconCheck />
        </div>

        {/* ── Copy ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-ivory font-semibold" style={{ fontSize: '26px' }}>
            {isRestaurante ? 'Pedido enviado!' : 'Pedido confirmado!'}
          </h1>
          <p
            className="font-sans"
            style={{ fontSize: '14px', color: 'rgba(245,240,232,0.50)', maxWidth: '300px', lineHeight: '1.6', margin: '0 auto' }}
          >
            {isRestaurante
              ? 'Seu pedido foi recebido e já está indo para a cozinha. Em breve nosso garçom passará na sua mesa.'
              : 'Recebemos seu pedido e ele já entrou em preparação. Em breve entraremos em contato para confirmar a entrega.'
            }
          </p>
        </div>

        {/* ── Order info card ───────────────────────────────────────────────── */}
        <div
          className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header row: number + mesa (restaurant) or number only (delivery) */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className={isRestaurante ? '' : 'w-full'}>
              <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Número do pedido
              </p>
              <p className="font-sans font-bold text-ivory mt-0.5" style={{ fontSize: '18px' }}>
                #{numeroPedido}
              </p>
            </div>

            {isRestaurante && (
              <div className="text-right">
                <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Mesa
                </p>
                <p className="font-sans font-bold text-gold mt-0.5" style={{ fontSize: '18px' }}>
                  {pedido?.mesa ?? '—'}
                </p>
              </div>
            )}
          </div>

          {/* Delivery identification — nome + endereço */}
          {!isRestaurante && pedido && (
            <div
              className="px-5 py-4 border-b flex flex-col gap-2.5"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, paddingTop: '2px' }}>
                  Nome
                </p>
                <p className="font-sans font-medium text-ivory text-right" style={{ fontSize: '13px' }}>
                  {pedido.cliente.nome}
                </p>
              </div>

              {pedido.endereco && (
                <div className="flex items-start justify-between gap-4">
                  <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, paddingTop: '2px' }}>
                    Entrega
                  </p>
                  <p className="font-sans text-right" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.65)', lineHeight: '1.5' }}>
                    {pedido.endereco.logradouro}, {pedido.endereco.numero}
                    {pedido.endereco.bairro ? ` · ${pedido.endereco.bairro}` : ''}
                    {pedido.endereco.referencia ? (
                      <>
                        <br />
                        <span style={{ fontSize: '11px', color: 'rgba(245,240,232,0.35)' }}>
                          {pedido.endereco.referencia}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          {pedido && (
            <div className="flex items-center justify-between px-5 py-4">
              <p className="font-sans" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.50)' }}>
                Total do pedido
              </p>
              <p className="font-sans font-bold text-ivory" style={{ fontSize: '14px' }}>
                {formatarPreco(pedido.total)}
              </p>
            </div>
          )}
        </div>

        {/* ── Status pill ───────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-5 py-3"
          style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.18)' }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>
            {isRestaurante ? '🍣' : '🚚'}
          </span>
          <p className="font-sans font-medium" style={{ fontSize: '13px', color: 'rgba(201,168,76,0.85)' }}>
            {isRestaurante
              ? 'Em preparo — o garçom trará em instantes'
              : 'Em preparo — entrega após confirmação'
            }
          </p>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <Link
          href="/cardapio"
          className="font-sans font-semibold rounded-2xl px-7 py-3.5 active:scale-[0.97] transition-transform duration-150"
          style={{
            fontSize: '14px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'rgba(245,240,232,0.60)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          Voltar ao cardápio
        </Link>

      </main>
    </PageTransition>
  )
}
