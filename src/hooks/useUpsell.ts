'use client'

import { useMemo } from 'react'
import { upsellRules } from '@/data/upsellRules'
import { categories } from '@/data/categories'
import { products } from '@/data/products'
import { avaliarRegrasDeUpsell } from '@/utils/upsell'
import type { ItemCarrinho } from '@/types/cart'

export function useUpsell(itens: ItemCarrinho[]) {
  const resultados = useMemo(
    () => avaliarRegrasDeUpsell(itens, upsellRules, products, categories),
    [itens]
  )

  return { resultados }
}
