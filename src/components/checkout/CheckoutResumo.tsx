'use client'

import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'

export function CheckoutResumo() {
  const itens = useCartStore((s) => s.itens)
  const subtotal = useCartStore((s) => s.subtotal)
  const total = useCartStore((s) => s.total)

  const mainItems = itens.filter((i) => !i.vinculadoAoItemId)
  const upsellMap = new Map(
    itens
      .filter((i) => i.vinculadoAoItemId)
      .map((i) => [i.vinculadoAoItemId!, i])
  )

  return (
    <div
      className="mx-5 mt-4 rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#141414' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <p
          className="font-sans font-semibold"
          style={{ fontSize: '11px', color: 'rgba(245,240,232,0.40)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          Resumo do pedido
        </p>
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {mainItems.map((item) => {
          const upsell = upsellMap.get(item.itemId)
          return (
            <div key={item.itemId}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-2 flex-1 min-w-0">
                  <span
                    className="font-sans font-medium flex-shrink-0"
                    style={{ fontSize: '13px', color: 'rgba(201,168,76,0.90)', minWidth: '18px' }}
                  >
                    {item.quantidade}×
                  </span>
                  <span
                    className="font-sans font-medium text-ivory leading-snug truncate"
                    style={{ fontSize: '13px' }}
                  >
                    {item.produto.nome}
                  </span>
                </div>
                <span
                  className="font-sans font-medium flex-shrink-0"
                  style={{ fontSize: '13px', color: 'rgba(245,240,232,0.75)' }}
                >
                  {formatarPreco(item.precoTotal)}
                </span>
              </div>

              {upsell && (
                <div className="flex items-center justify-between mt-1 pl-6">
                  <span
                    className="font-sans"
                    style={{ fontSize: '12px', color: 'rgba(245,240,232,0.35)' }}
                  >
                    + {upsell.produto.nome}
                  </span>
                  <span
                    className="font-sans"
                    style={{ fontSize: '12px', color: 'rgba(245,240,232,0.35)' }}
                  >
                    {formatarPreco(upsell.precoTotal)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <div
        className="px-4 py-3 flex flex-col gap-2 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-sans text-ivory/50" style={{ fontSize: '13px' }}>Subtotal</span>
          <span className="font-sans text-ivory/70" style={{ fontSize: '13px' }}>
            {formatarPreco(subtotal())}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-sans text-ivory/50" style={{ fontSize: '13px' }}>Taxa de serviço</span>
          <span className="font-sans" style={{ fontSize: '13px', color: 'rgba(100,200,100,0.80)' }}>
            Grátis
          </span>
        </div>
        <div
          className="flex items-center justify-between pt-2 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span className="font-sans font-semibold text-ivory" style={{ fontSize: '14px' }}>Total</span>
          <span className="font-sans font-bold text-gold" style={{ fontSize: '16px' }}>
            {formatarPreco(total())}
          </span>
        </div>
      </div>
    </div>
  )
}
