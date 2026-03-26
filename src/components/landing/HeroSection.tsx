'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

// ─── Hero background image ────────────────────────────────────────────────────
// To use your own photo: drop it in /public/hero-bg.jpg and change the src below.
// Unsplash is whitelisted in next.config.mjs — no extra config needed for the
// placeholder URL while the real photo isn't ready yet.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1553621042-f6e147245754?w=900&q=80'

interface Props {
  slogan: string
  mesa?: string
  whatsapp?: string
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeroSection({ mesa, whatsapp }: Props) {
  const bgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // rAF-throttled scroll handler — translateY at ~15% of scroll offset.
    // will-change + transform keeps compositing on GPU; no layout thrash.
    let rafId: number
    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (!bgRef.current) return
        const y = window.scrollY * 0.15
        bgRef.current.style.transform = `translateY(${y}px)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  const waBase = whatsapp ? `https://wa.me/${whatsapp}` : 'https://wa.me'
  const waMsg = encodeURIComponent(
    mesa
      ? `Olá! Estou na mesa ${mesa} e gostaria de atendimento.`
      : 'Olá! Gostaria de atendimento no Marujos Sushi.'
  )

  return (
    <section
      className="relative flex flex-col items-center overflow-hidden bg-background"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0rem)', paddingBottom: '0.75rem' }}
    >

      {/* ── Layer 1: foto de fundo (parallax) ───────────────────────────────── */}
      {/* brightness(0.55) escurece sem destruir as cores; blur(2px) suaviza
          texturas muito detalhadas e separa visualmente do conteúdo à frente.
          scale(1.2) dá margem de movimento para o parallax sem expor bordas. */}
      <div
        ref={bgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ willChange: 'transform' }}
        aria-hidden
      >
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            filter: 'brightness(0.55) contrast(0.88) blur(2px)',
            transform: 'scale(1.2)', // margem para parallax + compensação do blur
          }}
        />
      </div>

      {/* ── Layer 2: gradiente escuro direcional ─────────────────────────────── */}
      {/* Mais denso no topo e na base (onde ficam logo e botões),
          ligeiramente aberto no meio para a textura da foto respirar. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.58) 45%, rgba(0,0,0,0.88) 100%)',
        }}
        aria-hidden
      />

      {/* ── Layer 3: brilho dourado radial atrás do conteúdo ─────────────────── */}
      {/* Ancora visualmente o conteúdo ao centro e reforça a identidade gold
          sem competir com a foto. Opacity baixa — é um toque, não um efeito. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 38%, rgba(201,168,76,0.12) 0%, transparent 60%)',
        }}
        aria-hidden
      />

      {/* ── Conteúdo ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full px-5">

        {/* ── Bloco de branding: logo + régua + slogan + autoridade + horários ── */}
        {/* Tudo numa stack coesa com espaçamento interno controlado. O logo PNG  */}
        {/* tem padding interno generoso — margin-top negativa compensa isso.     */}
        <div className="flex flex-col items-center animate-[heroLogo_0.5s_ease-out_both]" style={{ marginTop: '-12px' }}>

          {/* Logo */}
          <Image
            src="/logo.png"
            alt="Marujos Sushi"
            width={500}
            height={500}
            priority
            style={{
              width: 'clamp(240px, 75vw, 300px)',
              height: 'auto',
              objectFit: 'contain',
              mixBlendMode: 'screen',
              filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.15))',
              marginBottom: '-18px', // compensa o padding interno inferior do PNG
            }}
          />

          {/* Régua dourada */}
          <div className="w-[70%] max-w-[200px] h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent animate-[heroFade_0.5s_ease-out_0.15s_both]" />

          {/* Slogan */}
          <p
            className="font-sans font-light text-gold/65 mt-2 uppercase animate-[heroFade_0.5s_ease-out_0.2s_both]"
            style={{ fontSize: '9px', letterSpacing: '0.55em' }}
          >
            The best sushi do interior
          </p>

          {/* Linha de autoridade */}
          <p
            className="font-sans mt-2 animate-[heroFade_0.5s_ease-out_0.25s_both]"
            style={{ fontSize: '12px', color: 'rgba(245,240,232,0.70)', lineHeight: 1.5 }}
          >
            Há mais de 10 anos servindo sushi de verdade.
          </p>

          {/* Horários */}
          <div className="mt-1.5 flex flex-col items-center gap-0.5 animate-[heroFade_0.5s_ease-out_0.3s_both]">
            <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.65)' }}>
              Seg–Sex · 11h30–15h · 18h30–23h
            </p>
            <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.65)' }}>
              Sáb/Feriados · 12h–16h · 18h30–23h
            </p>
            <p className="font-sans" style={{ fontSize: '10px', color: 'rgba(245,240,232,0.65)' }}>
              Dom · 12h–16h
            </p>
          </div>

        </div>

        {/* Mesa badge — contextual, só aparece com QR code */}
        {mesa && (
          <div className="mt-2 flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-surface/50 backdrop-blur-sm">
            <span className="text-ivory/20 font-sans uppercase tracking-widest" style={{ fontSize: '8px' }}>
              Mesa
            </span>
            <span className="text-gold font-sans font-medium" style={{ fontSize: '12px' }}>
              {mesa}
            </span>
          </div>
        )}

        {/* ── CTA Principal ───────────────────────────────────────────────────── */}
        <div className="w-full mt-3 flex flex-col items-center gap-1.5 animate-[heroSlide_0.5s_ease-out_0.4s_both]">
          <Link
            href="/cardapio"
            className="w-full flex items-center justify-center gap-2 rounded-3xl py-5 font-sans font-bold text-lg active:scale-[0.98] transition-transform duration-150 animate-[glow-pulse_2.5s_ease-in-out_infinite]"
            style={{
              backgroundColor: '#C9A84C',
              color: '#0A0A0A',
              boxShadow: '0 10px 40px rgba(201,168,76,0.25)',
            }}
          >
            Ver cardápio completo →
          </Link>
          <p className="font-sans" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.35)', letterSpacing: '0.03em' }}>
            ⚡ Monte seu pedido em segundos
          </p>
        </div>

        {/* ── Ações secundárias ──────────────────────────────────────────────── */}
        <div
          className="w-full mt-2 rounded-2xl overflow-hidden divide-y"
          style={{
            border: '1px solid rgba(255,255,255,0.09)',
            backgroundColor: 'rgba(10,10,10,0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >

          {/* WhatsApp */}
          <a
            href={`${waBase}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-4 py-3.5 active:bg-white/[0.03] transition-colors duration-150"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(201,168,76,0.65)' }}
            >
              <IconWhatsapp />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-sans font-medium" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.90)', lineHeight: 1.3 }}>
                Fale conosco no WhatsApp
              </p>
              <p className="font-sans mt-0.5" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.30)' }}>
                Atendimento rápido
              </p>
            </div>
            <IconArrow />
          </a>

          {/* Google Review */}
          <a
            href="https://www.google.com/search?q=Marujos+Sushi+avalia%C3%A7%C3%B5es"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-4 py-3.5 active:bg-white/[0.03] transition-colors duration-150"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(201,168,76,0.55)' }}
            >
              <IconStar />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-sans font-medium" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.90)', lineHeight: 1.3 }}>
                Avalie no Google
              </p>
              <p className="font-sans mt-0.5" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.30)' }}>
                Sua opinião fortalece o Marujos
              </p>
            </div>
            <IconArrow />
          </a>

          {/* Pesquisa de satisfação */}
          <Link
            href="/pesquisa/nova"
            className="flex items-center gap-4 px-4 py-3.5 active:bg-white/[0.03] transition-colors duration-150"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(245,240,232,0.35)' }}
            >
              <IconFeedback />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-sans font-medium" style={{ fontSize: '13px', color: 'rgba(245,240,232,0.90)', lineHeight: 1.3 }}>
                Pesquisa de satisfação
              </p>
              <p className="font-sans mt-0.5" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.30)' }}>
                Leva menos de 30 segundos
              </p>
            </div>
            <IconArrow />
          </Link>

        </div>
      </div>
    </section>
  )
}
