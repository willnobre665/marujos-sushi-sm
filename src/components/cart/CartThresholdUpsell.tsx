'use client'

import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'
import { UPSELL_SOBREMESA } from '@/data/upsellItems'

// Threshold em centavos — R$ 80
const THRESHOLD = 8000

function IconArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M2.5 7l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CartThresholdUpsell() {
  const total = useCartStore((s) => s.total)
  const totalAtual = total()

  const faltam = Math.max(0, THRESHOLD - totalAtual)
  const progresso = Math.min(100, Math.round((totalAtual / THRESHOLD) * 100))
  const desbloqueado = totalAtual >= THRESHOLD

  return (
    <div
      className="rounded-2xl px-4 pt-4 pb-4 mb-1"
      style={{
        backgroundColor: desbloqueado ? 'rgba(201,168,76,0.06)' : '#141414',
        border: desbloqueado
          ? '1px solid rgba(201,168,76,0.30)'
          : '1px solid rgba(255,255,255,0.07)',
        transition: 'border-color 0.4s ease, background-color 0.4s ease',
      }}
    >
      {desbloqueado ? (
        /* ── Unlocked state ─────────────────────────────────────────────── */
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(201,168,76,0.20)', color: '#C9A84C' }}
              >
                <IconCheck />
              </div>
              <p
                className="font-sans font-semibold"
                style={{ fontSize: '13px', color: '#C9A84C' }}
              >
                Você desbloqueou uma sobremesa 🍡
              </p>
            </div>
            <p
              className="font-sans ml-7"
              style={{ fontSize: '11px', color: 'rgba(245,240,232,0.40)' }}
            >
              {UPSELL_SOBREMESA.nome} · {formatarPreco(UPSELL_SOBREMESA.preco)}
            </p>
          </div>

          <Link
            href={`/cardapio/sobremesas/${UPSELL_SOBREMESA.slug}`}
            className="flex-shrink-0 flex items-center gap-1.5 font-sans font-semibold rounded-xl px-3.5 py-2 transition-all duration-150 active:scale-95"
            style={{
              fontSize: '11px',
              backgroundColor: '#C9A84C',
              color: '#0A0A0A',
              whiteSpace: 'nowrap',
            }}
          >
            Adicionar
            <IconArrowRight />
          </Link>
        </div>
      ) : (
        /* ── Progress state ──────────────────────────────────────────────── */
        <>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p
                className="font-sans leading-snug"
                style={{ fontSize: '12.5px', color: 'rgba(245,240,232,0.70)' }}
              >
                Faltam{' '}
                <span className="font-semibold" style={{ color: 'rgba(245,240,232,0.90)' }}>
                  {formatarPreco(faltam)}
                </span>{' '}
                para liberar uma sobremesa 🍡
              </p>
              <p
                className="font-sans mt-0.5"
                style={{ fontSize: '11px', color: 'rgba(245,240,232,0.30)' }}
              >
                {UPSELL_SOBREMESA.nome}
              </p>
            </div>

            <Link
              href="/cardapio/sobremesas"
              className="flex-shrink-0 flex items-center gap-1.5 font-sans font-semibold rounded-xl px-3.5 py-2 transition-all duration-150 active:scale-95"
              style={{
                fontSize: '11px',
                backgroundColor: 'rgba(201,168,76,0.13)',
                border: '1px solid rgba(201,168,76,0.28)',
                color: '#C9A84C',
                whiteSpace: 'nowrap',
              }}
            >
              Ver sobremesas
              <IconArrowRight />
            </Link>
          </div>

          {/* Progress bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.07)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progresso}%`,
                background: 'linear-gradient(to right, rgba(201,168,76,0.45), #C9A84C)',
              }}
            />
          </div>

          {/* Percentage label — subtle, right-aligned */}
          <p
            className="font-sans text-right mt-1.5"
            style={{ fontSize: '10px', color: 'rgba(245,240,232,0.20)' }}
          >
            {progresso}%
          </p>
        </>
      )}
    </div>
  )
}
