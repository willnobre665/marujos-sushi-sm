'use client'

import { useCartStore } from '@/store/cartStore'
import type { OpcaoVariacaoSelecionada } from '@/types/cart'
import type { Produto } from '@/types/product'

export function useCart() {
  const itens = useCartStore((s) => s.itens)
  const adicionarItem = useCartStore((s) => s.adicionarItem)
  const removerItem = useCartStore((s) => s.removerItem)
  const atualizarQuantidade = useCartStore((s) => s.atualizarQuantidade)
  const limparCarrinho = useCartStore((s) => s.limparCarrinho)
  const subtotalFn = useCartStore((s) => s.subtotal)
  const totalFn = useCartStore((s) => s.total)
  const quantidadeTotalFn = useCartStore((s) => s.quantidadeTotal)

  const adicionarAoCarrinho = (
    produto: Produto,
    quantidade = 1,
    variacoesSelecionadas: OpcaoVariacaoSelecionada[] = [],
    observacao?: string
  ) => {
    adicionarItem(produto, quantidade, variacoesSelecionadas, observacao)
  }

  return {
    itens,
    subtotal: subtotalFn(),
    total: totalFn(),
    quantidadeTotal: quantidadeTotalFn(),
    adicionarAoCarrinho,
    removerItem,
    atualizarQuantidade,
    limparCarrinho,
    estaVazio: itens.length === 0,
  }
}
