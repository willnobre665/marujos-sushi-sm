import type { DadosCliente } from './customer'

export interface AvaliacaoCategoria {
  qualidadePratos: number  // 1 a 5
  atendimento: number      // 1 a 5
  tempoDeEspera: number    // 1 a 5
  ambiente: number         // 1 a 5
}

export type CanalPesquisa = 'link_confirmacao' | 'qr_code_mesa' | 'whatsapp'

export interface NovaPesquisa {
  pedidoId: string
  cliente: DadosCliente
  nps: number // 0 a 10
  avaliacoes: AvaliacaoCategoria
  comentarioMelhoria?: string
  comentarioPositivo?: string
  canal: CanalPesquisa
}

export interface PesquisaSatisfacao extends NovaPesquisa {
  id: string
  criadoEm: string // ISO 8601
}
