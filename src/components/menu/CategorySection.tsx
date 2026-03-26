import Link from 'next/link'
import type { Categoria, Produto } from '@/types/product'
import { ProductCard } from './ProductCard'

interface Props {
  categoria: Categoria
  produtos: Produto[]
  /** Elemento de ancoragem para scroll — passa o ref por data-id */
  id?: string
}

function IconArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6h7M6.5 3 9.5 6l-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CategorySection({ categoria, produtos, id }: Props) {
  if (produtos.length === 0) return null

  // Mostra até 4 produtos por padrão; link "Ver todos" dá acesso ao restante
  const preview = produtos.slice(0, 4)
  const temMais = produtos.length > 4

  return (
    <section id={id} className="px-4 pt-5 pb-2">

      {/* Cabeçalho da categoria */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2
            className="font-display text-ivory font-semibold italic leading-none"
            style={{ fontSize: '18px' }}
          >
            {categoria.nome}
          </h2>
          {categoria.descricao && (
            <p
              className="text-ivory/25 font-sans mt-0.5"
              style={{ fontSize: '10px' }}
            >
              {categoria.descricao}
            </p>
          )}
        </div>

        <Link
          href={`/cardapio/${categoria.slug}`}
          className="text-gold/55 font-sans hover:text-gold/80 transition-colors flex items-center gap-1 pb-0.5"
          style={{ fontSize: '11px' }}
        >
          Ver todos
          <IconArrow />
        </Link>
      </div>

      {/* Lista de produtos */}
      <div className="flex flex-col gap-3.5">
        {preview.map((produto) => (
          <ProductCard key={produto.id} produto={produto} />
        ))}
      </div>

      {/* Link extra se tiver mais de 4 produtos */}
      {temMais && (
        <Link
          href={`/cardapio/${categoria.slug}`}
          className="flex items-center justify-center gap-2 mt-4 py-3 rounded-2xl hover:opacity-70 transition-opacity"
          style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: '#181818' }}
        >
          <span className="text-ivory/35 font-sans uppercase" style={{ fontSize: '10px', letterSpacing: '0.35em' }}>
            Ver todos os {categoria.nome.toLowerCase()}
          </span>
          <IconArrow />
        </Link>
      )}
    </section>
  )
}
