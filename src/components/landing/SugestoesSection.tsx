import Link from 'next/link'
import type { Produto } from '@/types/product'
import { formatarPreco, formatarDesconto, calcularPercentualDesconto } from '@/utils/currency'

interface Props {
  produtos: Produto[]
}

// Gradientes cinematográficos — profundidade e calor visual
const thumbnailStyles = [
  { background: 'radial-gradient(ellipse at 35% 55%, #5C2000 0%, #2A0E00 40%, #0A0A0A 100%)' }, // âmbar quente — salmon
  { background: 'radial-gradient(ellipse at 65% 40%, #3D0028 0%, #1E0015 40%, #0A0A0A 100%)' }, // bordô profundo — atum
  { background: 'radial-gradient(ellipse at 30% 65%, #002E3A 0%, #001520 40%, #0A0A0A 100%)' }, // oceano fundo — pepino/abacate
]

// Kanji decorativos — um por card, sugerem ingrediente e origem
// 魚 = peixe · 寿 = primeira sílaba de sushi · 海 = mar
const thumbnailKanji = ['魚', '寿', '海']

// Ganchos de desejo por posição
const hooksDeDesejo = [
  'O mais pedido da casa',
  'Para uma noite que merece',
  'O preferido para reunir quem importa',
]

function extrairPorcao(descricao: string): string | null {
  const match = descricao.match(/[Pp]ara (\d+) pessoa/)
  if (!match) return null
  const n = match[1]
  return `Para ${n} ${n === '1' ? 'pessoa' : 'pessoas'}`
}

export function SugestoesSection({ produtos }: Props) {
  if (produtos.length === 0) return null

  return (
    <section className="px-5">

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-px bg-border" />
        <div className="text-center">
          <h2
            className="font-display text-ivory/80 font-semibold italic leading-none"
            style={{ fontSize: '17px' }}
          >
            Sugestões da Casa
          </h2>
          <p
            className="text-ivory/25 font-sans mt-1 italic"
            style={{ fontSize: '10px' }}
          >
            Os pratos que fazem nossos clientes voltarem
          </p>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ── Cards verticais ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {produtos.map((produto, index) => {
          const desconto = produto.precoOriginal
            ? calcularPercentualDesconto(produto.precoOriginal, produto.preco)
            : null
          const economiaFormatada = produto.precoOriginal
            ? formatarDesconto(produto.precoOriginal, produto.preco)
            : null
          const isPopular = produto.tags.includes('popular')
          const isChef = produto.tags.includes('destaque-chef')
          const porcao = extrairPorcao(produto.descricao)
          const hook = hooksDeDesejo[index] ?? null
          const kanji = thumbnailKanji[index % thumbnailKanji.length]

          return (
            <Link
              key={produto.id}
              href={`/cardapio/${produto.categoriaId.replace('cat-', '')}/${produto.slug}`}
              className="block active:scale-[0.985] transition-transform duration-150"
            >
              <div className="rounded-2xl border border-border/80 bg-surface overflow-hidden shadow-card hover:border-gold/15 hover:shadow-card-hover transition-all duration-200">

                {/* ── Thumbnail — imagem de fundo cinematográfica ──────── */}
                <div
                  className="w-full h-[148px] relative overflow-hidden"
                  style={thumbnailStyles[index % thumbnailStyles.length]}
                >
                  {/* Kanji — marca d'água evocativa, quase invisível */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                    aria-hidden
                  >
                    <span
                      style={{
                        fontFamily: 'serif',
                        fontSize: '11rem',
                        lineHeight: 1,
                        color: '#C9A84C',
                        opacity: 0.055,
                        userSelect: 'none',
                      }}
                    >
                      {kanji}
                    </span>
                  </div>

                  {/* Brilho lateral esquerdo */}
                  <div className="absolute left-0 inset-y-0 w-px bg-gradient-to-b from-transparent via-gold/10 to-transparent" />

                  {/* Fade inferior — dissolve no card abaixo */}
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-surface to-transparent" />

                  {/* Badge — canto superior direito */}
                  {isPopular && (
                    <span className="absolute top-3 right-3 text-[9px] font-sans font-medium text-gold/80 bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Mais pedido
                    </span>
                  )}
                  {!isPopular && isChef && (
                    <span className="absolute top-3 right-3 text-[9px] font-sans font-medium text-amber-400/80 bg-amber-900/20 border border-amber-700/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Recomendado
                    </span>
                  )}

                  {/* Porção — canto inferior esquerdo */}
                  {porcao && (
                    <div className="absolute bottom-2.5 left-3.5">
                      <span
                        className="text-ivory/25 font-sans"
                        style={{ fontSize: '9px' }}
                      >
                        {porcao}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Conteúdo ─────────────────────────────────────────── */}
                <div className="p-3.5 pt-3">

                  {/* Gancho de desejo — psicologia por posição */}
                  {hook && (
                    <p
                      className="text-gold/45 font-sans italic mb-1.5"
                      style={{ fontSize: '10px' }}
                    >
                      {hook}
                    </p>
                  )}

                  {/* Nome */}
                  <h3 className="font-display text-ivory text-[15px] font-semibold italic leading-tight">
                    {produto.nome}
                  </h3>

                  {/* Descrição resumida */}
                  <p className="text-ivory/30 text-[11px] font-sans leading-snug line-clamp-1 mt-1">
                    {produto.descricaoResumida}
                  </p>

                  {/* Rodapé */}
                  <div className="flex items-end justify-between mt-3 pt-2.5 border-t border-border/50">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-gold font-sans font-semibold" style={{ fontSize: '16px' }}>
                          {formatarPreco(produto.preco)}
                        </span>
                        {produto.precoOriginal && (
                          <span className="text-ivory/20 text-[10px] font-sans line-through">
                            {formatarPreco(produto.precoOriginal)}
                          </span>
                        )}
                      </div>
                      {economiaFormatada && desconto && desconto > 0 && (
                        <span className="text-success/70 font-sans" style={{ fontSize: '10px' }}>
                          {economiaFormatada}
                        </span>
                      )}
                    </div>

                    <span className="text-gold/50 text-[11px] font-sans flex items-center gap-1 pb-0.5">
                      Quero este
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                        <path d="M2 5h6M5.5 2.5 8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>

                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Link secundário */}
      <Link
        href="/cardapio/combos"
        className="flex items-center justify-center gap-2 mt-4 py-2 hover:opacity-70 transition-opacity"
      >
        <span className="text-ivory/20 text-[10px] font-sans uppercase tracking-[0.4em]">
          Ver todos os combos
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-ivory/15" aria-hidden>
          <path d="M2 5h6M5.5 2.5 8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </section>
  )
}
