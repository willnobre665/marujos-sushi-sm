import type { Produto } from './product'

export interface OpcaoVariacaoSelecionada {
  variacaoId: string
  variacaoNome: string
  opcaoId: string
  opcaoLabel: string
  precoAdicional: number // centavos
}

export interface ItemCarrinho {
  itemId: string                             // UUID único do item no carrinho
  produto: Produto                           // snapshot completo no momento da adição
  quantidade: number
  variacoesSelecionadas: OpcaoVariacaoSelecionada[]
  observacao?: string                        // "sem pepino, mais pimenta"
  precoUnitario: number                      // centavos: preco base + soma precoAdicional
  precoTotal: number                         // precoUnitario * quantidade
  vinculadoAoItemId?: string                 // se preenchido, este item é upsell vinculado ao pai
}

export interface Carrinho {
  itens: ItemCarrinho[]
  subtotal: number       // soma de precoTotal de todos os itens
  total: number          // subtotal + taxaServico (sem entrega — nunca)
  taxaServico: number    // centavos. 0 no MVP.
  quantidadeTotal: number // soma das quantidades
}
