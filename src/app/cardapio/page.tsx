import { menuService } from '@/services/menuService'
import { PageTransition } from '@/components/layout/PageTransition'
import { MenuHeader } from '@/components/menu/MenuHeader'
import { CardapioClient } from '@/components/menu/CardapioClient'
import type { Produto } from '@/types/product'

export default async function CardapioPage({
  searchParams,
}: {
  searchParams: { mesa?: string }
}) {
  const [categorias, todosProdutos] = await Promise.all([
    menuService.getCategorias(),
    // Busca todas as categorias em paralelo e achata em um único array
    menuService.getCategorias().then((cats) =>
      Promise.all(cats.map((c) => menuService.getProdutos(c.slug))).then((arrays) =>
        arrays.flat()
      )
    ),
  ])

  // Categorias ativas, ordenadas
  const categoriasAtivas = categorias
    .filter((c) => c.ativa)
    .sort((a, b) => a.ordemExibicao - b.ordemExibicao)

  // Índice de produtos por slug de categoria
  const produtosPorCategoria: Record<string, Produto[]> = {}
  for (const cat of categoriasAtivas) {
    produtosPorCategoria[cat.slug] = todosProdutos
      .filter((p) => p.categoriaId === cat.id && p.disponivel)
      .sort((a, b) => a.ordemExibicao - b.ordemExibicao)
  }

  // Combos — passados para o destaque separado
  const combos = produtosPorCategoria['combos'] ?? []

  return (
    <PageTransition>
      <main className="min-h-dvh bg-background overflow-x-hidden">
        <MenuHeader mesa={searchParams.mesa} />
        <CardapioClient
          categorias={categoriasAtivas}
          produtosPorCategoria={produtosPorCategoria}
          combos={combos}
        />
      </main>
    </PageTransition>
  )
}
