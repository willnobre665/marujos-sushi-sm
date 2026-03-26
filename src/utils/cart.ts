import type { ItemCarrinho } from '@/types/cart'

export function calcularSubtotal(itens: ItemCarrinho[]): number {
  return itens.reduce((acc, item) => acc + item.precoTotal, 0)
}

export function calcularTotal(itens: ItemCarrinho[], taxaServico = 0): number {
  return calcularSubtotal(itens) + taxaServico
}

export function calcularQuantidadeTotal(itens: ItemCarrinho[]): number {
  return itens.reduce((acc, item) => acc + item.quantidade, 0)
}

/**
 * Verifica se o carrinho contém algum produto de uma categoria específica.
 */
export function carrinhoTemCategoria(itens: ItemCarrinho[], categoriaId: string): boolean {
  return itens.some((item) => item.produto.categoriaId === categoriaId)
}
