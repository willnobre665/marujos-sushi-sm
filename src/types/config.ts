import type { TagProduto } from './product'

export interface AnuncioBanner {
  ativo: boolean
  texto: string
  validade?: string  // ISO date. Se vencida, não exibe.
  linkUrl?: string
  linkLabel?: string
}

export interface RestaurantConfig {
  nomeRestaurante: string
  slogan: string
  instagram?: string       // "@marujos.sushi"
  whatsapp?: string        // "5511XXXXXXXXX" — para "Chamar Garçom"
  totalDeMesas: number     // para o seletor de mesa no checkout
  mesasEspeciais?: string[] // ex: ["Varanda", "Privativo"]
  categoriaDestaqueSlug: string
  tempoEstimadoMinutos: number
  taxaServico: number      // centavos. 0 = sem taxa
  anuncio?: AnuncioBanner
  logoUrl: string
  imagemHero: string
}

// --- Upsell ---

export type TipoUpsell =
  | 'complemento_produto'
  | 'relacionado_produto'
  | 'ausencia_categoria'
  | 'combo_por_valor'
  | 'combo_por_quantidade'

export interface RegraUpsellAusenciaCategoria {
  tipo: 'ausencia_categoria'
  categoriaSlug: string
  minimoItensNoCarrinho: number
  maxSugestoes: number
  filtroPorTag?: TagProduto[]
  mensagem: string
}

export interface RegraUpsellComboPorValor {
  tipo: 'combo_por_valor'
  limiteReais: number       // valor do combo em reais (não centavos — legibilidade)
  percentualMinimo: number  // % a partir do qual a barra aparece (0.6 = 60%)
  mensagem: string
  produtoComboId: string
}

export type RegraUpsell = RegraUpsellAusenciaCategoria | RegraUpsellComboPorValor
