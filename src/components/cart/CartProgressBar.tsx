'use client'

import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'

// Target em centavos — R$ 120 (ticket médio ideal do restaurante)
const TARGET = 12000

export function CartProgressBar() {
  const total = useCartStore((s) => s.total)

  const totalAtual = total()
  const completed  = totalAtual >= TARGET

  // Progress clamped 0–100. Calculation:
  //   progresso = (totalAtual / TARGET) * 100, clipped at 100
  // This gives a linear fill: R$60 = 50%, R$120 = 100%.
  const progresso = Math.min(100, Math.round((totalAtual / TARGET) * 100))
  const faltam    = TARGET - totalAtual

  return (
    <div
      className="mx-5 mb-3 rounded-2xl px-4 pt-3.5 pb-4"
      style={{
        backgroundColor: '#141414',
        border: completed
          ? '1px solid rgba(201,168,76,0.22)'
          : '1px solid rgba(255,255,255,0.07)',
        transition: 'border-color 0.4s ease',
      }}
    >
      {/* Message row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p
          className="font-sans leading-snug flex-1 min-w-0"
          style={{
            fontSize: '12px',
            color: completed ? 'rgba(201,168,76,0.90)' : 'rgba(245,240,232,0.65)',
            transition: 'color 0.4s ease',
          }}
        >
          {completed ? (
            'Pedido completo — ótima escolha 🍣'
          ) : (
            <>
              Faltam{' '}
              <span className="font-semibold" style={{ color: 'rgba(245,240,232,0.90)' }}>
                {formatarPreco(faltam)}
              </span>{' '}
              para uma experiência completa 🍣
            </>
          )}
        </p>

        {/* Percentage label — muted, right side */}
        <span
          className="font-sans flex-shrink-0"
          style={{
            fontSize: '11px',
            color: completed ? 'rgba(201,168,76,0.55)' : 'rgba(245,240,232,0.22)',
            transition: 'color 0.4s ease',
          }}
        >
          {progresso}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.07)' }}
        role="progressbar"
        aria-valuenow={progresso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do pedido"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progresso}%`,
            background: completed
              ? 'linear-gradient(to right, #C9A84C, #e8c96a)'
              : 'linear-gradient(to right, rgba(201,168,76,0.45), #C9A84C)',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}
