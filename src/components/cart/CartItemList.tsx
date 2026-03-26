'use client'

import { useCartStore } from '@/store/cartStore'
import { CartItem } from './CartItem'

export function CartItemList() {
  const itens = useCartStore((s) => s.itens)

  // Separate upsell items (linked) from main items
  const upsellMap = new Map(
    itens
      .filter((i) => i.vinculadoAoItemId)
      .map((i) => [i.vinculadoAoItemId!, i])
  )
  const mainItems = itens.filter((i) => !i.vinculadoAoItemId)

  return (
    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      {mainItems.map((item) => (
        <CartItem
          key={item.itemId}
          item={item}
          upsellVinculado={upsellMap.get(item.itemId)}
        />
      ))}
    </div>
  )
}
