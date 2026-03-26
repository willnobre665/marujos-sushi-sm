import { notFound } from 'next/navigation'
import { menuService } from '@/services/menuService'
import { ProdutoClient } from '@/components/menu/ProdutoClient'
import { UPSELL_BEBIDA } from '@/data/upsellItems'

interface Props {
  params: { categoria: string; produto: string }
}

export default async function ProdutoPage({ params }: Props) {
  const produto = await menuService.getProdutoPorSlug(params.produto)
  if (!produto || !produto.disponivel) notFound()

  // PageTransition is intentionally NOT used here.
  // Wrapping ProdutoClient in a motion.div (even opacity-only) creates a
  // compositing layer on iOS Safari that breaks position:fixed on the sticky
  // CTA — the button renders correctly but tap events don't reach it because
  // the hit-test area is anchored to the composited ancestor, not the viewport.
  // The fade-in is handled inside ProdutoClient on the scrollable content only.
  return <ProdutoClient produto={produto} upsellItem={UPSELL_BEBIDA} />
}
