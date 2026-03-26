import Link from 'next/link'
import type { Produto } from '@/types/product'
import { formatarPreco, formatarDesconto } from '@/utils/currency'
import { ImageWithFallback } from './ImageWithFallback'

interface Props {
  combos: Produto[]
}

// Placeholders ricos por posição — calor dourado que evoca comida
const placeholders = [
  {
    bg: '#1C1000',
    glow: 'radial-gradient(ellipse at 35% 40%, rgba(201,168,76,0.22) 0%, rgba(160,90,20,0.12) 35%, transparent 65%), radial-gradient(ellipse at 72% 65%, rgba(140,60,10,0.10) 0%, transparent 50%)',
  },
  {
    bg: '#170E00',
    glow: 'radial-gradient(ellipse at 60% 35%, rgba(201,168,76,0.18) 0%, rgba(180,100,20,0.10) 35%, transparent 65%), radial-gradient(ellipse at 28% 70%, rgba(120,55,10,0.09) 0%, transparent 50%)',
  },
  {
    bg: '#130B00',
    glow: 'radial-gradient(ellipse at 45% 50%, rgba(201,168,76,0.16) 0%, rgba(150,80,15,0.09) 35%, transparent 65%), radial-gradient(ellipse at 78% 30%, rgba(110,50,10,0.08) 0%, transparent 50%)',
  },
]

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ComboDestaque({ combos }: Props) {
  if (combos.length === 0) return null

  return (
    <section className="pt-5 pb-2">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 mb-4">
        <div>
          <h2 className="font-display text-ivory font-semibold italic" style={{ fontSize: '19px' }}>
            Combos
          </h2>
          <p className="text-ivory/35 font-sans mt-0.5" style={{ fontSize: '10px' }}>
            Os mais pedidos da casa
          </p>
        </div>
        <Link
          href="/cardapio/combos"
          className="text-gold/60 font-sans hover:text-gold/80 transition-colors"
          style={{ fontSize: '11px' }}
        >
          Ver todos
        </Link>
      </div>

      {/* Cards em scroll horizontal */}
      <div
        className="flex gap-3 overflow-x-auto px-4 pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {combos.map((combo, index) => {
          const desconto = combo.precoOriginal
            ? formatarDesconto(combo.precoOriginal, combo.preco)
            : null
          const isPopular = combo.tags.includes('popular')
          const ph = placeholders[index % placeholders.length]

          const FallbackImage = (
            <div
              className="absolute inset-0"
              style={{ background: ph.glow, backgroundColor: ph.bg }}
            />
          )

          return (
            <Link
              key={combo.id}
              href={`/cardapio/combos/${combo.slug}`}
              className="flex-shrink-0 active:scale-[0.97] transition-transform duration-150"
              style={{ scrollSnapAlign: 'start', width: '260px' }}
            >
              <div
                className="rounded-2xl overflow-hidden hover:border-gold/30 transition-all duration-200 shadow-card-hover"
                style={{ border: '1px solid rgba(201,168,76,0.12)', backgroundColor: '#1A1400' }}
              >

                {/* ── Imagem ──────────────────────────────────────────────── */}
                <div
                  className="relative w-full overflow-hidden"
                  style={{ height: '220px', backgroundColor: ph.bg }}
                >
                  <ImageWithFallback
                    src={combo.imagens[0] ?? ''}
                    alt={combo.nome}
                    sizes="260px"
                    fallback={FallbackImage}
                  />

                  {/* Gradiente inferior — funde imagem com conteúdo */}
                  <div
                    className="absolute bottom-0 inset-x-0"
                    style={{
                      height: '80px',
                      background: 'linear-gradient(to top, #1A1400 0%, rgba(26,20,0,0.7) 50%, transparent 100%)',
                    }}
                  />

                  {/* Badges — topo esquerdo */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {desconto && (
                      <span
                        className="font-sans font-bold px-2.5 py-1 rounded-full"
                        style={{ fontSize: '11px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
                      >
                        {desconto}
                      </span>
                    )}
                    {isPopular && (
                      <span
                        className="backdrop-blur-sm font-sans font-medium px-2.5 py-1 rounded-full"
                        style={{
                          fontSize: '10px',
                          backgroundColor: 'rgba(10,10,10,0.65)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'rgba(245,240,232,0.80)',
                        }}
                      >
                        Mais pedido
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Conteúdo ────────────────────────────────────────────── */}
                <div className="px-3.5 pt-2.5 pb-3.5">
                  <h3
                    className="font-display text-ivory font-semibold leading-tight"
                    style={{ fontSize: '15px' }}
                  >
                    {combo.nome}
                  </h3>
                  <p
                    className="font-sans mt-1 line-clamp-1"
                    style={{ fontSize: '11px', color: 'rgba(245,240,232,0.40)' }}
                  >
                    {combo.descricaoResumida}
                  </p>

                  {/* Preço + CTA */}
                  <div className="flex items-center justify-between mt-3.5 gap-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-sans font-bold text-gold" style={{ fontSize: '17px' }}>
                        {formatarPreco(combo.preco)}
                      </span>
                      {combo.precoOriginal && (
                        <span
                          className="font-sans line-through"
                          style={{ fontSize: '11px', color: 'rgba(245,240,232,0.20)' }}
                        >
                          {formatarPreco(combo.precoOriginal)}
                        </span>
                      )}
                    </div>

                    {/* CTA — preenchido, alto contraste */}
                    <span
                      className="flex items-center gap-1.5 font-sans font-bold flex-shrink-0 rounded-xl px-3.5 py-2"
                      style={{
                        fontSize: '12px',
                        backgroundColor: '#C9A84C',
                        color: '#0A0A0A',
                      }}
                    >
                      <IconPlus />
                      Pedir
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
