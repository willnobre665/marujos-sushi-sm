import { create } from 'zustand'
import type { DadosCliente } from '@/types/customer'

interface SessionState {
  mesa?: string
  cliente?: DadosCliente
  pedidoAtualId?: string

  setMesa: (mesa: string) => void
  setCliente: (cliente: DadosCliente) => void
  setPedidoAtualId: (id: string) => void
  limparSessao: () => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  mesa: undefined,
  cliente: undefined,
  pedidoAtualId: undefined,

  setMesa(mesa) {
    set({ mesa })
    // Persiste a mesa em sessionStorage para não perder ao recarregar
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('marujos-mesa', mesa)
    }
  },

  setCliente(cliente) {
    set({ cliente })
  },

  setPedidoAtualId(id) {
    set({ pedidoAtualId: id })
  },

  limparSessao() {
    set({ cliente: undefined, pedidoAtualId: undefined })
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('marujos-mesa')
    }
  },
}))
