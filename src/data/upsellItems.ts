import type { Produto } from '@/types/product'

// Upsell fixo por enquanto — será dinâmico na integração com Saipos
export const UPSELL_SOBREMESA: Produto = {
  id: 'prod-sorvete-matcha',
  nome: 'Sorvete de Matcha',
  slug: 'sorvete-matcha',
  descricao: 'Sorvete artesanal de chá verde matcha com cobertura de calda de red velvet. 2 bolas.',
  descricaoResumida: 'Sorvete artesanal de matcha — 2 bolas',
  preco: 1890,
  categoriaId: 'cat-sobremesas',
  imagens: ['https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80'],
  tags: ['popular', 'destaque-chef'],
  alergenos: ['lactose'],
  produtosComplementares: [],
  produtosRelacionados: [],
  disponivel: true,
  destaqueNaCategoria: false,
  ordemExibicao: 1,
}

export const UPSELL_BEBIDA: Produto = {
  id: 'prod-refrigerante',
  nome: 'Refrigerante Lata',
  slug: 'refrigerante',
  descricao: 'Coca-Cola, Guaraná Antarctica ou Sprite. Lata 350ml.',
  descricaoResumida: 'Coca-Cola, Guaraná ou Sprite — 350ml',
  preco: 790,
  categoriaId: 'cat-bebidas',
  imagens: ['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80'],
  tags: [],
  alergenos: [],
  produtosComplementares: [],
  produtosRelacionados: [],
  disponivel: true,
  destaqueNaCategoria: false,
  ordemExibicao: 4,
}
