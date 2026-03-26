'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Produto } from '@/types/product'
import { formatarPreco, formatarDesconto } from '@/utils/currency'
import { ImageWithFallback } from './ImageWithFallback'
import { useCartStore } from '@/store/cartStore'
import { useCrmStore } from '@/store/crmStore'
import { sendEventToCRM } from '@/utils/crmEvents'

interface Props {
  produto: Produto
}

// Placeholders por categoria — cor base + brilho característico
const categoryPlaceholders: Record<string, { bg: string; glow: string }> = {
  'cat-entradas':    { bg: '#0E1500', glow: 'radial-gradient(ellipse at 38% 42%, rgba(80,140,20,0.18) 0%, transparent 60%), radial-gradient(ellipse at 68% 62%, rgba(60,100,15,0.10) 0%, transparent 55%)' },
  'cat-uramakis':   { bg: '#1C0800', glow: 'radial-gradient(ellipse at 35% 40%, rgba(201,100,40,0.22) 0%, rgba(160,60,20,0.12) 35%, transparent 65%), radial-gradient(ellipse at 70% 65%, rgba(140,50,15,0.12) 0%, transparent 50%)' },
  'cat-temakis':    { bg: '#150010', glow: 'radial-gradient(ellipse at 55% 38%, rgba(180,40,80,0.18) 0%, rgba(120,20,60,0.10) 35%, transparent 65%), radial-gradient(ellipse at 30% 68%, rgba(100,20,50,0.10) 0%, transparent 50%)' },
  'cat-niguiris':   { bg: '#00121A', glow: 'radial-gradient(ellipse at 42% 45%, rgba(20,120,160,0.16) 0%, rgba(10,90,130,0.09) 35%, transparent 65%), radial-gradient(ellipse at 72% 58%, rgba(15,80,110,0.09) 0%, transparent 50%)' },
  'cat-sashimis':   { bg: '#000D1A', glow: 'radial-gradient(ellipse at 48% 38%, rgba(10,90,160,0.18) 0%, rgba(8,70,130,0.10) 35%, transparent 65%), radial-gradient(ellipse at 65% 68%, rgba(5,60,110,0.09) 0%, transparent 50%)' },
  'cat-bebidas':    { bg: '#000A16', glow: 'radial-gradient(ellipse at 40% 42%, rgba(30,80,180,0.16) 0%, rgba(20,60,140,0.09) 35%, transparent 65%), radial-gradient(ellipse at 68% 62%, rgba(15,50,120,0.08) 0%, transparent 50%)' },
  'cat-sobremesas': { bg: '#0E0018', glow: 'radial-gradient(ellipse at 42% 40%, rgba(140,40,200,0.16) 0%, rgba(100,20,160,0.09) 35%, transparent 65%), radial-gradient(ellipse at 70% 65%, rgba(80,15,130,0.09) 0%, transparent 50%)' },
  'cat-combos':     { bg: '#1C1000', glow: 'radial-gradient(ellipse at 35% 40%, rgba(201,168,76,0.22) 0%, rgba(160,90,20,0.12) 35%, transparent 65%), radial-gradient(ellipse at 72% 65%, rgba(140,60,10,0.10) 0%, transparent 50%)' },
}

const defaultPlaceholder = { bg: '#111111', glow: 'radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.10) 0%, transparent 60%)' }

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ProductCard({ produto }: Props) {
  const router = useRouter()
  const [adicionado, setAdicionado] = useState(false)
  const adicionarCombo = useCartStore((s) => s.adicionarCombo)
  const sessionId = useCrmStore((s) => s.sessionId)

  const isCombo = produto.categoriaId === 'cat-combos'

  const desconto = produto.precoOriginal
    ? formatarDesconto(produto.precoOriginal, produto.preco)
    : null

  const isPopular = produto.tags.includes('popular')
  const isNovo    = produto.tags.includes('novo')
  const isVegano  = produto.tags.includes('vegano') || produto.tags.includes('vegetariano')
  const isChef    = produto.tags.includes('destaque-chef')

  const ph = categoryPlaceholders[produto.categoriaId] ?? defaultPlaceholder

  const FallbackImage = (
    <div className="absolute inset-0" style={{ background: ph.glow, backgroundColor: ph.bg }} />
  )

  const href = `/cardapio/${produto.categoriaId.replace('cat-', '')}/${produto.slug}`

  function handleCardNavigate() {
    // Write to sessionStorage BEFORE navigating — guaranteed synchronous.
    // Using router.push() here (not <Link>) so navigation happens only after
    // the write completes. On iOS Safari, onClick on <Link> can race with the
    // browser's native tap-navigation, making the write unreliable.
    try {
      sessionStorage.setItem('returnFrom', JSON.stringify({
        route: window.location.pathname,
        scrollY: window.scrollY,
      }))
    } catch {
      // sessionStorage unavailable — navigate without scroll restore
    }
    router.push(href)
  }

  function handleAdicionar(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    e.stopPropagation()
    adicionarCombo(produto)
    sendEventToCRM(sessionId, {
      event: 'add_to_cart',
      data: {
        productId: produto.id,
        productName: produto.nome,
        categoryId: produto.categoriaId,
        unitPrice: produto.preco,
        quantity: 1,
        withUpsell: true, // adicionarCombo always bundles a drink
        sessionId,
      },
    })
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 1500)
  }

  return (
    <>
      {/* Using a div + onClick instead of <Link> so sessionStorage.setItem is
          guaranteed to complete before router.push fires. On iOS Safari, <Link>
          can navigate before the onClick handler finishes, losing the saved state. */}
      <div
        role="link"
        tabIndex={0}
        onClick={handleCardNavigate}
        onKeyDown={(e) => e.key === 'Enter' && handleCardNavigate()}
        className="cursor-pointer"
      >
        <div
          className="rounded-2xl overflow-hidden hover:border-gold/25 transition-all duration-200 shadow-card"
          style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: '#181818' }}
        >

          {/* ── Imagem ──────────────────────────────────────────────────────── */}
          <div
            className="relative w-full overflow-hidden"
            style={{ height: '220px', backgroundColor: ph.bg }}
          >
            <ImageWithFallback
              src={produto.imagens[0] ?? ''}
              alt={produto.nome}
              sizes="(max-width: 480px) 100vw, 480px"
              fallback={FallbackImage}
            />

            {/* Gradiente inferior */}
            <div
              className="absolute bottom-0 inset-x-0"
              style={{
                height: '90px',
                background: 'linear-gradient(to top, #181818 0%, rgba(24,24,24,0.65) 55%, transparent 100%)',
              }}
            />

            {/* Badges — topo esquerdo */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {isPopular && (
                <span
                  className="font-sans font-bold px-2.5 py-1 rounded-full"
                  style={{ fontSize: '10px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
                >
                  Mais pedido
                </span>
              )}
              {!isPopular && isChef && (
                <span
                  className="backdrop-blur-sm font-sans font-medium px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: '10px',
                    backgroundColor: 'rgba(10,10,10,0.65)',
                    border: '1px solid rgba(201,168,76,0.35)',
                    color: 'rgba(201,168,76,0.85)',
                  }}
                >
                  Chef indica
                </span>
              )}
              {!isPopular && !isChef && isNovo && (
                <span
                  className="backdrop-blur-sm font-sans font-medium px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: '10px',
                    backgroundColor: 'rgba(10,10,10,0.65)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(245,240,232,0.70)',
                  }}
                >
                  Novo
                </span>
              )}
              {isVegano && (
                <span
                  className="backdrop-blur-sm font-sans font-medium px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: '10px',
                    backgroundColor: 'rgba(10,40,10,0.70)',
                    border: '1px solid rgba(80,180,80,0.30)',
                    color: 'rgba(100,220,100,0.90)',
                  }}
                >
                  Vegano
                </span>
              )}
            </div>

            {/* Badge de desconto — topo direito */}
            {desconto && (
              <span
                className="absolute top-3 right-3 font-sans font-bold px-2.5 py-1 rounded-full"
                style={{ fontSize: '10px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
              >
                {desconto}
              </span>
            )}
          </div>

          {/* ── Conteúdo ────────────────────────────────────────────────────── */}
          <div className="px-3.5 pt-3 pb-3.5">

            <h3
              className="font-display text-ivory font-semibold leading-tight"
              style={{ fontSize: '15px' }}
            >
              {produto.nome}
            </h3>

            <p
              className="font-sans mt-1 line-clamp-1"
              style={{ fontSize: '11px', lineHeight: '1.45', color: 'rgba(245,240,232,0.40)' }}
            >
              {produto.descricaoResumida}
            </p>

            {/* Preço + CTA */}
            <div className="flex items-center justify-between mt-3.5 gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans font-bold text-gold" style={{ fontSize: '17px' }}>
                  {formatarPreco(produto.preco)}
                </span>
                {produto.precoOriginal && desconto && (
                  <span
                    className="font-sans line-through"
                    style={{ fontSize: '11px', color: 'rgba(245,240,232,0.22)' }}
                  >
                    {formatarPreco(produto.precoOriginal)}
                  </span>
                )}
              </div>

              {/* CTA */}
              {isCombo ? (
                <button
                  onClick={handleAdicionar}
                  onTouchStart={handleAdicionar}
                  className="flex items-center gap-1.5 font-sans font-bold flex-shrink-0 rounded-xl px-4 py-2.5 active:scale-[0.96] transition-all duration-150"
                  style={{
                    fontSize: '12px',
                    backgroundColor: adicionado ? '#3a7a3a' : '#C9A84C',
                    color: adicionado ? '#E0FFE0' : '#0A0A0A',
                  }}
                >
                  {adicionado ? '✓ Adicionado' : <><IconPlus /> Adicionar</>}
                </button>
              ) : (
                /* Non-combo: visual badge only — the whole card Link handles navigation */
                <span
                  className="flex items-center gap-1.5 font-sans font-bold flex-shrink-0 rounded-xl px-4 py-2.5 pointer-events-none"
                  style={{ fontSize: '12px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
                  aria-hidden
                >
                  <IconPlus />
                  Adicionar
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  )
}
