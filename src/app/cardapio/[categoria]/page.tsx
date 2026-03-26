import { notFound } from 'next/navigation'
import { menuService } from '@/services/menuService'
import { PageTransition } from '@/components/layout/PageTransition'
import { CategoriaHeader } from '@/components/menu/CategoriaHeader'
import { CategoriaClient } from '@/components/menu/CategoriaClient'

interface Props {
  params: { categoria: string }
  searchParams: { mesa?: string }
}

export default async function CategoriaPage({ params, searchParams }: Props) {
  const [categorias, produtos] = await Promise.all([
    menuService.getCategorias(),
    menuService.getProdutos(params.categoria),
  ])

  const categoriaAtiva = categorias.find((c) => c.slug === params.categoria)
  if (!categoriaAtiva) notFound()

  const produtosDisponiveis = produtos
    .filter((p) => p.disponivel)
    .sort((a, b) => a.ordemExibicao - b.ordemExibicao)

  return (
    <PageTransition>
      <main className="min-h-dvh bg-background overflow-x-hidden">
        <CategoriaHeader
          nomeCategoria={categoriaAtiva.nome}
          descricao={categoriaAtiva.descricao}
          mesa={searchParams.mesa}
        />
        <CategoriaClient
          categorias={categorias}
          categoriaAtiva={categoriaAtiva}
          produtos={produtosDisponiveis}
        />
      </main>
    </PageTransition>
  )
}
