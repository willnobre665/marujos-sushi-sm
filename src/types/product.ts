export type TagProduto =
  | 'popular'
  | 'novo'
  | 'vegano'
  | 'vegetariano'
  | 'picante'
  | 'sem-gluten'
  | 'promocao'
  | 'destaque-chef'

export type Alergeno =
  | 'gluten'
  | 'lactose'
  | 'frutos-do-mar'
  | 'soja'
  | 'amendoim'
  | 'ovos'
  | 'sesamo'

export interface InformacaoNutricional {
  calorias: number      // kcal
  proteinas: number     // g
  carboidratos: number  // g
  gorduras: number      // g
  porcao: string        // ex: "8 peças (220g)"
}

export interface OpcaoVariacao {
  id: string
  label: string          // "8 peças", "16 peças", "Pequeno", "Grande"
  precoAdicional: number // centavos. 0 se não altera o preço
}

export interface Variacao {
  id: string
  nome: string           // "Tamanho", "Acompanhamento"
  obrigatoria: boolean
  opcoes: OpcaoVariacao[]
}

export interface Produto {
  id: string
  nome: string
  slug: string
  descricao: string
  descricaoResumida: string        // até 80 caracteres, para o card
  preco: number                    // centavos, preço base
  precoOriginal?: number           // centavos, exibir riscado se preço < precoOriginal
  categoriaId: string
  subcategoriaId?: string
  imagens: string[]                // URLs. Primeiro é a imagem principal.
  tags: TagProduto[]
  alergenos: Alergeno[]
  informacaoNutricional?: InformacaoNutricional
  variacoes?: Variacao[]
  produtosComplementares: string[] // IDs — bebidas/entradas que harmonizam
  produtosRelacionados: string[]   // IDs — "quem pediu também pediu"
  disponivel: boolean
  destaqueNaCategoria: boolean
  ordemExibicao: number
  saiposId?: string
  saiposCodigo?: string
}

export interface Subcategoria {
  id: string
  nome: string
  categoriaId: string
  ordemExibicao: number
}

export interface Categoria {
  id: string
  nome: string
  slug: string
  descricao?: string
  imagemCapa: string     // URL
  corDestaque?: string   // hex, para acento visual no card
  ordemExibicao: number
  ativa: boolean
  subcategorias?: Subcategoria[]
  saiposId?: string
}
