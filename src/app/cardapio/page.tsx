import Image from 'next/image'
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

        {/* Hero banner + overlapping logo */}
        <div className="relative w-full" style={{ height: 'clamp(180px, 35vw, 220px)' }}>
          {/* Background image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url('/images/hero.jpg.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 100%)' }}
          />
          {/* Overlapping logo */}
          <div
            className="absolute"
            style={{
              bottom: '-30px',
              left: '16px',
              width: 'clamp(70px, 18vw, 90px)',
              height: 'clamp(70px, 18vw, 90px)',
              borderRadius: '9999px',
              border: '3px solid #0A0A0A',
              backgroundColor: '#0A0A0A',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            }}
          >
            <Image
              src="/images/logo.png"
              alt="Marujos Sushi"
              fill
              sizes="90px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* Push content below the overlapping logo */}
        <div style={{ marginTop: '48px' }}>
          <CardapioClient
            categorias={categoriasAtivas}
            produtosPorCategoria={produtosPorCategoria}
            combos={combos}
          />
        </div>
      </main>
    </PageTransition>
  )
}
