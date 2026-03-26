import type { RestaurantConfig } from '@/types/config'

export const restaurantConfig: RestaurantConfig = {
  nomeRestaurante: 'Marujos Sushi',
  slogan: 'A experiência começa aqui',
  instagram: '@marujos.sushi',
  whatsapp: '5511999999999',
  totalDeMesas: 30,
  mesasEspeciais: ['Varanda', 'Privativo'],
  categoriaDestaqueSlug: 'combos',
  tempoEstimadoMinutos: 25,
  taxaServico: 0,
  anuncio: {
    ativo: true,
    texto: 'Sexta e sábado: Combo Premium com 10% off',
    validade: '2026-12-31',
  },
  logoUrl: '/images/logo.svg',
  imagemHero: '/images/hero-bg.jpg',
}
