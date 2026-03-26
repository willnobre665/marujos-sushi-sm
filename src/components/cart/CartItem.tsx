'use client'

import type { ItemCarrinho } from '@/types/cart'
import { formatarPreco } from '@/utils/currency'
import { useCartStore } from '@/store/cartStore'

interface Props {
  item: ItemCarrinho
  upsellVinculado?: ItemCarrinho
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M5.5 3.5V2.5h3v1M6 6.5v4M8 6.5v4M3 3.5l.7 7.3a.5.5 0 0 0 .5.45h5.6a.5.5 0 0 0 .5-.45L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CartItem({ item, upsellVinculado }: Props) {
  const removerItem = useCartStore((s) => s.removerItem)
  const atualizarQuantidade = useCartStore((s) => s.atualizarQuantidade)

  return (
    <div className="flex flex-col">
      {/* Item principal */}
      <div className="flex items-start gap-3 py-4">
        {/* Quantidade — botões 44px para atingir o mínimo de toque do iOS */}
        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
          <button
            onClick={() => atualizarQuantidade(item.itemId, item.quantidade - 1)}
            className="w-11 h-11 rounded-full flex items-center justify-center font-sans font-bold transition-colors active:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(245,240,232,0.70)', fontSize: '18px' }}
            aria-label="Diminuir"
          >
            −
          </button>
          <span className="font-sans font-bold text-ivory w-5 text-center" style={{ fontSize: '14px' }}>
            {item.quantidade}
          </span>
          <button
            onClick={() => atualizarQuantidade(item.itemId, item.quantidade + 1)}
            className="w-11 h-11 rounded-full flex items-center justify-center font-sans font-bold transition-colors active:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(245,240,232,0.70)', fontSize: '18px' }}
            aria-label="Aumentar"
          >
            +
          </button>
        </div>

        {/* Nome + observação */}
        <div className="flex-1 min-w-0">
          <p className="font-sans font-medium text-ivory leading-tight" style={{ fontSize: '14px' }}>
            {item.produto.nome}
          </p>
          {item.observacao && (
            <p className="font-sans mt-0.5" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.35)' }}>
              {item.observacao}
            </p>
          )}
        </div>

        {/* Preço + remover */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="font-sans font-bold text-gold" style={{ fontSize: '14px' }}>
            {formatarPreco(item.precoTotal)}
          </span>
          {/* Área de toque expandida: 44×44px ao redor do ícone de lixeira */}
          <button
            onClick={() => {
              removerItem(item.itemId)
              if (upsellVinculado) removerItem(upsellVinculado.itemId)
            }}
            className="flex items-center justify-center w-11 h-11 -mr-2 text-ivory/70 hover:text-red-400 transition-colors active:opacity-40"
            aria-label="Remover item"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Upsell vinculado */}
      {upsellVinculado && (
        <div
          className="flex items-center gap-2 mb-3 ml-10 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span style={{ fontSize: '16px' }}>🥤</span>
          <div className="flex-1 min-w-0">
            <p className="font-sans text-ivory/70 leading-tight" style={{ fontSize: '12px' }}>
              {upsellVinculado.produto.nome}
            </p>
          </div>
          <span className="font-sans text-ivory/40 flex-shrink-0" style={{ fontSize: '12px' }}>
            + {formatarPreco(upsellVinculado.precoTotal)}
          </span>
          {/* Padding extra para área de toque mínima no iOS */}
          <button
            onClick={() => removerItem(upsellVinculado.itemId)}
            className="font-sans transition-colors active:opacity-40 flex-shrink-0 py-2 px-1"
            style={{ fontSize: '11px', color: 'rgba(245,240,232,0.28)' }}
            aria-label="Remover bebida"
          >
            Remover
          </button>
        </div>
      )}
    </div>
  )
}
