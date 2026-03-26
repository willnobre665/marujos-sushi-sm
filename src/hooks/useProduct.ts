'use client'

import { useEffect, useState } from 'react'
import { menuService } from '@/services/menuService'
import type { Produto } from '@/types/product'

export function useProduct(slug: string) {
  const [produto, setProduto] = useState<Produto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    menuService
      .getProdutoPorSlug(slug)
      .then(setProduto)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug])

  return { produto, loading, error }
}
