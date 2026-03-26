'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Star icon ────────────────────────────────────────────────────────────────

function Star({ filled, hovered }: { filled: boolean; hovered: boolean }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill={filled ? '#C9A84C' : 'none'}
      aria-hidden
      style={{
        stroke: filled || hovered ? '#C9A84C' : 'rgba(245,240,232,0.20)',
        strokeWidth: 1.5,
        transition: 'all 0.15s ease',
        filter: filled ? 'drop-shadow(0 0 6px rgba(201,168,76,0.45))' : 'none',
        transform: filled ? 'scale(1.12)' : 'scale(1)',
      }}
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── States ───────────────────────────────────────────────────────────────────

type Step = 'form' | 'success-positive' | 'success-negative'

// ─── Component ────────────────────────────────────────────────────────────────

export function PesquisaForm() {
  const [nota, setNota] = useState<number>(0)
  const [hovered, setHovered] = useState<number>(0)
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<Step>('form')

  const isPositive = nota >= 4

  async function handleSubmit() {
    if (nota === 0) return
    setSubmitting(true)
    // Simula envio (mock) — mesmo padrão do resto do MVP
    await new Promise((r) => setTimeout(r, 600))
    setStep(isPositive ? 'success-positive' : 'success-negative')
    setSubmitting(false)
  }

  // ── Tela de sucesso positivo ────────────────────────────────────────────────
  if (step === 'success-positive') {
    return (
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6 animate-[fadeIn_0.4s_ease-out_both]">
        <span style={{ fontSize: '48px', lineHeight: 1 }}>💛</span>
        <div className="flex flex-col gap-2">
          <h2 className="font-display font-semibold text-ivory" style={{ fontSize: '22px' }}>
            Ficamos felizes que você gostou!
          </h2>
          <p className="font-sans" style={{ fontSize: '14px', color: 'rgba(245,240,232,0.55)', lineHeight: 1.6 }}>
            Se puder, nos avalie no Google — ajuda muito outros clientes a nos encontrarem.
          </p>
        </div>
        <a
          href="https://www.google.com/search?q=Marujos+Sushi+avalia%C3%A7%C3%B5es"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center rounded-2xl py-4 font-sans font-bold active:scale-[0.98] transition-transform duration-150"
          style={{
            fontSize: '15px',
            backgroundColor: '#C9A84C',
            color: '#0A0A0A',
            boxShadow: '0 8px 32px rgba(201,168,76,0.25)',
          }}
        >
          Avaliar no Google ↗
        </a>
        <Link
          href="/"
          className="font-sans"
          style={{ fontSize: '13px', color: 'rgba(245,240,232,0.35)' }}
        >
          Voltar ao início
        </Link>
      </div>
    )
  }

  // ── Tela de sucesso negativo ────────────────────────────────────────────────
  if (step === 'success-negative') {
    return (
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6 animate-[fadeIn_0.4s_ease-out_both]">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: '72px',
            height: '72px',
            backgroundColor: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.20)',
          }}
        >
          <span style={{ fontSize: '32px', lineHeight: 1 }}>🙏</span>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display font-semibold text-ivory" style={{ fontSize: '22px' }}>
            Obrigado pelo feedback.
          </h2>
          <p className="font-sans" style={{ fontSize: '14px', color: 'rgba(245,240,232,0.55)', lineHeight: 1.6 }}>
            Vamos melhorar isso. Cada detalhe importa para nós.
          </p>
        </div>
        <Link
          href="/"
          className="w-full flex items-center justify-center rounded-2xl py-4 font-sans font-semibold active:scale-[0.98] transition-transform duration-150"
          style={{
            fontSize: '15px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'rgba(245,240,232,0.65)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          Voltar ao início
        </Link>
      </div>
    )
  }

  // ── Formulário ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out_both]">

      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <div
          className="flex items-center justify-center rounded-full mb-1"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.20)',
          }}
        >
          <span style={{ fontSize: '26px', lineHeight: 1 }}>⭐</span>
        </div>
        <h1 className="font-display font-semibold text-ivory" style={{ fontSize: '22px', lineHeight: 1.2 }}>
          Como foi sua experiência hoje?
        </h1>
        <p className="font-sans" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.45)', lineHeight: 1.6 }}>
          Leva menos de 30 segundos. Sua opinião ajuda a gente a melhorar cada detalhe.
        </p>
      </div>

      {/* Estrelas */}
      <div
        className="flex flex-col items-center gap-3 rounded-2xl py-5 px-4"
        style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="font-sans uppercase tracking-widest" style={{ fontSize: '9px', color: 'rgba(245,240,232,0.35)' }}>
          Sua nota
        </p>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              className="active:scale-90 transition-transform duration-100"
            >
              <Star filled={n <= nota} hovered={n <= hovered && hovered > nota} />
            </button>
          ))}
        </div>
        {nota > 0 && (
          <p
            className="font-sans animate-[fadeIn_0.2s_ease-out_both]"
            style={{ fontSize: '11px', color: 'rgba(201,168,76,0.70)' }}
          >
            {nota === 5 && 'Excelente! Adoramos ouvir isso. 🎉'}
            {nota === 4 && 'Ótimo! Obrigado pela avaliação.'}
            {nota === 3 && 'Razoável. Queremos fazer melhor.'}
            {nota === 2 && 'Que pena. Vamos melhorar.'}
            {nota === 1 && 'Sentimos muito. Seu feedback é importante.'}
          </p>
        )}
      </div>

      {/* Pergunta condicional + textarea */}
      {nota > 0 && (
        <div className="flex flex-col gap-3 animate-[slideUp_0.3s_ease-out_both]">
          <p className="font-sans font-medium" style={{ fontSize: '14px', color: 'rgba(245,240,232,0.85)' }}>
            {isPositive ? 'O que você mais gostou?' : 'O que podemos melhorar?'}
          </p>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Escreva aqui (opcional)"
            rows={3}
            className="w-full rounded-xl px-4 py-3 font-sans resize-none outline-none"
            style={{
              fontSize: '14px',
              backgroundColor: '#141414',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(245,240,232,0.85)',
              caretColor: '#C9A84C',
              lineHeight: 1.6,
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.40)' }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.09)' }}
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={nota === 0 || submitting}
        className="w-full flex items-center justify-center rounded-2xl py-4 font-sans font-bold active:scale-[0.98] transition-all duration-150"
        style={{
          fontSize: '15px',
          backgroundColor: nota === 0 ? 'rgba(201,168,76,0.25)' : '#C9A84C',
          color: nota === 0 ? 'rgba(10,10,10,0.40)' : '#0A0A0A',
          boxShadow: nota > 0 ? '0 8px 32px rgba(201,168,76,0.22)' : 'none',
          cursor: nota === 0 ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {submitting ? 'Enviando...' : 'Enviar avaliação'}
      </button>

    </div>
  )
}
