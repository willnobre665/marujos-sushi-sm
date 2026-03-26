/**
 * configService — Ponto único de acesso à configuração do restaurante.
 *
 * Troca o adapter aqui para alternar entre mock e Saipos.
 * Nenhum componente ou hook precisa mudar.
 */
import { restaurantConfig } from '@/data/restaurantConfig'
import type { RestaurantConfig } from '@/types/config'

export const configService = {
  getConfig: (): RestaurantConfig => restaurantConfig,
}
