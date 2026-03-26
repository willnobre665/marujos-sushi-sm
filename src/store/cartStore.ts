import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ItemCarrinho, OpcaoVariacaoSelecionada } from '@/types/cart'
import type { Produto } from '@/types/product'
import { UPSELL_BEBIDA } from '@/data/upsellItems'
import { gerarUUID } from '@/utils/uuid'

interface CartState {
  itens: ItemCarrinho[]
  flashAt: number | null  // timestamp (ms) of last add — drives FloatingCartBar flash
  _hasHydrated: boolean   // true after persist rehydrates from localStorage

  adicionarItem: (
    produto: Produto,
    quantidade: number,
    variacoesSelecionadas: OpcaoVariacaoSelecionada[],
    observacao?: string
  ) => void
  adicionarCombo: (combo: Produto) => void
  removerItem: (itemId: string) => void
  atualizarQuantidade: (itemId: string, quantidade: number) => void
  limparCarrinho: () => void

  // Computed
  subtotal: () => number
  total: () => number
  quantidadeTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      itens: [],
      flashAt: null,
      _hasHydrated: false,

      adicionarItem(produto, quantidade, variacoesSelecionadas, observacao) {
        const precoAdicional = variacoesSelecionadas.reduce(
          (acc, v) => acc + v.precoAdicional,
          0
        )
        const precoUnitario = produto.preco + precoAdicional
        const precoTotal = precoUnitario * quantidade

        const novoItem: ItemCarrinho = {
          itemId: gerarUUID(),
          produto,
          quantidade,
          variacoesSelecionadas,
          observacao,
          precoUnitario,
          precoTotal,
        }

        set((state) => ({ itens: [...state.itens, novoItem], flashAt: Date.now() }))
      },

      adicionarCombo(combo) {
        const comboId = gerarUUID()
        const upsellId = gerarUUID()
        const comboItem: ItemCarrinho = {
          itemId: comboId,
          produto: combo,
          quantidade: 1,
          variacoesSelecionadas: [],
          precoUnitario: combo.preco,
          precoTotal: combo.preco,
        }
        const upsellItem: ItemCarrinho = {
          itemId: upsellId,
          produto: UPSELL_BEBIDA,
          quantidade: 1,
          variacoesSelecionadas: [],
          precoUnitario: UPSELL_BEBIDA.preco,
          precoTotal: UPSELL_BEBIDA.preco,
          vinculadoAoItemId: comboId,
        }
        set((state) => ({ itens: [...state.itens, comboItem, upsellItem], flashAt: Date.now() }))
      },

      removerItem(itemId) {
        set((state) => ({
          itens: state.itens.filter((item) => item.itemId !== itemId),
        }))
      },

      atualizarQuantidade(itemId, quantidade) {
        if (quantidade <= 0) {
          get().removerItem(itemId)
          return
        }
        set((state) => ({
          itens: state.itens.map((item) =>
            item.itemId === itemId
              ? { ...item, quantidade, precoTotal: item.precoUnitario * quantidade }
              : item
          ),
        }))
      },

      limparCarrinho() {
        set({ itens: [] })
      },

      subtotal() {
        return get().itens.reduce((acc, item) => acc + item.precoTotal, 0)
      },

      total() {
        return get().subtotal() // sem taxa de serviço no MVP
      },

      quantidadeTotal() {
        return get().itens.reduce((acc, item) => acc + item.quantidade, 0)
      },
    }),
    {
      name: 'marujos-carrinho',
      partialize: (state) => ({ itens: state.itens }),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true
      },
    }
  )
)
