'use client'

import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'
import { UPSELL_SOBREMESA, UPSELL_BEBIDA } from '@/data/upsellItems'
import type { Produto } from '@/types/product'

// ─── Threshold ────────────────────────────────────────────────────────────────
// Must match CartProgressBar so the incentive message is consistent across pages.
const TARGET = 12000 // R$ 120

// ─── Add-on catalogue ─────────────────────────────────────────────────────────
// Static for MVP — will be dynamic with Saipos integration.

const ADDONS: Produto[] = [
  UPSELL_BEBIDA,
  {
    id:                     'prod-hot-filadelfia',
    nome:                   'Hot Filadélfia',
    slug:                   'hot-filadelfia',
    descricao:              'Uramaki empanado com salmão, cream cheese e cebolinha. 8 unidades.',
    descricaoResumida:      '8 un. · salmão, cream cheese',
    preco:                  2490,
    categoriaId:            'cat-uramakis',
    imagens:                [],
    tags:                   [],
    alergenos:              ['gluten', 'lactose'],
    produtosComplementares: [],
    produtosRelacionados:   [],
    disponivel:             true,
    destaqueNaCategoria:    false,
    ordemExibicao:          2,
  },
  UPSELL_SOBREMESA,
]

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 6.5l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Progress incentive bar ───────────────────────────────────────────────────

function CheckoutProgressBar() {
  const total = useCartStore((s) => s.total)
  const totalAtual = total()
  const completed  = totalAtual >= TARGET
  const faltam     = TARGET - totalAtual
  const progresso  = Math.min(100, Math.round((totalAtual / TARGET) * 100))

  return (
    <div
      className="rounded-2xl px-4 py-3.5 mb-4"
      style={{
        backgroundColor: completed ? 'rgba(201,168,76,0.07)' : '#141414',
        border: completed
          ? '1px solid rgba(201,168,76,0.25)'
          : '1px solid rgba(255,255,255,0.07)',
        transition: 'border-color 0.4s ease, background-color 0.4s ease',
      }}
    >
      {/* Message */}
      <p
        className="font-sans leading-snug mb-3"
        style={{
          fontSize: '12px',
          color: completed ? 'rgba(201,168,76,0.90)' : 'rgba(245,240,232,0.65)',
          transition: 'color 0.4s ease',
        }}
      >
        {completed ? (
          'Pedido completo — ótima escolha 🍣'
        ) : (
          <>
            Adicione mais{' '}
            <span className="font-semibold" style={{ color: 'rgba(245,240,232,0.90)' }}>
              {formatarPreco(faltam)}
            </span>{' '}
            e complete sua experiência 🍣
          </>
        )}
      </p>

      {/* Bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.07)' }}
        role="progressbar"
        aria-valuenow={progresso}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progresso}%`,
            background: completed
              ? 'linear-gradient(to right, #C9A84C, #e8c96a)'
              : 'linear-gradient(to right, rgba(201,168,76,0.45), #C9A84C)',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Single add-on row ────────────────────────────────────────────────────────

function AddonRow({ addon }: { addon: Produto }) {
  const adicionarItem = useCartStore((s) => s.adicionarItem)
  const removerItem   = useCartStore((s) => s.removerItem)

  const [itemId, setItemId] = useState<string | null>(null)
  const selected = itemId !== null

  function toggle() {
    if (selected) {
      removerItem(itemId!)
      setItemId(null)
    } else {
      // adicionarItem is synchronous — getState() immediately reflects the new item.
      // The new item is always appended last, so itens.at(-1) is reliable here.
      adicionarItem(addon, 1, [])
      const newItem = useCartStore.getState().itens.at(-1)
      if (newItem) setItemId(newItem.itemId)
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200"
      style={{
        backgroundColor: selected ? 'rgba(201,168,76,0.07)' : '#1A1A1A',
        border: selected
          ? '1px solid rgba(201,168,76,0.35)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="font-sans font-medium leading-tight"
          style={{ fontSize: '13px', color: selected ? '#C9A84C' : 'rgba(245,240,232,0.90)' }}
        >
          {addon.nome}
        </p>
        <p
          className="font-sans mt-0.5"
          style={{ fontSize: '11px', color: 'rgba(245,240,232,0.35)' }}
        >
          {addon.descricaoResumida}
        </p>
      </div>

      {/* Price */}
      <span
        className="font-sans font-semibold flex-shrink-0"
        style={{ fontSize: '13px', color: selected ? '#C9A84C' : 'rgba(245,240,232,0.60)' }}
      >
        {formatarPreco(addon.preco)}
      </span>

      {/* Toggle */}
      <button
        type="button"
        onClick={toggle}
        className="flex-shrink-0 flex items-center gap-1.5 rounded-xl font-sans font-semibold transition-all duration-150 active:scale-95"
        style={{
          fontSize: '11px',
          padding: '7px 12px',
          backgroundColor: selected ? 'rgba(58,122,58,0.22)' : 'rgba(201,168,76,0.13)',
          border: selected ? '1px solid rgba(58,180,58,0.35)' : '1px solid rgba(201,168,76,0.28)',
          color: selected ? 'rgba(150,230,150,0.90)' : '#C9A84C',
          whiteSpace: 'nowrap',
        }}
        aria-label={selected ? `Remover ${addon.nome}` : `Adicionar ${addon.nome}`}
      >
        {selected ? <IconCheck /> : <IconPlus />}
        {selected ? 'Adicionado' : 'Adicionar'}
      </button>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function CheckoutUpsell() {
  return (
    <section>
      {/* Section header */}
      <p
        className="font-sans font-semibold mb-1"
        style={{ fontSize: '15px', color: 'rgba(245,240,232,0.90)' }}
      >
        Complete seu pedido
      </p>
      <p
        className="font-sans mb-4"
        style={{ fontSize: '12px', color: 'rgba(245,240,232,0.38)' }}
      >
        Adicione itens antes de confirmar
      </p>

      {/* Progress incentive */}
      <CheckoutProgressBar />

      {/* Add-on rows */}
      <div className="flex flex-col gap-2">
        {ADDONS.map((addon) => (
          <AddonRow key={addon.id} addon={addon} />
        ))}
      </div>
    </section>
  )
}
