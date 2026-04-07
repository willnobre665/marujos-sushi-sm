'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Produto } from '@/types/product'
import { formatarPreco } from '@/utils/currency'
import { useCartStore } from '@/store/cartStore'
import { useCrmStore } from '@/store/crmStore'
import { sendEventToCRM } from '@/utils/crmEvents'
import { ImageWithFallback } from './ImageWithFallback'
import { motion } from 'framer-motion'

interface Props {
  produto: Produto
  upsellItem: Produto
}

// ─── Ícones ──────────────────────────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M12.5 5L7.5 10l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPlus({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7.5l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Emotional copy map ───────────────────────────────────────────────────────
// Replaces technical composition copy with benefit-driven descriptions.
// Falls back to produto.descricao for products not listed here.

const DESCRICAO_EMOCIONAL: Record<string, string> = {
  'prod-combo-executivo':
    'O favorito de quem quer comer bem sem abrir mão de nada. Salmão fresco, atum selecionado e o calor do missoshiru — uma refeição completa numa só escolha.',
  'prod-combo-premium':
    'Para quando a ocasião pede mais. Uma mesa farta, peixes nobres e uma sobremesa pra finalizar com elegância. Ideal pra dividir — ou não.',
  'prod-combo-familia':
    'A experiência completa do Marujos. Variedade, fartura e aquela energia boa de refeição em família. Tudo no ponto, tudo junto.',
  'prod-gyoza':
    'Crocantes por fora, suculentos por dentro. Os gyozas saem direto da chapa para a sua mesa — melhor comer enquanto ainda fumegam.',
  'prod-edamame':
    'Simples, leve e irresistível. Um clássico japonês que vai e volta antes mesmo de você perceber. Começa aqui.',
  'prod-missoshiru':
    'Quentinho, reconfortante e profundo. O missoshiru do Marujos é feito com missô artesanal — um abraço numa tigela.',
  'prod-harumaki':
    'Crocantes na primeira mordida, cheios de sabor até o fim. Feitos na hora, como deve ser.',
  'prod-uramaki-salmao':
    'O clássico que ninguém dispensa. Salmão fresco, cream cheese e aquele toque de gergelim que fecha com chave de ouro.',
  'prod-uramaki-salmao-especial':
    'Tudo que você ama no Uramaki Salmão — com molho tarê artesanal que muda o nível. A escolha do chef.',
  'prod-uramaki-atum':
    'Atum fresco encontra abacate cremoso e o calor da sriracha. Intenso, equilibrado e impossível de resistir.',
  'prod-uramaki-camarao-empanado':
    'Camarão empanado crocante, maionese especial e tobiko. Uma festa de texturas em cada mordida.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function derivarPorcao(produto: Produto): string | null {
  const desc = produto.descricaoResumida.toLowerCase()
  if (desc.includes('4 pessoa')) return 'Serve 4 pessoas'
  if (desc.includes('3 pessoa')) return 'Serve 3 pessoas'
  if (desc.includes('2 pessoa')) return 'Serve 2 pessoas'
  if (desc.includes('1 pessoa')) return 'Serve 1 pessoa'
  if (produto.categoriaId === 'cat-combos') {
    if (desc.includes('40 ') || desc.includes('família')) return 'Serve 4 pessoas'
    if (desc.includes('24 ') || desc.includes('2 temakis')) return 'Serve 2 pessoas'
    return 'Serve 1 pessoa'
  }
  return null
}

const PLACEHOLDER_BG: Record<string, string> = {
  'cat-combos':     '#1C1000',
  'cat-uramakis':   '#1C0800',
  'cat-temakis':    '#150010',
  'cat-niguiris':   '#00121A',
  'cat-sashimis':   '#000D1A',
  'cat-bebidas':    '#000A16',
  'cat-entradas':   '#0E1500',
  'cat-sobremesas': '#0E0018',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProdutoClient({ produto, upsellItem }: Props) {
  const router = useRouter()
  const adicionarItem = useCartStore((s) => s.adicionarItem)
  const adicionarCombo = useCartStore((s) => s.adicionarCombo)
  const sessionId = useCrmStore((s) => s.sessionId)

  const [quantidade, setQuantidade] = useState(1)
  const [comUpsell, setComUpsell] = useState(false)
  const [adicionado, setAdicionado] = useState(false)

  // Disable browser scroll restoration while on this page.
  // Without this, when we navigate back and call window.scrollTo(),
  // Safari's native restoration fires after our call and resets to 0.
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    return () => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
      }
    }
  }, [])

  const isCombo = produto.categoriaId === 'cat-combos'
  const isPopular = produto.tags.includes('popular')
  const isChef = produto.tags.includes('destaque-chef')

  function handleUpsellToggle() {
    const next = !comUpsell
    setComUpsell(next)
    sendEventToCRM(sessionId, {
      event: 'upsell_clicked',
      data: {
        upsellProductId: upsellItem.id,
        upsellProductName: upsellItem.nome,
        triggerProductId: produto.id,
        accepted: next,
        sessionId,
      },
    })
  }
  const porcao = derivarPorcao(produto)
  const bgColor = PLACEHOLDER_BG[produto.categoriaId] ?? '#111111'
  const descricao = DESCRICAO_EMOCIONAL[produto.id] ?? produto.descricao

  const economiza = produto.precoOriginal ? produto.precoOriginal - produto.preco : null
  const precoTotal = produto.preco * quantidade + (comUpsell ? upsellItem.preco : 0)

  function handleAdicionar() {
    if (isCombo) {
      if (comUpsell) {
        for (let i = 0; i < quantidade; i++) adicionarCombo(produto)
      } else {
        for (let i = 0; i < quantidade; i++) adicionarItem(produto, 1, [])
      }
    } else {
      adicionarItem(produto, quantidade, [])
      if (comUpsell) adicionarItem(upsellItem, 1, [])
    }

    sendEventToCRM(sessionId, {
      event: 'add_to_cart',
      data: {
        productId: produto.id,
        productName: produto.nome,
        categoryId: produto.categoriaId,
        unitPrice: produto.preco,
        quantity: quantidade,
        withUpsell: comUpsell,
        sessionId,
      },
    })

    setAdicionado(true)
    setTimeout(() => {
      // Navigate back to previous menu page and restore scroll position
      try {
        const saved = sessionStorage.getItem('returnFrom')
        if (saved) {
          const { route, scrollY } = JSON.parse(saved) as { route: string; scrollY: number }
          sessionStorage.removeItem('returnFrom')
          // Write the target scroll position for the destination page to restore
          sessionStorage.setItem('restoreScrollY', String(scrollY))
          router.push(route)
          return
        }
      } catch {
        // sessionStorage unavailable — fall through to default
      }
      router.push('/cardapio')
    }, 1800)
  }

  return (
    // Outer wrapper: plain div, no animation, no compositing.
    // The fixed CTA must never be inside an animated/composited ancestor on iOS Safari,
    // or its hit-test area breaks. The fade-in is applied to the scrollable content only.
    <div className="min-h-dvh bg-background">
    <motion.main
      className="flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >

      {/* ── Hero image ───────────────────────────────────────────────────── */}
      <div className="relative w-full flex-shrink-0" style={{ height: '310px' }}>
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        <ImageWithFallback
          src={produto.imagens[0] ?? ''}
          alt={produto.nome}
          sizes="100vw"
          fallback={<div className="absolute inset-0" style={{ backgroundColor: bgColor }} />}
        />

        {/* Bottom gradient — deeper so title reads on top */}
        <div
          className="absolute bottom-0 inset-x-0"
          style={{
            height: '180px',
            background: 'linear-gradient(to top, #0A0A0A 15%, rgba(10,10,10,0.65) 55%, transparent 100%)',
          }}
        />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute flex items-center justify-center rounded-full backdrop-blur-sm transition-opacity active:opacity-50"
          style={{
            top: 'calc(env(safe-area-inset-top) + 12px)',
            left: '16px',
            width: '36px',
            height: '36px',
            backgroundColor: 'rgba(10,10,10,0.50)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: 'rgba(245,240,232,0.80)',
          }}
          aria-label="Voltar"
        >
          <IconArrowLeft />
        </button>

        {/* Badges — top right, reduced visual weight */}
        <div
          className="absolute flex flex-col items-end gap-1.5"
          style={{ top: 'calc(env(safe-area-inset-top) + 14px)', right: '14px' }}
        >
          {isPopular && (
            <span
              className="font-sans font-medium px-2.5 py-1 rounded-full backdrop-blur-sm"
              style={{
                fontSize: '10px',
                backgroundColor: 'rgba(201,168,76,0.18)',
                border: '1px solid rgba(201,168,76,0.40)',
                color: 'rgba(201,168,76,0.95)',
              }}
            >
              Mais pedido
            </span>
          )}
          {!isPopular && isChef && (
            <span
              className="font-sans font-medium px-2.5 py-1 rounded-full backdrop-blur-sm"
              style={{
                fontSize: '10px',
                backgroundColor: 'rgba(10,10,10,0.55)',
                border: '1px solid rgba(201,168,76,0.30)',
                color: 'rgba(201,168,76,0.80)',
              }}
            >
              Chef indica
            </span>
          )}
          {economiza && (
            <span
              className="font-sans font-medium px-2.5 py-1 rounded-full backdrop-blur-sm"
              style={{
                fontSize: '10px',
                backgroundColor: 'rgba(10,10,10,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(245,240,232,0.65)',
              }}
            >
              Economize {formatarPreco(economiza)}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-5 pt-5 pb-36">

        {/* Name */}
        <h1 className="font-display text-ivory font-semibold leading-tight" style={{ fontSize: '27px' }}>
          {produto.nome}
        </h1>

        {/* Emotional description */}
        <p className="font-sans mt-2.5 leading-relaxed" style={{ fontSize: '14px', color: 'rgba(245,240,232,0.55)' }}>
          {descricao}
        </p>

        {/* Portion + "favorito" line */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {porcao && (
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: '13px' }}>🍽️</span>
              <span className="font-sans" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.38)' }}>
                {porcao}
              </span>
            </div>
          )}
          {isPopular && (
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: '13px' }}>⭐</span>
              <span className="font-sans" style={{ fontSize: '12px', color: 'rgba(201,168,76,0.60)' }}>
                Um dos favoritos da casa
              </span>
            </div>
          )}
        </div>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <div className="flex items-baseline gap-2.5 mt-4">
          <span className="font-sans font-bold text-gold" style={{ fontSize: '28px' }}>
            {formatarPreco(produto.preco)}
          </span>
          {produto.precoOriginal && (
            <span className="font-sans line-through" style={{ fontSize: '14px', color: 'rgba(245,240,232,0.22)' }}>
              {formatarPreco(produto.precoOriginal)}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="my-5 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />

        {/* ── Quantity selector ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="font-sans font-medium text-ivory" style={{ fontSize: '14px' }}>
            Quantidade
          </span>
          <div className="flex items-center gap-4">
            {/* 44px touch targets — iOS minimum */}
            <button
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="w-11 h-11 rounded-full flex items-center justify-center font-sans font-bold transition-all active:scale-90"
              style={{
                backgroundColor: quantidade <= 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.09)',
                color: quantidade <= 1 ? 'rgba(245,240,232,0.18)' : 'rgba(245,240,232,0.80)',
                fontSize: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="font-sans font-bold text-ivory w-5 text-center" style={{ fontSize: '18px' }}>
              {quantidade}
            </span>
            <button
              onClick={() => setQuantidade((q) => q + 1)}
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{
                backgroundColor: 'rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.28)',
                color: '#C9A84C',
              }}
              aria-label="Aumentar quantidade"
            >
              <IconPlus />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-5 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />

        {/* ── Inline upsell — mini product card ────────────────────────── */}
        <div>
          <p
            className="font-sans font-semibold mb-3 uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.07em', color: 'rgba(245,240,232,0.35)' }}
          >
            Peça também
          </p>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              {/* Product image */}
              <div
                className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden relative"
                style={{ backgroundColor: '#000A16' }}
              >
                <ImageWithFallback
                  src={upsellItem.imagens[0] ?? ''}
                  alt={upsellItem.nome}
                  sizes="56px"
                  fallback={<div className="absolute inset-0" style={{ backgroundColor: '#000A16' }} />}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-ivory leading-tight" style={{ fontSize: '14px' }}>
                  {upsellItem.nome}
                </p>
                {upsellItem.descricaoResumida && (
                  <p className="font-sans mt-0.5" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.38)' }}>
                    {upsellItem.descricaoResumida}
                  </p>
                )}
                <p className="font-sans font-bold text-gold mt-1" style={{ fontSize: '14px' }}>
                  {formatarPreco(upsellItem.preco)}
                </p>
              </div>

              {/* Add / Added toggle button */}
              <button
                onClick={handleUpsellToggle}
                className="flex items-center gap-1.5 flex-shrink-0 rounded-xl px-3.5 py-2.5 font-sans font-bold transition-all duration-150 active:scale-95"
                style={{
                  fontSize: '12px',
                  backgroundColor: comUpsell ? 'rgba(58,122,58,0.20)' : 'rgba(201,168,76,0.13)',
                  border: comUpsell ? '1px solid rgba(58,180,58,0.35)' : '1px solid rgba(201,168,76,0.30)',
                  color: comUpsell ? 'rgba(150,230,150,0.90)' : '#C9A84C',
                }}
                aria-label={comUpsell ? 'Remover bebida' : 'Adicionar bebida'}
              >
                {comUpsell ? (
                  <>
                    <IconCheck size={12} />
                    Adicionado
                  </>
                ) : (
                  <>
                    <IconPlus size={11} />
                    Adicionar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

    </motion.main>

    {/* ── Sticky CTA bar ───────────────────────────────────────────────────
        Intentionally OUTSIDE motion.main. position:fixed elements inside a
        composited ancestor (opacity animation, will-change, etc.) lose their
        viewport anchoring on iOS Safari — taps register on the compositing
        boundary, not on the button. Keeping this as a sibling of the animated
        content, inside a plain non-composited div, fixes the issue.
    ────────────────────────────────────────────────────────────────────────── */}
    <div
      className="fixed bottom-0 inset-x-0 px-5 border-t"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        paddingTop: '12px',
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 50,
      }}
    >
      <button
        onClick={handleAdicionar}
        disabled={adicionado}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-sans font-bold transition-all duration-200 active:scale-[0.98]"
        style={{
          fontSize: '15px',
          backgroundColor: adicionado ? '#2d6b2d' : '#C9A84C',
          color: adicionado ? 'rgba(200,255,200,0.90)' : '#0A0A0A',
        }}
      >
        {adicionado ? (
          <>
            <IconCheck />
            Adicionado ao pedido!
          </>
        ) : (
          <>
            <IconPlus size={13} />
            Adicionar ao pedido — {formatarPreco(precoTotal)}
          </>
        )}
      </button>
    </div>

    </div>
  )
}
