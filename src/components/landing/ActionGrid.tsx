import Link from 'next/link'

interface Props {
  whatsapp?: string
  mesa?: string
}

// ─── Ícones ─────────────────────────────────────────────────────────────────

function IconWhatsapp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.52 3.66 1.426 5.18L2 22l4.95-1.302A9.963 9.963 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10c.2 1 1 3 3 4s3.5.8 4 .5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconFeedback() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Seta inline ─────────────────────────────────────────────────────────────

function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden>
      <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export function ActionGrid({ whatsapp, mesa }: Props) {
  const waBase = whatsapp ? `https://wa.me/${whatsapp}` : 'https://wa.me'
  const msgGarcom = encodeURIComponent(
    mesa
      ? `Olá! Estou na mesa ${mesa} e gostaria de atendimento.`
      : 'Olá! Gostaria de atendimento no Marujos Sushi.'
  )

  return (
    <section className="px-5 flex flex-col gap-3">

      {/* ── CTA Principal: Ver Cardápio ────────────────────────────────── */}
      <Link href="/cardapio" className="block active:scale-[0.985] transition-transform duration-150">
        <div className="relative rounded-2xl border border-gold/25 bg-surface-elevated overflow-hidden p-6">

          {/* Linha dourada superior */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />

          {/* Halo de fundo */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-40px',
              right: '-20px',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />

          {/* Label superior — sinal de disponibilidade aumenta urgência */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
            <p
              className="text-gold/45 font-sans uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.45em' }}
            >
              Disponível agora
            </p>
          </div>

          {/* Título */}
          <h2 className="font-display text-[1.9rem] text-ivory font-semibold leading-[1.05] tracking-[-0.01em]">
            Ver o Cardápio
          </h2>

          {/* Descrição — ação direta, remove fricção */}
          <p className="text-ivory/30 font-sans mt-2 text-[12px] leading-snug">
            Escolha seu combo.
            <br />
            Monte seu pedido em segundos.
          </p>

          {/* Rodapé — CTA como botão preenchido */}
          <div className="mt-5 flex items-center justify-center gap-2 bg-gold/[0.13] rounded-xl py-3.5 border border-gold/25">
            <span
              className="text-gold font-sans font-semibold tracking-wide"
              style={{ fontSize: '14px' }}
            >
              Ver Cardápio
            </span>
            <ArrowRight className="text-gold/70" />
          </div>
        </div>
      </Link>

      {/* ── Ações secundárias como lista premium ──────────────────────── */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border/60">

        {/* WhatsApp */}
        <a
          href={`${waBase}?text=${msgGarcom}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 px-5 py-4 hover:bg-surface-elevated active:bg-surface-hover transition-colors duration-150"
        >
          <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-gold/70 flex-shrink-0">
            <IconWhatsapp />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ivory text-[13px] font-medium font-sans leading-tight">
              Fale conosco no WhatsApp
            </p>
            <p className="text-ivory/30 text-[11px] font-sans mt-0.5">
              Atendimento rápido
            </p>
          </div>
          <ArrowRight className="text-ivory/20 flex-shrink-0" />
        </a>

        {/* Avalie no Google */}
        <a
          href="https://www.google.com/search?q=Marujos+Sushi+avalia%C3%A7%C3%B5es"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 px-5 py-4 hover:bg-surface-elevated active:bg-surface-hover transition-colors duration-150"
        >
          <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-gold/60 flex-shrink-0">
            <IconStar />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ivory text-[13px] font-medium font-sans leading-tight">
              Avalie no Google
            </p>
            <p className="text-ivory/30 text-[11px] font-sans mt-0.5">
              Sua opinião fortalece o Marujos
            </p>
          </div>
          <ArrowRight className="text-ivory/20 flex-shrink-0" />
        </a>

        {/* Pesquisa de Satisfação */}
        <Link
          href="/pesquisa/nova"
          className="flex items-center gap-4 px-5 py-4 hover:bg-surface-elevated active:bg-surface-hover transition-colors duration-150"
        >
          <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-ivory/40 flex-shrink-0">
            <IconFeedback />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ivory text-[13px] font-medium font-sans leading-tight">
              Pesquisa de Satisfação
            </p>
            <p className="text-ivory/30 text-[11px] font-sans mt-0.5">
              Leva menos de 30 segundos
            </p>
          </div>
          <ArrowRight className="text-ivory/20 flex-shrink-0" />
        </Link>
      </div>
    </section>
  )
}
