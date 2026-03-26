import type { ItemCarrinho } from './cart'
import type { DadosCliente, EnderecoEntrega } from './customer'

export type FormaPagamento =
  | 'pix'
  | 'credito'
  | 'debito'
  | 'dinheiro'
  | 'vr'
  | 'va'

export type StatusPedido =
  | 'recebido'
  | 'em_preparo'
  | 'pronto'
  | 'entregue'
  | 'cancelado'

export interface ItemPedido {
  id: string
  produtoId: string
  produtoNome: string   // snapshot — imutável após criação
  produtoPreco: number  // snapshot do precoUnitario no momento do pedido
  variacoes: string     // texto legível: "16 peças"
  observacao?: string
  quantidade: number
  subtotal: number      // produtoPreco * quantidade
}

export interface NovoPedido {
  itens: ItemCarrinho[]
  mesa?: string                 // presente apenas em modo restaurante (QR code)
  endereco?: EnderecoEntrega    // presente apenas em modo delivery
  cliente: DadosCliente
  formaPagamento: FormaPagamento
  trocoPara?: number    // centavos. Apenas se formaPagamento === 'dinheiro'
  observacaoGeral?: string
}

export interface Pedido {
  id: string
  numeroPedido: number  // sequencial legível: exibido como #0001
  status: StatusPedido
  mesa?: string                 // presente apenas em modo restaurante
  endereco?: EnderecoEntrega    // presente apenas em modo delivery
  cliente: DadosCliente
  itens: ItemPedido[]
  formaPagamento: FormaPagamento
  trocoPara?: number
  observacaoGeral?: string
  subtotal: number
  taxaServico: number
  total: number
  criadoEm: string      // ISO 8601
  saiposPedidoId?: string
  operationId?: string  // 'santa_maria' | 'cacapava_do_sul' — set by server, absent in mock
}
