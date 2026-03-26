import type { ItemCarrinho } from '@/types/cart'
import type { Produto, Categoria } from '@/types/product'
import type { RegraUpsell, RegraUpsellAusenciaCategoria, RegraUpsellComboPorValor } from '@/types/config'
import { calcularSubtotal, carrinhoTemCategoria } from './cart'

export interface ResultadoUpsellAusencia {
  tipo: 'ausencia_categoria'
  regra: RegraUpsellAusenciaCategoria
  sugestoes: Produto[]
}

export interface ResultadoUpsellCombo {
  tipo: 'combo_por_valor'
  regra: RegraUpsellComboPorValor
  subtotalAtual: number
  valorFaltante: number
  percentual: number
  produtoCombo: Produto | undefined
}

export type ResultadoUpsell = ResultadoUpsellAusencia | ResultadoUpsellCombo

/**
 * Avalia todas as regras de upsell contra o estado atual do carrinho.
 * Retorna apenas as regras que devem ser exibidas.
 */
export function avaliarRegrasDeUpsell(
  itens: ItemCarrinho[],
  regras: RegraUpsell[],
  todosProdutos: Produto[],
  todasCategorias: Categoria[]
): ResultadoUpsell[] {
  const resultados: ResultadoUpsell[] = []
  const subtotal = calcularSubtotal(itens)
  const idsNoCarrinho = new Set(itens.map((i) => i.produto.id))

  for (const regra of regras) {
    if (regra.tipo === 'ausencia_categoria') {
      if (itens.length < regra.minimoItensNoCarrinho) continue

      const categoria = todasCategorias.find((c) => c.slug === regra.categoriaSlug)
      if (!categoria) continue

      if (carrinhoTemCategoria(itens, categoria.id)) continue

      let candidatos = todosProdutos.filter(
        (p) => p.categoriaId === categoria.id && p.disponivel && !idsNoCarrinho.has(p.id)
      )

      if (regra.filtroPorTag && regra.filtroPorTag.length > 0) {
        candidatos = candidatos.filter((p) =>
          regra.filtroPorTag!.some((tag) => p.tags.includes(tag))
        )
      }

      const sugestoes = candidatos.slice(0, regra.maxSugestoes)
      if (sugestoes.length > 0) {
        resultados.push({ tipo: 'ausencia_categoria', regra, sugestoes })
      }
    }

    if (regra.tipo === 'combo_por_valor') {
      const limiteEmCentavos = regra.limiteReais * 100
      const percentual = subtotal / limiteEmCentavos

      if (percentual >= regra.percentualMinimo && percentual < 1) {
        const produtoCombo = todosProdutos.find((p) => p.id === regra.produtoComboId)
        resultados.push({
          tipo: 'combo_por_valor',
          regra,
          subtotalAtual: subtotal,
          valorFaltante: limiteEmCentavos - subtotal,
          percentual,
          produtoCombo,
        })
      }
    }
  }

  return resultados
}
