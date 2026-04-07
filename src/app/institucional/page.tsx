import type { Metadata } from 'next'
import { HeroSection } from './HeroSection'
import { StoryVideo } from './StoryVideo'
import { UnitCards } from './UnitCards'

export const metadata: Metadata = {
  title: 'Marujos Sushi — Gastronomia japonesa no Rio Grande do Sul',
  description: 'Sushi artesanal em Caçapava do Sul e Santa Maria. Técnica, frescor e cuidado em cada peça.',
}

// ─── Units — single source of truth ─────────────────────────────────────────

const UNITS = [
  {
    city: 'Caçapava do Sul',
    state: 'RS',
    hours: 'Ter – Dom  ·  18h – 23h',
    note: 'Loja física + delivery',
    whatsapp: 'https://wa.me/5555999999991',
    instagram: 'https://instagram.com/marujos.sushi',
    menu: '/cardapio',
  },
  {
    city: 'Santa Maria',
    state: 'RS',
    hours: 'Ter – Dom  ·  18h – 23h',
    note: 'Somente delivery. Mesma qualidade. Sem exceção.',
    whatsapp: 'https://wa.me/5555999999992',
    instagram: 'https://instagram.com/marujos.sushi',
    menu: '/cardapio',
  },
]


// ─── Section: About ───────────────────────────────────────────────────────────

function About() {
  return (
    <section
      id="sobre"
      className="relative px-6 md:px-16 lg:px-24 pt-28 md:pt-36 pb-0 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #040404 0%, #060606 100%)' }}
    >
      {/* Subtle ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, left: 0, width: '40%', height: '60%',
          pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 100% 80% at 0% 0%, rgba(201,168,76,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">

        <p
          className="text-[#C9A84C] text-[10px] tracking-[0.55em] uppercase mb-14 md:mb-24"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Nossa história
        </p>

        {/* Mobile: stacked. Desktop: two-column */}
        <div className="grid md:grid-cols-[1fr_380px] gap-12 md:gap-32 items-start mb-20 md:mb-28">

          {/* Left — headline + stats */}
          <div>
            <h2
              className="text-[#F5F0E8] leading-[1.04] mb-12 md:mb-20"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(30px, 5.5vw, 72px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              Nascemos em Caçapava.<br />
              Crescemos com critério.<br />
              <span style={{ color: '#C9A84C' }}>Continuamos os mesmos.</span>
            </h2>

            {/* Stats — mobile: wraps cleanly; desktop: horizontal */}
            <div className="flex flex-wrap gap-y-8 border-t border-[#111] pt-10">
              {[
                { value: '2018',   label: 'Fundação'   },
                { value: '2',      label: 'Unidades'   },
                { value: 'Gaúcho', label: 'De origem'  },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="flex items-start"
                  style={{ paddingRight: '3rem', marginRight: i < 2 ? '3rem' : 0, borderRight: i < 2 ? '1px solid #111' : 'none' }}
                >
                  <div>
                    <div
                      className="text-[#C9A84C] leading-none mb-2"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 'clamp(22px, 3vw, 38px)',
                        fontWeight: 700,
                      }}
                    >
                      {s.value}
                    </div>
                    <div
                      className="text-[#2a2a2a] text-[10px] tracking-[0.4em] uppercase"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {s.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — supporting text. On mobile: no left border, less padding */}
          <div className="md:pt-4 md:border-l md:border-[#111] md:pl-14 flex flex-col justify-between">
            <div
              className="space-y-6 leading-[1.9]"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 15 }}
            >
              <p
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 'clamp(17px, 2vw, 22px)',
                  fontWeight: 700,
                  color: '#C9A84C',
                  lineHeight: 1.4,
                  letterSpacing: '-0.01em',
                }}
              >
                Sushi de verdade.<br />Feito com técnica.
              </p>
              <p className="text-[#3d3d3d]">
                Cada peça é montada na hora.<br />
                Sem atalho. Sem exagero.<br />
                Sem precisar parecer algo que não é.
              </p>
              <p className="text-[#2d2d2d]">
                A disciplina não é marketing.<br />
                É o que separa uma refeição boa<br />
                de uma que você não esquece.
              </p>
            </div>
            <div
              className="mt-8 w-6 h-px hidden md:block"
              style={{ background: 'linear-gradient(to right, #C9A84C44, transparent)' }}
            />
          </div>

        </div>

      </div>

      {/* Full-bleed sushi image */}
      <div
        style={{
          position: 'relative',
          marginLeft: 'clamp(-1.5rem, -4vw, -6rem)',
          marginRight: 'clamp(-1.5rem, -4vw, -6rem)',
          aspectRatio: '16 / 7',
          overflow: 'hidden',
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1800&q=90&auto=format&fit=crop&crop=center"
          alt="Preparação de sushi no Marujos"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 40%',
            filter: 'brightness(0.62) contrast(1.1) saturate(0.88)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #060606 0%, transparent 10%, transparent 84%, #050505 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 130% 100% at 50% 50%, transparent 52%, rgba(4,4,4,0.45) 100%)', pointerEvents: 'none' }} />
      </div>

      <StoryVideo />

    </section>
  )
}

// ─── Section: Identity ────────────────────────────────────────────────────────

function Experience() {
  return (
    <section
      id="cardapio"
      className="relative overflow-hidden"
      style={{ background: '#040404' }}
    >
      {/* Text block */}
      <div className="px-6 md:px-16 lg:px-24 pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto">

          <p
            className="text-[#C9A84C] text-[10px] tracking-[0.55em] uppercase mb-8 md:mb-10"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Identidade
          </p>

          {/* Dominant headline — smaller on mobile to avoid overflow */}
          <h2
            className="text-[#F5F0E8] leading-[1.0] mb-12 md:mb-20"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(40px, 7.5vw, 100px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            Não é pra<br />
            <em style={{ fontStyle: 'italic', color: '#C9A84C' }}>todo mundo.</em>
          </h2>

          {/* Supporting copy */}
          <div className="md:flex md:justify-end">
            <div
              className="space-y-5 leading-[2] max-w-md"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 15 }}
            >
              <p className="text-[#484848]">
                O Marujos é pra quem presta atenção.<br />
                Pra quem sente a diferença.<br />
                Pra quem não aceita qualquer coisa.
              </p>
              <p
                style={{
                  color: '#C9A84C',
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 'clamp(16px, 1.8vw, 20px)',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.4,
                }}
              >
                Se você entende,<br />você já sabe onde está.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Full-bleed identity image — more visible, more premium */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '21 / 8',
          overflow: 'hidden',
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1553621042-f6e147245754?w=1800&q=90&auto=format&fit=crop&crop=center"
          alt="Preparação artesanal de sushi"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 50%',
            filter: 'brightness(0.65) contrast(1.12) saturate(0.9)',
          }}
        />
        {/* Top and bottom fade */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #040404 0%, transparent 10%, transparent 86%, #040404 100%)', pointerEvents: 'none' }} />
        {/* Soft edge vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 140% 100% at 50% 50%, transparent 55%, rgba(4,4,4,0.4) 100%)', pointerEvents: 'none' }} />
        {/* Warm gold atmosphere */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      </div>

    </section>
  )
}

// ─── Section: Highlights ─────────────────────────────────────────────────────

const HIGHLIGHTS = [
  {
    tag: 'Favorito',
    title: 'Temaki\nMarujos',
    description: 'O mais pedido desde o primeiro dia. Alga crocante, recheio generoso, proporção no ponto.',
    detail: 'No menu',
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80&auto=format&fit=crop',
  },
  {
    tag: 'Especial',
    title: 'Sashimi\nda casa',
    description: 'Cortes do dia, servidos simples. O peixe fresco não precisa de muito para se destacar.',
    detail: 'Conforme o dia',
    image: 'https://images.unsplash.com/photo-1563612116625-3012372fccce?w=600&q=80&auto=format&fit=crop',
  },
  {
    tag: 'Clássico',
    title: 'Combinado\nMarujos',
    description: 'A escolha de quem quer provar o cardápio completo numa só visita. Montado com critério.',
    detail: 'No menu',
    image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&q=80&auto=format&fit=crop',
  },
]

function Highlights() {
  return (
    <section
      className="relative px-6 md:px-16 lg:px-24 pt-28 md:pt-36 pb-32 md:pb-40 overflow-hidden"
      style={{ background: '#040404' }}
    >
      <div className="relative z-10 max-w-6xl mx-auto">

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-14 md:mb-16">
          <div>
            <p
              className="text-[#C9A84C] text-[10px] tracking-[0.55em] uppercase mb-6"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Do cardápio
            </p>
            <h2
              className="text-[#F5F0E8] leading-[1.0]"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(28px, 4.5vw, 58px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              Pratos que<br />definem a casa.
            </h2>
          </div>
          <a
            href="#unidades"
            className="text-[#242424] hover:text-[#C9A84C] transition-colors duration-300 shrink-0"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase' }}
          >
            Escolher unidade →
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-[#0e0e0e]">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.title}
              className="flex flex-col group"
              style={{ backgroundColor: '#050505', paddingTop: i === 1 ? '4rem' : '0' }}
            >
              <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden' }}>
                <img
                  src={h.image}
                  alt={h.title.replace('\n', ' ')}
                  className="group-hover:scale-105 transition-transform duration-1000"
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover',
                    filter: 'brightness(0.42) contrast(1.18) saturate(0.7)',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 35%, rgba(201,168,76,0.18) 0%, transparent 70%)', pointerEvents: 'none' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #050505 0%, rgba(5,5,5,0.5) 30%, transparent 55%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '1.5rem', left: '1.75rem', right: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="text-[#C9A84C] text-[10px] tracking-[0.45em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>{h.tag}</span>
                  <span className="text-[#222] text-[11px]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em' }}>0{i + 1}</span>
                </div>
              </div>

              <div className="px-7 pt-7 pb-8 flex flex-col flex-1">
                <h3
                  className="text-[#F5F0E8] leading-[1.05] mb-4 whitespace-pre-line"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 'clamp(22px, 2.5vw, 32px)',
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                  }}
                >
                  {h.title}
                </h3>
                <p className="text-[#303030] leading-[1.85] flex-1 mb-7" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
                  {h.description}
                </p>
                <div className="border-t border-[#0f0f0f] pt-5 flex items-center justify-between group-hover:border-[#1c1c1c] transition-colors duration-500">
                  <span className="text-[#252525] text-[10px] tracking-[0.35em] uppercase group-hover:text-[#C9A84C55] transition-colors duration-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {h.detail}
                  </span>
                  <span className="text-[#1e1e1e] text-xs group-hover:text-[#C9A84C66] transition-colors duration-500">↗</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

// ─── Section: Locations ──────────────────────────────────────────────────────

function Locations() {
  return (
    <section id="unidades" className="px-6 md:px-16 lg:px-24 pt-28 md:pt-40 pb-28 md:pb-44" style={{ background: '#030303' }}>
      <div className="max-w-6xl mx-auto">

        <div className="mb-16 md:mb-28">
          <p
            className="text-[#C9A84C] text-[10px] tracking-[0.55em] uppercase mb-7"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Onde estamos
          </p>
          <div className="md:flex md:items-end md:justify-between md:gap-16">
            <h2
              className="text-[#F5F0E8] leading-[1.0] mb-5 md:mb-0"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(28px, 5vw, 62px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              O mesmo padrão.<br />
              <span style={{ color: '#3a3a3a' }}>Duas cidades.</span>
            </h2>
            <p
              className="text-[#383838] leading-[1.9] max-w-xs"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}
            >
              Mesma técnica. Mesmo critério.<br />
              Sem concessões de nenhum lado.
            </p>
          </div>
        </div>

        <div>
          {UNITS.map((u, i) => (
            <div
              key={u.city}
              className="group flex flex-col gap-6 md:gap-0 md:flex-row md:items-start md:justify-between py-10 md:py-12 border-t border-[#0f0f0f] hover:border-[#1e1e1e] transition-colors duration-500"
            >
              {/* Left — identity */}
              <div className="flex items-start gap-5">
                <span
                  className="text-[#1e1e1e] mt-1 shrink-0 tabular-nums"
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '0.1em' }}
                >
                  0{i + 1}
                </span>
                <div>
                  <div
                    className="text-[#F5F0E8] leading-none mb-3"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 'clamp(22px, 2.8vw, 36px)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {u.city}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <span className="text-[#2e2e2e] text-[10px] tracking-[0.4em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {u.state}
                    </span>
                    <div className="w-px h-3 bg-[#1a1a1a]" />
                    <span className="text-[#2e2e2e] text-[10px] tracking-[0.2em]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {u.hours}
                    </span>
                  </div>
                  <span
                    className="text-[10px] tracking-[0.3em] uppercase"
                    style={{ fontFamily: 'Inter, sans-serif', color: i === 0 ? '#C9A84C99' : '#C9A84C66' }}
                  >
                    {u.note}
                  </span>
                </div>
              </div>

              {/* Right — actions */}
              <div className="pl-10 md:pl-0 flex flex-col gap-4 items-start md:items-end shrink-0">
                <a
                  href={u.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/wa flex items-center gap-3"
                >
                  <span
                    className="w-7 h-7 border border-[#C9A84C44] rounded-full flex items-center justify-center group-hover/wa:border-[#C9A84C99] group-hover/wa:bg-[#C9A84C0d] transition-all duration-300"
                    style={{ color: '#C9A84C', fontSize: 11 }}
                  >
                    ↗
                  </span>
                  <span
                    className="text-[#C9A84C] text-[11px] tracking-[0.35em] uppercase group-hover/wa:text-[#e0c670] transition-colors duration-300"
                    style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                  >
                    Pedir agora
                  </span>
                </a>

                <div className="flex items-center gap-5">
                  <a
                    href={u.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2a2a2a] hover:text-[#666] transition-colors duration-300 text-[10px] tracking-[0.35em] uppercase"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Instagram
                  </a>
                  <div className="w-px h-3 bg-[#1a1a1a]" />
                  <a
                    href={u.menu}
                    className="text-[#252525] hover:text-[#555] transition-colors duration-300 text-[10px] tracking-[0.35em] uppercase"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Cardápio
                  </a>
                </div>
              </div>
            </div>
          ))}
          <div className="border-t border-[#0f0f0f]" />
        </div>

      </div>
    </section>
  )
}

// ─── Section: CTA — escolher unidade ─────────────────────────────────────────

function OrderCTA() {
  return (
    <section id="contato" className="relative overflow-hidden" style={{ background: '#050505' }}>

      {/* Top separator — thin gold line */}
      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.15), transparent)' }} />

      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-30%', right: '-15%',
          width: '65%', height: '80%',
          background: 'radial-gradient(ellipse at 60% 70%, rgba(201,168,76,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative px-6 md:px-16 lg:px-24 pt-28 md:pt-40 pb-24 md:pb-36 max-w-6xl mx-auto">

        {/* Ghost headline — desktop only */}
        <div
          className="text-[#0b0b0b] leading-none mb-0 pointer-events-none select-none hidden md:block"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(90px, 16vw, 200px)',
            fontWeight: 700,
            letterSpacing: '-0.045em',
            lineHeight: 0.82,
          }}
          aria-hidden="true"
        >
          Agora
        </div>

        <div className="md:-mt-20 relative z-10">

          <div className="mb-14 md:mb-20">
            <p
              className="text-[#C9A84C] text-[10px] tracking-[0.55em] uppercase mb-8 md:mb-10"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Escolha sua unidade
            </p>
            <h2
              className="text-[#F5F0E8] leading-[1.0] mb-6"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(32px, 5.5vw, 72px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              Agora é<br />com você.
            </h2>
            <p
              className="text-[#484848] leading-[2]"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, maxWidth: 280 }}
            >
              Experimenta.<br />Depois me diz.
            </p>
          </div>

          <UnitCards units={UNITS} />

          <div className="flex items-center gap-5 mt-2">
            <div className="w-8 h-px" style={{ background: 'linear-gradient(to right, #C9A84C33, transparent)' }} />
            <a
              href="https://instagram.com/marujos.sushi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2e2e2e] hover:text-[#888] transition-colors duration-300"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '0.4em', textTransform: 'uppercase' }}
            >
              @marujos.sushi
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-24 md:mt-40 pt-8 border-t border-[#0d0d0d] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <span className="text-[#191919] text-[10px] tracking-[0.4em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
            © {new Date().getFullYear()} Marujos Sushi
          </span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, letterSpacing: '0.2em', color: '#C9A84C', opacity: 0.3 }}>
            Marujos Sushi
          </span>
          <span className="text-[#191919] text-[10px] tracking-[0.4em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
            Caçapava do Sul · Santa Maria
          </span>
        </div>

      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstitucionalPage() {
  return (
    <main style={{ backgroundColor: '#060606' }}>
      <HeroSection />
      <About />
      <Experience />
      <Highlights />
      <Locations />
      <OrderCTA />
    </main>
  )
}
