/**
 * Stock item categories for cmv_ingredients.
 * Shared between API routes and UI components.
 */

export type StockCategory =
  | 'insumo_alimentar'
  | 'bebida'
  | 'embalagem'
  | 'limpeza'
  | 'descartavel'
  | 'outro'

export const STOCK_CATEGORIES: StockCategory[] = [
  'insumo_alimentar', 'bebida', 'embalagem', 'limpeza', 'descartavel', 'outro',
]

export const STOCK_CATEGORY_LABELS: Record<StockCategory, string> = {
  insumo_alimentar: 'Insumo alimentar',
  bebida:           'Bebida',
  embalagem:        'Embalagem',
  limpeza:          'Limpeza',
  descartavel:      'Descartável',
  outro:            'Outro',
}
