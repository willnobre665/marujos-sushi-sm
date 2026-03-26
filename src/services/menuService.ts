/**
 * menuService — Ponto único de acesso a categorias e produtos.
 *
 * Troca o adapter aqui para alternar entre mock e Saipos.
 * Nenhum componente ou hook precisa mudar.
 */
import { mockMenuAdapter } from './adapters/mockAdapter'
import type { MenuAdapter } from './adapters/types'

// Para usar Saipos no futuro: substituir por saiposMenuAdapter
const adapter: MenuAdapter = mockMenuAdapter

export const menuService = {
  getCategorias: () => adapter.fetchCategorias(),
  getProdutos: (categoriaSlug: string) => adapter.fetchProdutos(categoriaSlug),
  getProdutoPorSlug: (slug: string) => adapter.fetchProdutoPorSlug(slug),
  getProdutosPorIds: (ids: string[]) => adapter.fetchProdutosPorIds(ids),
}
