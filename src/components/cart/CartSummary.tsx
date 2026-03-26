'use client'

import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'

export function CartSummary() {
  const total = useCartStore((s) => s.total)

  return (
    <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        <span className="font-sans text-ivory/50" style={{ fontSize: '13px' }}>
          Total
        </span>
        <span className="font-sans font-bold text-ivory" style={{ fontSize: '20px' }}>
          {formatarPreco(total())}
        </span>
      </div>
      <p className="font-sans mt-1" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.25)' }}>
        Sem taxa de serviço — pague ao garçom
      </p>
    </div>
  )
}
