'use client'

import { useState } from 'react'
import { surveyService } from '@/services/surveyService'
import type { NovaPesquisa, PesquisaSatisfacao } from '@/types/survey'

export function useSurvey() {
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [pesquisa, setPesquisa] = useState<PesquisaSatisfacao | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const enviarPesquisa = async (dados: NovaPesquisa) => {
    setLoading(true)
    setError(null)

    try {
      const resultado = await surveyService.enviarPesquisa(dados)
      setPesquisa(resultado)
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao enviar pesquisa'))
    } finally {
      setLoading(false)
    }
  }

  return { enviarPesquisa, loading, enviado, pesquisa, error }
}
