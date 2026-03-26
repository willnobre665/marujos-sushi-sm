'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSessionStore } from '@/store/sessionStore'

/**
 * Lê o parâmetro ?mesa=X da URL e salva no sessionStore.
 * Também restaura a mesa do sessionStorage ao recarregar a página.
 */
export function useTableFromUrl() {
  const searchParams = useSearchParams()
  const setMesa = useSessionStore((s) => s.setMesa)
  const mesa = useSessionStore((s) => s.mesa)

  useEffect(() => {
    const mesaUrl = searchParams.get('mesa')

    if (mesaUrl) {
      setMesa(mesaUrl)
      return
    }

    // Restaura do sessionStorage se não veio pela URL
    const mesaSalva = sessionStorage.getItem('marujos-mesa')
    if (mesaSalva && !mesa) {
      setMesa(mesaSalva)
    }
  }, [searchParams, setMesa, mesa])

  return mesa
}
