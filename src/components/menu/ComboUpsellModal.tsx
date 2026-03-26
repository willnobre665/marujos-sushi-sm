'use client'

import { useEffect } from 'react'
import type { Produto } from '@/types/product'
import { formatarPreco } from '@/utils/currency'
import { useCartStore } from '@/store/cartStore'

// Upsell fixo por enquanto — será dinâmico na integração com Saipos
const UPSELL_ITEM: Pick<Produto, 'id' | 'nome' | 'descricaoResumida' | 'preco' | 'categoriaId' | 'imagens' | 'tags' | 'alergenos' | 'produtosComplementares' | 'produtosRelacionados' | 'disponivel' | 'destaqueNaCategoria' | 'ordemExibicao' | 'slug' | 'descricao'> = {
  id: 'prod-refrigerante',
  nome: 'Refrigerante Lata',
  slug: 'refrigerante',
  descricao: 'Coca-Cola, Guaraná Antarctica ou Sprite. Lata 350ml.',
  descricaoResumida: 'Coca-Cola, Guaraná ou Sprite — 350ml',
  preco: 790,
  categoriaId: 'cat-bebidas',
  imagens: ['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80'],
  tags: [],
  alergenos: [],
  produtosComplementares: [],
  produtosRelacionados: [],
  disponivel: true,
  destaqueNaCategoria: false,
  ordemExibicao: 4,
}

interface Props {
  combo: Produto
  onClose: () => void
}

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ComboUpsellModal({ combo, onClose }: Props) {
  const adicionarItem = useCartStore((s) => s.adicionarItem)

  // Fechar com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Travar scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleSoOCombo() {
    adicionarItem(combo, 1, [])
    onClose()
  }

  function handleComBebida() {
    adicionarItem(combo, 1, [])
    adicionarItem(UPSELL_ITEM as Produto, 1, [])
    onClose()
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
      onClick={onClose}
    >
      {/* Sheet — clique dentro não fecha */}
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Puxador */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-3 pb-4">
          <div>
            <h2
              className="font-display text-ivory font-semibold leading-tight"
              style={{ fontSize: '20px' }}
            >
              Quer completar seu pedido?
            </h2>
            <p className="text-ivory/35 font-sans mt-1" style={{ fontSize: '12px' }}>
              Adicionado: <span className="text-ivory/55">{combo.nome}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 mt-0.5 text-ivory/30 hover:text-ivory/60 transition-colors"
            aria-label="Fechar"
          >
            <IconX />
          </button>
        </div>

        {/* Divisor */}
        <div className="mx-5 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* Upsell item */}
        <div className="px-5 py-4">
          <div
            className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
            style={{ backgroundColor: '#1C1C1C', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Ícone de bebida */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#000A16' }}
            >
              <span style={{ fontSize: '22px' }}>🥤</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-ivory font-sans font-medium" style={{ fontSize: '14px' }}>
                {UPSELL_ITEM.nome}
              </p>
              <p className="text-ivory/35 font-sans mt-0.5" style={{ fontSize: '11px' }}>
                Gelada, perfeita pra acompanhar
              </p>
            </div>

            <span className="text-gold font-sans font-bold flex-shrink-0" style={{ fontSize: '15px' }}>
              + {formatarPreco(UPSELL_ITEM.preco)}
            </span>
          </div>

        </div>

        {/* Ações */}
        <div className="px-5 pb-5 flex flex-col gap-2.5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
          {/* Primário — com bebida */}
          <button
            onClick={handleComBebida}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-sans font-bold active:scale-[0.98] transition-transform duration-150"
            style={{ fontSize: '15px', backgroundColor: '#C9A84C', color: '#0A0A0A' }}
          >
            <IconPlus />
            Completar com bebida por + R$ 7,90
          </button>

          {/* Secundário — só o combo */}
          <button
            onClick={handleSoOCombo}
            className="w-full flex items-center justify-center rounded-2xl py-4 font-sans font-medium active:scale-[0.98] transition-transform duration-150"
            style={{ fontSize: '14px', color: 'rgba(245,240,232,0.55)', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            Só o combo
          </button>
        </div>
      </div>
    </div>
  )
}
