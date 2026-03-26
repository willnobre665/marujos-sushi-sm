# MENU_DATA_SCHEMA.md — Estrutura de Dados

Fonte da verdade para todos os tipos de dados do projeto.
Todos os tipos TypeScript em `src/types/` devem espelhar este documento.
Os dados mock em `src/data/` devem seguir estes schemas.

---

## Convenções

- **Valores monetários:** sempre em centavos (inteiro). `3290` = R$ 32,90.
- **Slugs:** kebab-case, sem acentos, sem espaços. `"uramaki-salmao-especial"`.
- **Datas:** ISO 8601. `"2025-06-15T00:00:00Z"`.
- **IDs:** UUID v4 nos dados reais. No mock, strings legíveis são aceitas (`"cat-001"`).
- **Opcionais:** campos com `?` podem ser omitidos ou `undefined`. Nunca usar `null`.

---

## 1. Produto

```typescript
// src/types/product.ts

type TagProduto =
  | 'popular'
  | 'novo'
  | 'vegano'
  | 'vegetariano'
  | 'picante'
  | 'sem-gluten'
  | 'promocao'
  | 'destaque-chef'

type Alergeno =
  | 'gluten'
  | 'lactose'
  | 'frutos-do-mar'
  | 'soja'
  | 'amendoim'
  | 'ovos'
  | 'sesamo'

interface InformacaoNutricional {
  calorias: number          // kcal
  proteinas: number         // g
  carboidratos: number      // g
  gorduras: number          // g
  porcao: string            // ex: "8 peças (220g)"
}

interface OpcaoVariacao {
  id: string
  label: string             // "8 peças", "16 peças", "Pequeno", "Grande"
  precoAdicional: number    // centavos. 0 se não altera o preço
}

interface Variacao {
  id: string
  nome: string              // "Tamanho", "Acompanhamento"
  obrigatoria: boolean
  opcoes: OpcaoVariacao[]
}

interface Produto {
  id: string
  nome: string
  slug: string
  descricao: string
  descricaoResumida: string         // até 80 caracteres, para o card
  preco: number                     // centavos, preço base
  precoOriginal?: number            // centavos, exibir riscado se preço < precoOriginal
  categoriaId: string
  subcategoriaId?: string
  imagens: string[]                 // URLs. Primeiro é a imagem principal.
  tags: TagProduto[]
  alergenos: Alergeno[]
  informacaoNutricional?: InformacaoNutricional
  variacoes?: Variacao[]
  produtosComplementares: string[]  // IDs — bebidas/entradas que harmonizam
  produtosRelacionados: string[]    // IDs — "quem pediu também pediu"
  disponivel: boolean
  destaqueNaCategoria: boolean
  ordemExibicao: number
  saiposId?: string                 // preenchido na integração futura
  saiposCodigo?: string
}
```

### Exemplo de Produto Mock

```typescript
{
  id: "prod-001",
  nome: "Uramaki Salmão Especial",
  slug: "uramaki-salmao-especial",
  descricao: "8 peças de uramaki recheadas com salmão fresco e cream cheese, finalizado com gergelim tostado e molho tarê artesanal.",
  descricaoResumida: "Salmão fresco, cream cheese e molho tarê",
  preco: 3490,
  categoriaId: "cat-uramakis",
  imagens: [
    "/images/produtos/uramaki-salmao-especial.jpg",
    "/images/produtos/uramaki-salmao-especial-2.jpg"
  ],
  tags: ["popular"],
  alergenos: ["gluten", "lactose", "frutos-do-mar", "sesamo"],
  informacaoNutricional: {
    calorias: 320,
    proteinas: 18,
    carboidratos: 38,
    gorduras: 10,
    porcao: "8 peças (220g)"
  },
  variacoes: [
    {
      id: "var-tamanho",
      nome: "Tamanho",
      obrigatoria: false,
      opcoes: [
        { id: "op-8pcs", label: "8 peças", precoAdicional: 0 },
        { id: "op-16pcs", label: "16 peças", precoAdicional: 2800 }
      ]
    }
  ],
  produtosComplementares: ["prod-sake", "prod-cerveja-japonesa", "prod-edamame"],
  produtosRelacionados: ["prod-uramaki-atum", "prod-temaki-salmao"],
  disponivel: true,
  destaqueNaCategoria: true,
  ordemExibicao: 1
}
```

---

## 2. Categoria

```typescript
// src/types/product.ts (continuação)

interface Subcategoria {
  id: string
  nome: string
  categoriaId: string
  ordemExibicao: number
}

interface Categoria {
  id: string
  nome: string
  slug: string
  descricao?: string
  imagemCapa: string              // URL
  corDestaque?: string            // hex, para acento visual no card
  ordemExibicao: number
  ativa: boolean
  subcategorias?: Subcategoria[]
  saiposId?: string
}
```

### Exemplo de Categorias Mock

```typescript
[
  {
    id: "cat-combos",
    nome: "Combos",
    slug: "combos",
    descricao: "Monte sua experiência completa e economize",
    imagemCapa: "/images/categorias/combos.jpg",
    corDestaque: "#C9A84C",
    ordemExibicao: 1,
    ativa: true
  },
  {
    id: "cat-entradas",
    nome: "Entradas",
    slug: "entradas",
    descricao: "Para começar da forma certa",
    imagemCapa: "/images/categorias/entradas.jpg",
    ordemExibicao: 2,
    ativa: true
  },
  {
    id: "cat-uramakis",
    nome: "Uramakis",
    slug: "uramakis",
    imagemCapa: "/images/categorias/uramakis.jpg",
    ordemExibicao: 3,
    ativa: true,
    subcategorias: [
      { id: "sub-tradicionais", nome: "Tradicionais", categoriaId: "cat-uramakis", ordemExibicao: 1 },
      { id: "sub-especiais", nome: "Especiais", categoriaId: "cat-uramakis", ordemExibicao: 2 }
    ]
  },
  {
    id: "cat-bebidas",
    nome: "Bebidas",
    slug: "bebidas",
    imagemCapa: "/images/categorias/bebidas.jpg",
    ordemExibicao: 7,
    ativa: true
  }
]
```

---

## 3. Item do Carrinho e Carrinho

```typescript
// src/types/cart.ts

interface OpcaoVariacaoSelecionada {
  variacaoId: string
  variacaoNome: string
  opcaoId: string
  opcaoLabel: string
  precoAdicional: number      // centavos
}

interface ItemCarrinho {
  itemId: string              // UUID único do item no carrinho (não é o ID do produto)
  produto: Produto            // snapshot completo no momento da adição
  quantidade: number
  variacoesSelecionadas: OpcaoVariacaoSelecionada[]
  observacao?: string         // "sem pepino, mais pimenta"
  precoUnitario: number       // centavos. preco base + soma dos precoAdicional das variações
  precoTotal: number          // precoUnitario * quantidade
}

interface Carrinho {
  itens: ItemCarrinho[]
  subtotal: number            // soma de precoTotal de todos os itens
  total: number               // subtotal + taxaServico (sem entrega — nunca)
  taxaServico: number         // centavos. 0 no MVP.
  quantidadeTotal: number     // soma das quantidades
}
```

### Notas do Carrinho
- `itemId` é gerado no momento da adição (crypto.randomUUID())
- O mesmo produto pode aparecer como dois `ItemCarrinho` distintos se tiver variações diferentes ou observações diferentes
- O carrinho é persistido no `localStorage` via Zustand persist middleware
- Ao confirmar o pedido, o carrinho é limpo completamente

---

## 4. Pedido

```typescript
// src/types/order.ts

type FormaPagamento =
  | 'pix'
  | 'credito'
  | 'debito'
  | 'dinheiro'
  | 'vr'
  | 'va'

type StatusPedido =
  | 'recebido'
  | 'em_preparo'
  | 'pronto'
  | 'entregue'
  | 'cancelado'

interface ItemPedido {
  id: string
  produtoId: string
  produtoNome: string           // snapshot — não mudar se produto for editado depois
  produtoPreco: number          // snapshot do precoUnitario no momento do pedido
  variacoes: string             // texto legível: "16 peças"
  observacao?: string
  quantidade: number
  subtotal: number              // produtoPreco * quantidade
}

interface NovoPedido {
  // Dados do formulário de checkout — entrada do orderService.criarPedido()
  itens: ItemCarrinho[]
  mesa: string
  cliente: DadosCliente
  formaPagamento: FormaPagamento
  trocoPara?: number            // centavos. Apenas se formaPagamento === 'dinheiro'
  observacaoGeral?: string
}

interface Pedido {
  // Retorno do orderService.criarPedido()
  id: string
  numeroPedido: number          // sequencial legível: 1, 2, 3... exibido como #0001
  status: StatusPedido
  mesa: string
  cliente: DadosCliente
  itens: ItemPedido[]
  formaPagamento: FormaPagamento
  trocoPara?: number
  observacaoGeral?: string
  subtotal: number
  taxaServico: number
  total: number
  criadoEm: string              // ISO 8601
  saiposPedidoId?: string       // preenchido na integração futura
}
```

### Mock de Pedido Criado

```typescript
// Retorno de orderService.criarPedido() no mock
{
  id: "ped-abc123",
  numeroPedido: 47,
  status: "recebido",
  mesa: "12",
  cliente: {
    nome: "Ana Souza",
    telefone: "11987654321",
    email: "ana@email.com"
  },
  itens: [
    {
      id: "item-001",
      produtoId: "prod-001",
      produtoNome: "Uramaki Salmão Especial",
      produtoPreco: 3490,
      variacoes: "16 peças",
      quantidade: 1,
      subtotal: 6290      // 3490 + 2800 (variação 16 peças)
    },
    {
      id: "item-002",
      produtoId: "prod-sake",
      produtoNome: "Saquê Quente",
      produtoPreco: 2200,
      variacoes: "",
      quantidade: 2,
      subtotal: 4400
    }
  ],
  formaPagamento: "pix",
  subtotal: 10690,
  taxaServico: 0,
  total: 10690,
  criadoEm: "2025-06-15T19:32:00Z"
}
```

---

## 5. Dados do Cliente / Sessão

```typescript
// src/types/customer.ts

interface DadosCliente {
  nome: string
  telefone: string              // apenas dígitos: "11987654321"
  email?: string
}

// Consentimento coletado no checkout — alimenta o CRM futuramente
// Veja CRM_ARCHITECTURE.md para a estrutura completa no CRM
interface ConsentimentoCheckout {
  atualizacoes_transacionais: boolean   // receber status do pedido via WhatsApp
  mensagens_promocionais: boolean       // receber ofertas e novidades
  timestamp: string                     // ISO 8601 — momento do aceite
  fonte: 'checkout_cardapio'
}

interface Sessao {
  mesa?: string                 // número da mesa atual (string para aceitar "A3", "Varanda")
  cliente?: DadosCliente        // preenchido no checkout, persiste durante a sessão
  consentimento?: ConsentimentoCheckout // coletado no checkout, exportado para o CRM
  pedidoAtualId?: string        // ID do último pedido confirmado na sessão
}
```

### Notas da Sessão
- `Sessao` é gerenciada pelo `sessionStore` (Zustand)
- `mesa` é preenchida por `useTableFromUrl` ao ler `?mesa=X` da URL
- `cliente` é preenchido no checkout e persiste para evitar redigitar em pedidos seguintes na mesma visita
- `consentimento` é coletado no `CustomerForm` com dois checkboxes separados:
  - "Receber atualizações do pedido" (padrão: **marcado**)
  - "Receber ofertas e novidades" (padrão: **desmarcado** — opt-in explícito)
- A sessão NÃO é persistida no localStorage por padrão (limpa ao fechar o navegador)
- Exceção: `mesa` pode ser mantida em sessionStorage para não perder ao recarregar a página
- No MVP, o consentimento é salvo em `localStorage` com chave `marujos_crm_eventos` para exportação futura ao CRM

---

## 6. Pesquisa de Satisfação

```typescript
// src/types/survey.ts

interface AvaliacaoCategoria {
  qualidadePratos: number       // 1 a 5
  atendimento: number           // 1 a 5
  tempoDeEspera: number         // 1 a 5
  ambiente: number              // 1 a 5
}

type CanalPesquisa = 'link_confirmacao' | 'qr_code_mesa' | 'whatsapp'

interface NovaPesquisa {
  pedidoId: string
  cliente: DadosCliente
  nps: number                   // 0 a 10
  avaliacoes: AvaliacaoCategoria
  comentarioMelhoria?: string
  comentarioPositivo?: string
  canal: CanalPesquisa
}

interface PesquisaSatisfacao extends NovaPesquisa {
  id: string
  criadoEm: string              // ISO 8601
}
```

### Notas da Pesquisa
- No MVP, `surveyService.enviarPesquisa()` salva em `localStorage` com chave `marujos_pesquisas`
- Um `pedidoId` pode ter no máximo uma pesquisa (verificar antes de exibir o formulário)
- A pesquisa é opcional — o cliente pode fechar a aba sem responder
- `canal: 'link_confirmacao'` é o padrão (vindo da tela de confirmação)

---

## 7. Regras de Upsell

```typescript
// src/types/config.ts

type TipoUpsell =
  | 'complemento_produto'       // definido por produto, exibido na página do produto
  | 'relacionado_produto'       // definido por produto, "quem pediu também pediu"
  | 'ausencia_categoria'        // dispara se nenhum item do carrinho é de uma categoria
  | 'combo_por_valor'           // dispara se o subtotal está próximo de um combo
  | 'combo_por_quantidade'      // dispara se o carrinho tem X itens sem combo

interface RegraUpsellAusenciaCategoria {
  tipo: 'ausencia_categoria'
  categoriaSlug: string         // "bebidas", "sobremesas"
  minimoItensNoCarrinho: number // só dispara se o carrinho tiver ao menos N itens
  maxSugestoes: number          // número de produtos a exibir
  filtroPorTag?: TagProduto[]   // ex: ['popular'] — filtrar sugestões por tag
  mensagem: string              // "Você ainda não escolheu uma bebida!"
}

interface RegraUpsellComboPorValor {
  tipo: 'combo_por_valor'
  limiteReais: number           // valor do combo em reais (não centavos — para legibilidade)
  percentualMinimo: number      // % do limite a partir do qual a barra aparece (ex: 0.6 = 60%)
  mensagem: string              // "Falta pouco para o Combo Premium!"
  produtoComboId: string        // produto a ser sugerido como upgrade
}

type RegraUpsell = RegraUpsellAusenciaCategoria | RegraUpsellComboPorValor
```

### Exemplo de upsellRules.ts

```typescript
export const upsellRules: RegraUpsell[] = [
  {
    tipo: 'ausencia_categoria',
    categoriaSlug: 'bebidas',
    minimoItensNoCarrinho: 1,
    maxSugestoes: 3,
    filtroPorTag: ['popular'],
    mensagem: "Você ainda não escolheu uma bebida!"
  },
  {
    tipo: 'ausencia_categoria',
    categoriaSlug: 'sobremesas',
    minimoItensNoCarrinho: 3,
    maxSugestoes: 2,
    mensagem: "Que tal uma sobremesa para finalizar?"
  },
  {
    tipo: 'combo_por_valor',
    limiteReais: 120,
    percentualMinimo: 0.65,
    mensagem: "Falta pouco para o Combo Premium!",
    produtoComboId: "prod-combo-premium"
  }
]
```

---

## 8. Configuração do Restaurante

```typescript
// src/types/config.ts (continuação)

interface AnuncioBanner {
  ativo: boolean
  texto: string
  validade?: string             // ISO date. Se vencida, não exibe.
  linkUrl?: string
  linkLabel?: string
}

interface RestaurantConfig {
  nomeRestaurante: string
  slogan: string
  instagram?: string            // "@marujos.sushi"
  whatsapp?: string             // "5511XXXXXXXXX" — para "Chamar Garçom"
  totalDeMesas: number          // para o seletor de mesa no checkout
  mesasEspeciais?: string[]     // ex: ["Varanda", "Privativo"] — adicionados ao seletor
  categoriaDestaqueSlug: string // "combos" — categoria que aparece em destaque
  tempoEstimadoMinutos: number  // exibido na tela de confirmação
  taxaServico: number           // centavos. 0 = sem taxa
  anuncio?: AnuncioBanner
  logoUrl: string
  imagemHero: string            // imagem de fundo da landing page
}
```

### Exemplo de restaurantConfig.ts

```typescript
export const restaurantConfig: RestaurantConfig = {
  nomeRestaurante: "Marujos Sushi",
  slogan: "A experiência começa aqui",
  instagram: "@marujos.sushi",
  whatsapp: "5511999999999",
  totalDeMesas: 30,
  mesasEspeciais: ["Varanda", "Privativo"],
  categoriaDestaqueSlug: "combos",
  tempoEstimadoMinutos: 25,
  taxaServico: 0,
  anuncio: {
    ativo: true,
    texto: "Sexta e sábado: Combo Premium com 10% off",
    validade: "2025-12-31"
  },
  logoUrl: "/images/logo.svg",
  imagemHero: "/images/hero-bg.jpg"
}
```

---

## Mapa de Relações

```
RestaurantConfig
│
├── Categoria (1:N)
│   ├── Subcategoria (1:N)
│   └── Produto (1:N)
│       ├── Variacao (1:N)
│       │   └── OpcaoVariacao (1:N)
│       ├── produtosComplementares → [Produto.id]
│       └── produtosRelacionados → [Produto.id]
│
├── RegraUpsell[] (upsellRules.ts)
│
├── Sessao
│   ├── mesa: string
│   └── cliente: DadosCliente
│
├── Carrinho
│   └── ItemCarrinho[]
│       └── produto: Produto (snapshot)
│
├── Pedido
│   ├── cliente: DadosCliente (snapshot)
│   └── itens: ItemPedido[] (snapshot)
│
└── PesquisaSatisfacao
    └── pedidoId → Pedido.id
```

---

## Interfaces dos Serviços (Adapter Contract)

```typescript
// src/services/adapters/types.ts
// Este é o contrato que mockAdapter e saiposAdapter devem implementar

interface MenuAdapter {
  fetchCategorias(): Promise<Categoria[]>
  fetchProdutos(categoriaSlug: string): Promise<Produto[]>
  fetchProdutoPorSlug(slug: string): Promise<Produto | null>
  fetchProdutosPorIds(ids: string[]): Promise<Produto[]>
}

interface OrderAdapter {
  criarPedido(dados: NovoPedido): Promise<Pedido>
  buscarPedido(id: string): Promise<Pedido | null>
}

interface SurveyAdapter {
  enviarPesquisa(dados: NovaPesquisa): Promise<PesquisaSatisfacao>
  buscarPesquisaPorPedido(pedidoId: string): Promise<PesquisaSatisfacao | null>
}
```

### mockAdapter — comportamento esperado

| Método | Comportamento no MVP |
|---|---|
| `fetchCategorias()` | Retorna `categories.ts` com delay simulado de 300ms |
| `fetchProdutos(slug)` | Filtra `products.ts` por `categoriaId` correspondente ao slug |
| `fetchProdutoPorSlug(slug)` | Busca em `products.ts` por `slug` |
| `fetchProdutosPorIds(ids)` | Filtra `products.ts` pelos IDs (usado no upsell) |
| `criarPedido(dados)` | Gera ID, número sequencial, salva em `localStorage`, retorna `Pedido` |
| `buscarPedido(id)` | Lê do `localStorage` pelo ID |
| `enviarPesquisa(dados)` | Salva em `localStorage` com chave `marujos_pesquisas`, retorna `PesquisaSatisfacao` |
| `buscarPesquisaPorPedido(id)` | Lê do `localStorage`, retorna `null` se não encontrada |

### saiposAdapter — comportamento no MVP

```typescript
// Todos os métodos lançam erro — implementação futura
export const saiposAdapter: MenuAdapter & OrderAdapter = {
  fetchCategorias: () => { throw new Error('[saiposAdapter] Não implementado') },
  fetchProdutos: () => { throw new Error('[saiposAdapter] Não implementado') },
  // ...
}
```
