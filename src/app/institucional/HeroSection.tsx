'use client'

import { motion } from 'framer-motion'

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-8 md:px-16 lg:px-24 py-10">
      <a href="/institucional" className="flex flex-col leading-none">
        <span
          className="text-[#F5F0E8] text-[11px] tracking-[0.55em] uppercase font-medium"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Marujos
        </span>
        <span
          className="text-[#C9A84C] text-[9px] tracking-[0.45em] uppercase mt-[3px] opacity-70"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Sushi
        </span>
      </a>

      <div className="hidden md:flex items-center gap-10">
        {[
          { label: 'Sobre',      href: '#sobre'    },
          { label: 'O cardápio', href: '#cardapio' },
          { label: 'Unidades',   href: '#unidades' },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="text-[#aaa] text-[11px] tracking-[0.3em] uppercase hover:text-[#F5F0E8] transition-colors duration-300"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {label}
          </a>
        ))}
        <a
          href="#unidades"
          className="text-[#C9A84C] text-[11px] tracking-[0.3em] uppercase border-b border-[#C9A84C44] pb-px hover:border-[#C9A84C] transition-colors duration-300"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Pedir agora
        </a>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const ease = [0.16, 1, 0.3, 1] as const

export function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-end overflow-hidden"
      style={{ backgroundColor: '#0a0a0a' }}
    >

      {/* HERO VIDEO */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      >
        <source src="/videos/hero.mp4.mov" type="video/mp4" />
      </video>

      {/* Dark gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.85))',
        }}
      />

      <Nav />

      {/* Hero content */}
      <div style={{ position: 'relative', zIndex: 10, padding: 'clamp(2rem, 4vw, 6rem)', paddingBottom: 'clamp(5rem, 8vw, 9rem)' }}>

        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease, delay: 0.15 }}
        >
          <div style={{ width: 24, height: 1, backgroundColor: '#C9A84C' }} />
          <span
            style={{ fontFamily: 'Inter, sans-serif', color: '#C9A84C', fontSize: 10, letterSpacing: '0.5em', textTransform: 'uppercase' }}
          >
            Gastronomia Japonesa · Rio Grande do Sul
          </span>
        </motion.div>

        <motion.h1
          className="hero-headline"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 0.94,
            color: '#F5F0E8',
            marginBottom: '3rem',
            textShadow: '0 4px 80px rgba(0,0,0,0.9), 0 2px 20px rgba(0,0,0,0.7)',
          }}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.3, ease, delay: 0.28 }}
        >
          Não é só sushi.<br />
          <em style={{ fontStyle: 'normal', color: '#C9A84C' }}>É o Marujos.</em>
        </motion.h1>

        <motion.div
          style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'flex-end' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease, delay: 0.48 }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              color: '#bbb',
              fontSize: 17,
              lineHeight: 1.75,
              maxWidth: 340,
              textShadow: '0 1px 20px rgba(0,0,0,0.6)',
            }}
          >
            Aqui não tem atalho.<br />
            Tem prática, respeito e constância.
          </p>

          <a
            href="#sobre"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}
          >
            <span
              style={{
                width: 40, height: 40,
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#C9A84C', fontSize: 12,
              }}
            >↓</span>
            <span
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', color: '#888' }}
            >
              Conheça
            </span>
          </a>
        </motion.div>
      </div>

      {/* Mobile font size — scoped style tag */}
      <style>{`
        .hero-headline {
          font-size: clamp(38px, 9vw, 118px);
        }
        @media (min-width: 768px) {
          .hero-headline {
            font-size: clamp(52px, 9vw, 118px);
          }
        }
      `}</style>

    </section>
  )
}
