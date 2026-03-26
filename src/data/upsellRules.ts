import type { RegraUpsell } from '@/types/config'

export const upsellRules: RegraUpsell[] = [
  {
    tipo: 'ausencia_categoria',
    categoriaSlug: 'bebidas',
    minimoItensNoCarrinho: 1,
    maxSugestoes: 3,
    filtroPorTag: ['popular'],
    mensagem: 'Você ainda não escolheu uma bebida!',
  },
  {
    tipo: 'ausencia_categoria',
    categoriaSlug: 'sobremesas',
    minimoItensNoCarrinho: 3,
    maxSugestoes: 2,
    mensagem: 'Que tal uma sobremesa para finalizar?',
  },
  {
    tipo: 'combo_por_valor',
    limiteReais: 120,
    percentualMinimo: 0.65,
    mensagem: 'Falta pouco para o Combo Premium!',
    produtoComboId: 'prod-combo-premium',
  },
]
