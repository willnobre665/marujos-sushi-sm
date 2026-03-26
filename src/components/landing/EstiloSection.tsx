import Link from 'next/link'

const estilos = [
  {
    numero: '01',
    titulo: 'Clássico',
    tagline: 'O Japão em sua pureza',
    descricao: 'Niguiris e sashimis — a tradição que vem do mar',
    href: '/cardapio/niguiris',
    accentFrom: 'rgba(201,168,76,0.06)',
  },
  {
    numero: '02',
    titulo: 'Moderno',
    tagline: 'Criatividade sem limites',
    descricao: 'Uramakis autorais com combinações que surpreendem',
    href: '/cardapio/uramakis',
    accentFrom: 'rgba(180,100,100,0.05)',
  },
  {
    numero: '03',
    titulo: 'Família',
    tagline: 'Para momentos que ficam',
    descricao: 'Combos generosos feitos para compartilhar',
    href: '/cardapio/combos',
    accentFrom: 'rgba(201,168,76,0.05)',
  },
  {
    numero: '04',
    titulo: 'Temaki',
    tagline: 'Feito à mão, pra você',
    descricao: 'Cones artesanais com recheios generosos',
    href: '/cardapio/temakis',
    accentFrom: 'rgba(60,120,140,0.06)',
  },
]

export function EstiloSection() {
  return (
    <section className="px-5 pb-6">

      {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-px bg-border" />
        <div className="text-center">
          <h2
            className="font-display text-ivory/80 font-semibold italic leading-none"
            style={{ fontSize: '17px' }}
          >
            Descubra seu Estilo
          </h2>
          {/* "Qual é o seu?" — pergunta direta ativa auto-identificação */}
          <p
            className="text-ivory/25 font-sans mt-1 italic"
            style={{ fontSize: '10px' }}
          >
            Qual é o seu?
          </p>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ── Lista vertical ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        {estilos.map((estilo) => (
          <Link
            key={estilo.href}
            href={estilo.href}
            className="block active:scale-[0.985] transition-transform duration-150"
          >
            <div
              className="relative flex items-center gap-4 px-4 py-4 rounded-2xl border border-border/70 overflow-hidden min-h-[76px] hover:border-gold/20 transition-colors duration-200"
              style={{
                background: `radial-gradient(ellipse at 100% 20%, ${estilo.accentFrom} 0%, #141414 55%)`,
              }}
            >
              {/* Linha superior dourada — sutil */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-gold/15 via-gold/5 to-transparent" />

              {/* Número decorativo — lateral esquerda */}
              <span
                className="font-display text-ivory/[0.09] font-bold leading-none flex-shrink-0 w-9 text-right"
                style={{ fontSize: '2rem' }}
                aria-hidden
              >
                {estilo.numero}
              </span>

              {/* Texto central */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-display text-ivory font-semibold leading-tight"
                  style={{ fontSize: '16px' }}
                >
                  {estilo.titulo}
                </p>
                <p
                  className="font-sans italic text-gold/50 mt-0.5 leading-tight"
                  style={{ fontSize: '10px' }}
                >
                  {estilo.tagline}
                </p>
                <p
                  className="text-ivory/20 font-sans leading-snug mt-1"
                  style={{ fontSize: '10px' }}
                >
                  {estilo.descricao}
                </p>
              </div>

              {/* Seta */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-ivory/15 flex-shrink-0"
                aria-hidden
              >
                <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Assinatura ──────────────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-gold/25 text-[8px]">✦</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <span
          className="text-ivory/15 font-sans uppercase tracking-[0.55em]"
          style={{ fontSize: '8px' }}
        >
          Marujos Sushi · {new Date().getFullYear()}
        </span>
      </div>
    </section>
  )
}
