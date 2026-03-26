'use client'

import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'
import { UPSELL_BEBIDA, UPSELL_SOBREMESA } from '@/data/upsellItems'
import type { Produto } from '@/types/product'
import type { ItemCarrinho } from '@/types/cart'

// ─── Upsell catalog ──────────────────────────────────────────────────────────
// Produtos sugeridos — serão dinâmicos na integração Saipos.

const UPSELL_ENTRADA: Produto = {
  id: 'prod-missoshiru',
  nome: 'Missoshiru',
  slug: 'missoshiru',
  descricao: 'Sopa de missô tradicional com tofu, alga wakame e cebolinha.',
  descricaoResumida: 'Sopa de missô com tofu e alga wakame',
  preco: 890,
  categoriaId: 'cat-entradas',
  imagens: [],
  tags: ['popular'],
  alergenos: ['soja'],
  produtosComplementares: [],
  produtosRelacionados: [],
  disponivel: true,
  destaqueNaCategoria: false,
  ordemExibicao: 1,
}

// ─── Context logic ────────────────────────────────────────────────────────────
// Regras de sugestão. Sempre retorna pelo menos bebida + sobremesa para
// garantir que a seção nunca desapareça enquanto há itens no carrinho.

interface Sugestao {
  produto: Produto
  motivo: string // copy contextual curto
}

function getSugestoes(itens: ItemCarrinho[]): Sugestao[] {
  if (itens.length === 0) return []

  const categoriaIds = new Set(itens.map((i) => i.produto.categoriaId))
  const temBebida    = categoriaIds.has('cat-bebidas')
  const temSobremesa = categoriaIds.has('cat-sobremesas')
  const temEntrada   = categoriaIds.has('cat-entradas')
  const somenteComBebida = categoriaIds.size === 1 && temBebida

  const sugestoes: Sugestao[] = []

  // Bebida — sugere sempre que não tiver (exceto carrinho só com bebida)
  if (!temBebida && !somenteComBebida) {
    sugestoes.push({ produto: UPSELL_BEBIDA, motivo: 'Harmonize com uma bebida' })
  }

  // Entrada — sugere se ainda não tem
  if (!temEntrada) {
    sugestoes.push({ produto: UPSELL_ENTRADA, motivo: 'Comece com uma entrada' })
  }

  // Sobremesa — sugere sempre que não tiver
  if (!temSobremesa) {
    sugestoes.push({ produto: UPSELL_SOBREMESA, motivo: 'Finalize com uma sobremesa' })
  }

  // Fallback: se bebida já está e sobremesa também, mas entrada não → garante pelo menos 1
  // (coberto pelas regras acima — nunca chega zerado com itens no carrinho)

  return sugestoes.slice(0, 3)
}

// ─── Mini card ────────────────────────────────────────────────────────────────

function UpsellCard({ sugestao }: { sugestao: Sugestao }) {
  const adicionarItem = useCartStore((s) => s.adicionarItem)
  const itens = useCartStore((s) => s.itens)
  const [added, setAdded] = useState(false)

  // Não exibe se já está no carrinho
  const jaNoCarrinho = itens.some((i) => i.produto.id === sugestao.produto.id)
  if (jaNoCarrinho) return null

  function handleAdd() {
    adicionarItem(sugestao.produto, 1, [])
    setAdded(true)
    // Reset visual após 1.5s (caso removam e queiram ver de novo)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col justify-between rounded-2xl p-3.5 hover:scale-[1.02] transition-all duration-150 cursor-pointer"
      style={{
        width: '148px',
        backgroundColor: '#161616',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Motivo contextual */}
      <p
        className="font-sans uppercase tracking-wider mb-2"
        style={{ fontSize: '8px', color: 'rgba(201,168,76,0.65)', letterSpacing: '0.07em' }}
      >
        {sugestao.motivo}
      </p>

      {/* Nome */}
      <p
        className="font-sans font-semibold text-ivory leading-tight"
        style={{ fontSize: '13px' }}
      >
        {sugestao.produto.nome}
      </p>

      {/* Descrição curta */}
      <p
        className="font-sans mt-1 leading-snug"
        style={{
          fontSize: '10px',
          color: 'rgba(245,240,232,0.40)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {sugestao.produto.descricaoResumida}
      </p>

      {/* Preço + botão */}
      <div className="flex items-center justify-between mt-3">
        <span className="font-sans font-bold text-gold" style={{ fontSize: '13px' }}>
          {formatarPreco(sugestao.produto.preco)}
        </span>

        <button
          type="button"
          onClick={handleAdd}
          disabled={added}
          className="flex items-center justify-center rounded-xl active:scale-90 transition-all duration-150"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: added ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.12)',
            border: `1px solid ${added ? 'rgba(201,168,76,0.45)' : 'rgba(201,168,76,0.25)'}`,
            color: added ? '#C9A84C' : 'rgba(201,168,76,0.75)',
          }}
          aria-label={`Adicionar ${sugestao.produto.nome}`}
        >
          {added ? (
            // checkmark
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2.5 7.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            // plus
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CartUpsell() {
  const itens = useCartStore((s) => s.itens)

  // Só sugestões de itens principais (ignora upsells vinculados)
  const mainItens = itens.filter((i) => !i.vinculadoAoItemId)
  // getSugestoes já filtra por categoria presente; UpsellCard oculta individualmente
  // os itens que já estão no carrinho — sem corte duplo aqui.
  const sugestoesVisiveis = getSugestoes(mainItens)

  if (sugestoesVisiveis.length === 0) return null

  return (
    <div className="pt-5 pb-1">
      {/* Header */}
      <p
        className="font-sans font-semibold px-5 mb-3"
        style={{
          fontSize: '11px',
          color: 'rgba(245,240,232,0.38)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        Combine com isso
      </p>

      {/* Scroll horizontal */}
      <div
        className="flex gap-3 overflow-x-auto px-5"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '4px', // evita corte da sombra dos cards
        }}
      >
        {sugestoesVisiveis.map((s) => (
          <UpsellCard key={s.produto.id} sugestao={s} />
        ))}
      </div>
    </div>
  )
}
