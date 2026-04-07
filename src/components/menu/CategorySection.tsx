import type { Categoria, Produto } from '@/types/product'
import { ProductCard } from './ProductCard'

interface Props {
  categoria: Categoria
  produtos: Produto[]
  /** Elemento de ancoragem para scroll — passa o ref por data-id */
  id?: string
}

export function CategorySection({ categoria, produtos, id }: Props) {
  if (produtos.length === 0) return null

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
      </div>

      {/* Lista de produtos */}
      <div className="flex flex-col gap-3.5">
        {produtos.map((produto) => (
          <ProductCard key={produto.id} produto={produto} />
        ))}
      </div>
    </section>
  )
}
