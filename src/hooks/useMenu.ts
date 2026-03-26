'use client'

import { useEffect, useState } from 'react'
import { menuService } from '@/services/menuService'
import type { Categoria, Produto } from '@/types/product'

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    menuService
      .getCategorias()
      .then(setCategorias)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  return { categorias, loading, error }
}

export function useProdutos(categoriaSlug: string) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!categoriaSlug) return
    setLoading(true)
    menuService
      .getProdutos(categoriaSlug)
      .then(setProdutos)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [categoriaSlug])

  return { produtos, loading, error }
}
