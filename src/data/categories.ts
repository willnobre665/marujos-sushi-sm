import type { Categoria } from '@/types/product'

export const categories: Categoria[] = [
  // 1 ─── PROMOÇÕES (cat-combos ID preserved — existing products reference it) ─
  {
    id: 'cat-combos',
    nome: 'Promoções',
    slug: 'promocoes',
    descricao: 'Monte sua experiência completa e economize',
    imagemCapa: '/images/categorias/combos.jpg',
    corDestaque: '#C9A84C',
    ordemExibicao: 1,
    ativa: true,
  },

  // 2 ─── MAIS PEDIDOS ────────────────────────────────────────────────────────
  {
    id: 'cat-mais-pedidos',
    nome: '⭐⭐⭐ Mais Pedidos',
    slug: 'mais-pedidos',
    descricao: 'Os favoritos da casa',
    imagemCapa: '/images/categorias/combos.jpg',
    corDestaque: '#C9A84C',
    ordemExibicao: 2,
    ativa: true,
  },

  // 3 ─── COMBOS ──────────────────────────────────────────────────────────────
  {
    id: 'cat-combos-novos',
    nome: 'Combos',
    slug: 'combos',
    descricao: 'Combinações completas para grupos',
    imagemCapa: '/images/categorias/combos.jpg',
    ordemExibicao: 3,
    ativa: true,
  },

  // 4 ─── KAKU 5 UND ─────────────────────────────────────────────────────────
  {
    id: 'cat-kaku',
    nome: 'Kaku 5 Und',
    slug: 'kaku',
    descricao: 'Peças especiais em porção de 5',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 4,
    ativa: true,
  },

  // 5 ─── JOES 2 UND ─────────────────────────────────────────────────────────
  {
    id: 'cat-joes',
    nome: 'Joes 2 Und',
    slug: 'joes',
    descricao: 'Peças individuais em dupla',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 5,
    ativa: true,
  },

  // 6 ─── URAMAKI PREMIUM 8 UND ──────────────────────────────────────────────
  {
    id: 'cat-uramaki-premium',
    nome: 'Uramaki Premium 8 Und',
    slug: 'uramaki-premium',
    descricao: 'Uramakis especiais com ingredientes premium',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 6,
    ativa: true,
  },

  // 7 ─── URAMAKIS TRADICIONAIS 10 UND ───────────────────────────────────────
  {
    id: 'cat-uramakis',
    nome: 'Uramakis Tradicionais 10 Und',
    slug: 'uramakis',
    descricao: 'Clássicos com recheios irresistíveis',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 7,
    ativa: true,
  },

  // 8 ─── HOT HOLL 10 UND ────────────────────────────────────────────────────
  {
    id: 'cat-hot',
    nome: 'Hot Holl 10 Und',
    slug: 'hot-holl',
    descricao: 'Rolinhos quentes gratinados',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 8,
    ativa: true,
  },

  // 9 ─── GUNKAN JOE 4 UND ───────────────────────────────────────────────────
  {
    id: 'cat-gunkan',
    nome: 'Gunkan Joe 4 Und',
    slug: 'gunkan-joe',
    descricao: 'Barquinhos de alga com recheios especiais',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 9,
    ativa: true,
  },

  // 10 ─── TEMAKI 1 UND ──────────────────────────────────────────────────────
  {
    id: 'cat-temakis',
    nome: 'Temaki 1 Und',
    slug: 'temakis',
    descricao: 'Cones de alga crocante com recheios frescos',
    imagemCapa: '/images/categorias/temakis.jpg',
    ordemExibicao: 10,
    ativa: true,
  },

  // 11 ─── NIGUIRI 2 UND ─────────────────────────────────────────────────────
  {
    id: 'cat-niguiris',
    nome: 'Niguiri 2 Und',
    slug: 'niguiris',
    descricao: 'Arroz temperado com fatias frescas de peixe',
    imagemCapa: '/images/categorias/niguiris.jpg',
    ordemExibicao: 11,
    ativa: true,
  },

  // 12 ─── SASHIMI 6 UND ─────────────────────────────────────────────────────
  {
    id: 'cat-sashimis',
    nome: 'Sashimi 6 Und',
    slug: 'sashimis',
    descricao: 'Fatias finas de peixe fresco selecionado',
    imagemCapa: '/images/categorias/sashimis.jpg',
    ordemExibicao: 12,
    ativa: true,
  },

  // 13 ─── HOSSOMAKI 10 UND ──────────────────────────────────────────────────
  {
    id: 'cat-hossomaki',
    nome: 'Hossomaki 10 Und',
    slug: 'hossomaki',
    descricao: 'Rolinhos finos de alga com recheio clássico',
    imagemCapa: '/images/categorias/uramakis.jpg',
    ordemExibicao: 13,
    ativa: true,
  },

  // 14 ─── BEBIDAS ────────────────────────────────────────────────────────────
  {
    id: 'cat-bebidas',
    nome: 'Bebidas',
    slug: 'bebidas',
    descricao: 'Harmonize sua experiência',
    imagemCapa: '/images/categorias/bebidas.jpg',
    ordemExibicao: 14,
    ativa: true,
  },

  // ─── INACTIVE (kept for data integrity, not rendered) ──────────────────────
  {
    id: 'cat-entradas',
    nome: 'Entradas',
    slug: 'entradas',
    descricao: 'Para começar da forma certa',
    imagemCapa: '/images/categorias/entradas.jpg',
    ordemExibicao: 99,
    ativa: false,
  },
  {
    id: 'cat-sobremesas',
    nome: 'Sobremesas',
    slug: 'sobremesas',
    descricao: 'O encerramento perfeito',
    imagemCapa: '/images/categorias/sobremesas.jpg',
    ordemExibicao: 99,
    ativa: false,
  },
]
