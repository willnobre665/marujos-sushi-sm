'use client'

// Placeholder para sistema de toast.
// Implementar com estado global em Fase 1 se necessário.
// Por ora, exporta o tipo e uma função stub.

export interface ToastOptions {
  mensagem: string
  tipo?: 'sucesso' | 'erro' | 'info'
  duracao?: number
}

// TODO Fase 1: implementar toast real com portal e animação
export function showToast(_options: ToastOptions) {
  // Stub — será implementado na Fase 1
  if (typeof window !== 'undefined') {
    console.info('[Toast]', _options.mensagem)
  }
}
