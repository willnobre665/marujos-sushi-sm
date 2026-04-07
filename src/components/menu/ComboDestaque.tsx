import Link from 'next/link'
import type { Produto } from '@/types/product'
import { formatarPreco } from '@/utils/currency'

interface Props {
  promocoes: Produto[]
}

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ComboDestaque({ promocoes }: Props) {
  if (promocoes.length === 0) return null

  // Featured promo (Combo Yugen)
  const comboYugen = promocoes.find((p) => p.id === 'prod-combo-premium')
  // Remaining promos excluding the featured one
  const outrasPromocoes = promocoes.filter((p) => p.id !== 'prod-combo-premium')

  return (
    <section className="pt-5 pb-2">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 mb-4">
        <div>
          <h2 className="font-display text-ivory font-semibold italic" style={{ fontSize: '19px' }}>
            Promoções
          </h2>
          <p className="text-ivory/35 font-sans mt-0.5" style={{ fontSize: '10px' }}>
            Monte sua experiência completa e economize
          </p>
        </div>
      </div>

      {/* ── Featured banner — Combo Yugen ─────────────────────────────────── */}
      {comboYugen && <Link
        href={`/cardapio/promocoes/${comboYugen.slug}`}
        className="block mx-4 mb-3 active:scale-[0.985] transition-transform duration-150"
      >
        <div
          className="relative overflow-hidden"
          style={{
            height: '180px',
            borderRadius: '18px',
            border: '1px solid rgba(201,168,76,0.20)',
          }}
        >
          {/* Background image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url('/images/COMBO YUGEN.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />

          {/* Dark gradient overlay — left to right */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 100%)',
            }}
          />

          {/* Content */}
          <div className="absolute inset-0 flex items-center justify-between px-5">

            {/* Left — text */}
            <div className="flex flex-col gap-1">
              <span
                className="font-sans font-bold uppercase tracking-wider"
                style={{ fontSize: '9px', color: '#C9A84C', letterSpacing: '0.1em' }}
              >
                Mais pedido
              </span>
              <h3
                className="font-display text-ivory font-semibold leading-tight"
                style={{ fontSize: '22px' }}
              >
                Combo Yugen
              </h3>
              <p
                className="font-sans"
                style={{ fontSize: '12px', color: 'rgba(245,240,232,0.60)' }}
              >
                27 peças — mais pedido
              </p>
              <span
                className="font-sans font-bold text-gold mt-1"
                style={{ fontSize: '20px' }}
              >
                {formatarPreco(comboYugen.preco)}
              </span>
            </div>

            {/* Right — CTA */}
            <span
              className="flex items-center gap-1.5 font-sans font-bold flex-shrink-0 rounded-xl px-4 py-2.5"
              style={{
                fontSize: '13px',
                backgroundColor: '#C9A84C',
                color: '#0A0A0A',
              }}
            >
              <IconPlus />
              Pedir
            </span>
          </div>
        </div>
      </Link>}

      {/* ── Other promos — horizontal scroll strip ────────────────────────── */}
      {outrasPromocoes.length > 0 && (
        <div
          className="flex gap-3 overflow-x-auto px-4 pb-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {outrasPromocoes.map((promo) => (
            <Link
              key={promo.id}
              href={`/cardapio/promocoes/${promo.slug}`}
              className="flex-shrink-0 active:scale-[0.98] transition-transform duration-150"
              style={{ scrollSnapAlign: 'start', width: 'min(300px, 80vw)' }}
            >
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{ height: '160px', border: '1px solid rgba(201,168,76,0.15)' }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "url('/images/hero.jpg.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(2px) brightness(0.55)',
                    transform: 'scale(1.05)',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 100%)',
                  }}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3
                    className="font-display text-ivory font-semibold leading-tight"
                    style={{ fontSize: '16px' }}
                  >
                    {promo.nome}
                  </h3>
                  {promo.descricaoResumida && (
                    <p
                      className="font-sans mt-0.5 line-clamp-1"
                      style={{ fontSize: '11px', color: 'rgba(245,240,232,0.55)' }}
                    >
                      {promo.descricaoResumida}
                    </p>
                  )}
                  <span
                    className="font-sans font-bold text-gold mt-2"
                    style={{ fontSize: '18px' }}
                  >
                    {formatarPreco(promo.preco)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
