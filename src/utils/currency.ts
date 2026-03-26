/**
 * Formata centavos para exibição em reais.
 * @example formatarPreco(3290) → "R$ 32,90"
 */
export function formatarPreco(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

/**
 * Formata a diferença de preço para exibição de desconto.
 * @example formatarDesconto(8500, 6990) → "Economize R$ 15,10"
 */
export function formatarDesconto(precoOriginal: number, precoAtual: number): string {
  const desconto = precoOriginal - precoAtual
  return `Economize ${formatarPreco(desconto)}`
}

/**
 * Calcula o percentual de desconto entre dois preços.
 * @example calcularPercentualDesconto(8500, 6990) → 18
 */
export function calcularPercentualDesconto(precoOriginal: number, precoAtual: number): number {
  return Math.round(((precoOriginal - precoAtual) / precoOriginal) * 100)
}
