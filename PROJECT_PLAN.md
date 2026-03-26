# PROJECT_PLAN.md — Cardápio Digital Marujos Sushi

## Visão Geral

Cardápio digital mobile-first para restaurante físico de sushi.
MVP com dados mockados. Sem backend. Sem banco de dados.
Pronto para integração futura com a API da Saipos via adapter pattern.

---

## Escopo do MVP

### Incluído no MVP
- Página inicial (landing / linktree)
- Navegação por categorias do cardápio
- Listagem de produtos por categoria
- Página individual de produto com upsell
- Carrinho com upsell situacional
- Checkout físico (mesa, nome, telefone, pagamento)
- Página de confirmação do pedido
- Pesquisa de satisfação (NPS + avaliações)
- QR Code por mesa via parâmetro de URL (`?mesa=X`)
- Dados mockados completos em `src/data/`
- Estado global do carrinho persistido em localStorage
- Animações de transição entre páginas

### Fora do MVP (fases futuras)
- Painel administrativo
- Autenticação e login
- Backend real (Node.js, PostgreSQL, Redis)
- Integração com Saipos
- Histórico de pedidos do cliente
- Notificações em tempo real
- Programa de fidelidade
- Relatórios e analytics avançados
- Múltiplos idiomas
- CRM com segmentação e comunicação WhatsApp oficial (ver `CRM_ARCHITECTURE.md`)

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSG para menu estático, roteamento nativo |
| Linguagem | TypeScript (strict) | Tipagem garante contrato entre mock e API futura |
| Estilo | Tailwind CSS | Customização rápida, dark theme, mobile-first |
| Animações | Framer Motion | Transições premium entre páginas e componentes |
| Estado | Zustand | Leve, sem boilerplate, ideal para carrinho |
| Formulários | React Hook Form + Zod | Checkout e pesquisa com validação tipada |
| Dados | Arquivos `.ts` em `src/data/` | Mock simples, substituível sem tocar nos componentes |
| Deploy | Vercel | Zero configuração com Next.js |

---

## Estrutura de Pastas Completa

```
/
├── CLAUDE.md
├── PROJECT_PLAN.md
├── MENU_DATA_SCHEMA.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
│
└── src/
    │
    ├── app/                                  # Next.js App Router
    │   ├── layout.tsx                        # Root layout: fontes, providers, metadata
    │   ├── page.tsx                          # Landing page (linktree)
    │   ├── globals.css                       # Variáveis CSS, reset, fonte base
    │   │
    │   ├── cardapio/
    │   │   ├── page.tsx                      # Grid de categorias
    │   │   └── [categoria]/
    │   │       ├── page.tsx                  # Listagem de produtos da categoria
    │   │       └── [produto]/
    │   │           └── page.tsx              # Página individual do produto
    │   │
    │   ├── carrinho/
    │   │   └── page.tsx                      # Carrinho com resumo e upsell
    │   │
    │   ├── checkout/
    │   │   └── page.tsx                      # Formulário de pedido (mesa, dados, pagamento)
    │   │
    │   ├── confirmacao/
    │   │   └── [pedidoId]/
    │   │       └── page.tsx                  # Confirmação do pedido enviado
    │   │
    │   └── pesquisa/
    │       └── [pedidoId]/
    │           └── page.tsx                  # Pesquisa de satisfação NPS
    │
    ├── components/
    │   │
    │   ├── ui/                               # Design system base (sem lógica de negócio)
    │   │   ├── Button.tsx                    # Variantes: primary, secondary, ghost, danger
    │   │   ├── Badge.tsx                     # Tags: popular, novo, vegano, picante, promoção
    │   │   ├── Card.tsx                      # Container com borda sutil e fundo elevado
    │   │   ├── Sheet.tsx                     # Drawer/modal que sobe da base (mobile)
    │   │   ├── Skeleton.tsx                  # Loading placeholder animado
    │   │   ├── Toast.tsx                     # Notificação temporária (item adicionado)
    │   │   ├── QuantitySelector.tsx          # Controle de quantidade (-/+)
    │   │   ├── StarRating.tsx                # Seletor de estrelas (1 a 5) para pesquisa
    │   │   ├── ProgressBar.tsx               # Barra de progresso (upsell de combo)
    │   │   └── Divider.tsx                   # Separador visual com label opcional
    │   │
    │   ├── layout/
    │   │   ├── RootProviders.tsx             # Zustand, Toast, Framer Motion config
    │   │   ├── Header.tsx                    # Logo + ícone do carrinho com badge
    │   │   ├── BottomNav.tsx                 # Navegação inferior mobile (cardápio, carrinho)
    │   │   ├── CartFab.tsx                   # Botão flutuante do carrinho (fixo no canto)
    │   │   └── PageTransition.tsx            # Wrapper de animação entre páginas
    │   │
    │   ├── landing/
    │   │   ├── HeroSection.tsx               # Logo + frase de impacto + fundo dark
    │   │   ├── ActionCard.tsx                # Card de ação principal (ver cardápio, etc.)
    │   │   ├── ActionGrid.tsx                # Grid 2x2 dos ActionCards
    │   │   └── AnnouncementBanner.tsx        # Banner de promoção ou destaque configurável
    │   │
    │   ├── menu/
    │   │   ├── CategoryGrid.tsx              # Grid de cards de categoria
    │   │   ├── CategoryCard.tsx              # Card individual de categoria com foto
    │   │   ├── ProductList.tsx               # Lista de produtos de uma categoria
    │   │   ├── ProductCard.tsx               # Card de produto (foto, nome, preço, botão +)
    │   │   ├── ProductCardSkeleton.tsx       # Skeleton de carregamento do ProductCard
    │   │   ├── FilterBar.tsx                 # Filtros horizontais (vegano, sem glúten, etc.)
    │   │   ├── SearchBar.tsx                 # Busca por nome de produto
    │   │   └── CategoryHighlight.tsx         # Destaque de categoria no topo (ex: Combos)
    │   │
    │   ├── product/
    │   │   ├── ProductHero.tsx               # Imagem grande + nome + descrição completa
    │   │   ├── ProductOptions.tsx            # Variações de tamanho ou acompanhamento
    │   │   ├── ProductObservation.tsx        # Campo de texto livre (observações)
    │   │   ├── AllergenBadges.tsx            # Badges de alérgenos (glúten, lactose, etc.)
    │   │   ├── NutritionalInfo.tsx           # Tabela nutricional (expansível)
    │   │   ├── UpsellSection.tsx             # "Harmoniza com" + "Mais pedido junto"
    │   │   └── AddToCartBar.tsx              # Barra fixa no bottom: qty + preço + CTA
    │   │
    │   ├── cart/
    │   │   ├── CartItem.tsx                  # Item do carrinho: foto, nome, qty, preço
    │   │   ├── CartItemList.tsx              # Lista de CartItems com animação de remoção
    │   │   ├── CartSummary.tsx               # Subtotal, taxa de serviço (se houver), total
    │   │   ├── CartUpsell.tsx                # Upsell situacional (sem bebida, próximo do combo)
    │   │   ├── CartComboProgress.tsx         # Barra "falta R$X para o combo especial"
    │   │   └── EmptyCart.tsx                 # Estado vazio com CTA para o cardápio
    │   │
    │   ├── checkout/
    │   │   ├── CheckoutStepper.tsx           # Indicador de progresso das 3 etapas
    │   │   ├── TableSelector.tsx             # Seleção visual de mesa (ou leitura de URL)
    │   │   ├── CustomerForm.tsx              # Nome, telefone, e-mail (opcional)
    │   │   ├── PaymentSelector.tsx           # Pix, crédito, débito, dinheiro, VR/VA
    │   │   ├── TrocoInput.tsx                # Campo "troco para" (só se pagamento = dinheiro)
    │   │   └── CheckoutOrderSummary.tsx      # Resumo dos itens antes de confirmar
    │   │
    │   └── survey/
    │       ├── NpsSelector.tsx               # Seletor de 0 a 10 (NPS)
    │       ├── SurveyQuestion.tsx            # Pergunta com StarRating
    │       ├── SurveyTextarea.tsx            # Campo aberto de comentário
    │       └── SurveyComplete.tsx            # Tela de agradecimento pós-envio
    │
    ├── data/                                 # Dados mockados (substituídos por API no futuro)
    │   ├── categories.ts                     # Array de Categoria[]
    │   ├── products.ts                       # Array de Produto[]
    │   ├── upsellRules.ts                    # Regras de upsell por produto e por contexto
    │   └── restaurantConfig.ts               # Nome, mesas disponíveis, config da UI
    │
    ├── hooks/                                # Hooks de negócio (usam services, não data diretamente)
    │   ├── useMenu.ts                        # Categorias e produtos com filtro/busca
    │   ├── useProduct.ts                     # Produto individual por slug
    │   ├── useCart.ts                        # Acesso e mutações do carrinho (wrapper do store)
    │   ├── useUpsell.ts                      # Lógica de sugestões baseada no contexto
    │   ├── useCheckout.ts                    # Orquestra envio do pedido
    │   ├── useTableFromUrl.ts                # Lê ?mesa=X da URL e popula o store de sessão
    │   └── useSurvey.ts                      # Gerencia envio da pesquisa de satisfação
    │
    ├── services/                             # Camada de acesso a dados — adapter pattern
    │   ├── adapters/
    │   │   ├── mockAdapter.ts                # Lê de src/data/ (MVP)
    │   │   └── saiposAdapter.ts              # Stub vazio — implementado na integração futura
    │   ├── menuService.ts                    # getCategorias(), getProdutos(), getProdutoPorSlug()
    │   ├── orderService.ts                   # criarPedido(), buscarPedido()
    │   └── surveyService.ts                  # enviarPesquisa()
    │
    ├── store/                                # Zustand stores (estado global)
    │   ├── cartStore.ts                      # Itens, adicionar, remover, atualizar quantidade
    │   └── sessionStore.ts                   # Mesa atual, dados do cliente na sessão
    │
    ├── types/                                # Contratos TypeScript (fonte da verdade)
    │   ├── product.ts                        # Produto, Categoria, Variacao, Tag, Alergeno
    │   ├── cart.ts                           # ItemCarrinho, Carrinho
    │   ├── order.ts                          # Pedido, ItemPedido, FormaPagamento, StatusPedido
    │   ├── customer.ts                       # DadosCliente, Sessao
    │   ├── survey.ts                         # PesquisaSatisfacao, AvaliacaoCategoria
    │   └── config.ts                         # RestaurantConfig, UpsellRule
    │
    └── utils/
        ├── currency.ts                       # formatarPreco(centavos): "R$ 32,90"
        ├── slug.ts                           # gerarSlug("Uramaki Salmão"): "uramaki-salmao"
        ├── cart.ts                           # calcularTotal(), calcularSubtotal()
        └── upsell.ts                         # avaliarRegrasDeUpsell(carrinho, regras)
```

---

## Rotas e Responsabilidades

### `/` — Landing Page
**Componentes:** `HeroSection`, `ActionGrid`, `AnnouncementBanner`
**Responsabilidade:**
- Porta de entrada do app; escaneado após o QR Code
- Lê parâmetro `?mesa=X` da URL e salva no `sessionStore`
- Exibe 4 ações principais: Ver Cardápio, Chamar Garçom, Nossa História, Avaliar Visita
- Exibe banner de destaque sazonal (configurável em `restaurantConfig.ts`)

**Sem estado de carregamento** — dados vêm do config local, exibição é instantânea.

---

### `/cardapio` — Grade de Categorias
**Componentes:** `Header`, `CategoryGrid`, `CategoryCard`, `CategoryHighlight`, `FilterBar`, `CartFab`
**Responsabilidade:**
- Exibe todas as categorias ativas em ordem de `ordemExibicao`
- Destaque visual para categoria "Combos" (primeira, maior, com badge)
- `FilterBar` filtra categorias por tag (vegetariano, popular, promoção)
- `CartFab` visível com quantidade de itens no carrinho

---

### `/cardapio/[categoria]` — Listagem de Produtos
**Componentes:** `Header`, `ProductList`, `ProductCard`, `FilterBar`, `CategoryHighlight`, `CartFab`
**Responsabilidade:**
- Recebe `params.categoria` (slug) e busca produtos via `useMenu`
- Exibe subcategorias como âncoras de scroll (se existirem)
- `FilterBar` filtra por tag dentro da categoria
- Botão "+" no `ProductCard` adiciona direto ao carrinho com toast de confirmação
- Banner de upsell fixo no topo se categoria tiver combo associado

---

### `/cardapio/[categoria]/[produto]` — Produto Individual
**Componentes:** `ProductHero`, `ProductOptions`, `ProductObservation`, `AllergenBadges`, `NutritionalInfo`, `UpsellSection`, `AddToCartBar`
**Responsabilidade:**
- Exibe todos os detalhes do produto
- `ProductOptions` exibe variações (tamanho, acompanhamento) e atualiza preço
- `UpsellSection` exibe até 3 produtos complementares e até 3 relacionados
- `AddToCartBar` fica fixo no bottom com quantidade, preço calculado e CTA
- Ao adicionar, navega de volta ou exibe confirmação inline

---

### `/carrinho` — Carrinho
**Componentes:** `CartItemList`, `CartComboProgress`, `CartUpsell`, `CartSummary`, `Button`
**Responsabilidade:**
- Lista todos os itens com edição de quantidade e remoção individual
- `CartComboProgress` avalia se o valor está próximo de um combo (regra em `upsellRules.ts`)
- `CartUpsell` detecta carrinho sem bebida, sem sobremesa, ou próximo de meta de combo
- `CartSummary` exibe subtotal e total (sem taxa de entrega — nunca existe)
- CTA "Finalizar Pedido" navega para `/checkout`
- Estado vazio (`EmptyCart`) com link para `/cardapio`

---

### `/checkout` — Checkout em 3 Etapas
**Componentes:** `CheckoutStepper`, `TableSelector`, `CustomerForm`, `PaymentSelector`, `TrocoInput`, `CheckoutOrderSummary`
**Responsabilidade:**
- **Etapa 1 — Mesa e Dados:** mesa (pré-preenchida por URL), nome, telefone, e-mail (opcional)
- **Etapa 2 — Pagamento:** seleção de método (Pix, Crédito, Débito, Dinheiro, VR/VA), campo de troco se dinheiro
- **Etapa 3 — Revisão:** resumo completo, botão "Confirmar Pedido"
- Validação com Zod em cada etapa antes de avançar
- Ao confirmar: chama `orderService.criarPedido()`, recebe pedido mockado com ID
- Navega para `/confirmacao/[pedidoId]`

---

### `/confirmacao/[pedidoId]` — Confirmação
**Componentes:** animação de sucesso (Lottie ou CSS), resumo simplificado, `Button`
**Responsabilidade:**
- Exibe número do pedido, mesa, nome do cliente
- Tempo estimado configurável em `restaurantConfig.ts`
- Limpa o carrinho do `cartStore`
- Dois CTAs: "Avaliar minha experiência" (→ `/pesquisa/[pedidoId]`) e "Fazer novo pedido" (→ `/cardapio`)

---

### `/pesquisa/[pedidoId]` — Pesquisa de Satisfação
**Componentes:** `NpsSelector`, `SurveyQuestion`, `SurveyTextarea`, `SurveyComplete`
**Responsabilidade:**
- NPS de 0 a 10
- Avaliação por estrelas (1–5) em 4 dimensões: pratos, atendimento, tempo de espera, ambiente
- Dois campos de texto livres: melhoria e ponto positivo
- Ao enviar: chama `surveyService.enviarPesquisa()` (no MVP, loga no console / localStorage)
- Exibe `SurveyComplete` com agradecimento e sugestão de seguir no Instagram

---

## Regras de Upsell

### Definição
Upsell é qualquer sugestão de produto adicional ou upgrade que aumenta o valor do pedido.
Todas as regras estão definidas em `src/data/upsellRules.ts` e avaliadas por `src/utils/upsell.ts`.

### Tipos de Regra

**1. Complemento por Produto (`produtosComplementares`)**
- Definido no cadastro do produto
- Exibe até 3 itens na `UpsellSection` da página do produto
- Lógica: "este prato harmoniza com estas bebidas/entradas"
- Exemplo: Uramaki Premium → Saquê, Cerveja Japonesa, Edamame

**2. Relacionado por Comportamento (`produtosRelacionados`)**
- Definido no cadastro do produto
- Exibe na seção "Quem pediu isso também pediu" da página do produto
- No MVP, relação definida manualmente. No futuro, calculada por histórico de pedidos.

**3. Upsell de Combo por Valor (carrinho)**
- Regra em `upsellRules.ts`: `{ tipo: 'combo_por_valor', limiteReais: 80, descricao: '...' }`
- Ativado em `/carrinho` quando o subtotal está entre 60% e 90% do valor do combo
- Exibe `CartComboProgress` com barra de progresso

**4. Upsell por Ausência de Categoria (carrinho)**
- Regra: se nenhum item do carrinho pertence à categoria "bebidas", exibe sugestão
- Exibe até 3 produtos populares da categoria bebidas
- Gatilho: ao entrar na página `/carrinho`

**5. Upsell de Sobremesa (carrinho)**
- Regra: se o carrinho tem 3 ou mais itens e nenhum é da categoria "sobremesas"
- Exibe 1 ou 2 opções de sobremesa com CTA sutil

**6. Destaque de Combo na Categoria (listagem)**
- A categoria "combos" sempre aparece primeiro no grid de categorias
- Badge "Economize" calculado comparando o preço do combo com a soma individual dos itens
- Configurado em `restaurantConfig.ts` via `categoriaDestaqueSlug`

### Regras do que NÃO fazer
- Nunca exibir upsell como modal bloqueante
- Nunca interromper o fluxo de navegação para exibir upsell
- Nunca mostrar mais de 3 sugestões de upsell por contexto
- Nunca repetir o mesmo produto já presente no carrinho como sugestão

---

## Adapter Pattern — Preparação para Saipos

### Como funciona hoje (MVP)

```
useMenu(slug)
  → menuService.getProdutos(slug)
    → mockAdapter.fetchProdutos(slug)
      → import { produtos } from 'src/data/products'
```

### Como vai funcionar com Saipos

```
useMenu(slug)
  → menuService.getProdutos(slug)          ← não muda
    → saiposAdapter.fetchProdutos(slug)    ← novo adapter
      → GET https://api.saipos.com/...
```

**Nenhum componente, hook ou store muda.**
A troca acontece apenas na configuração do adapter em `menuService.ts`.

### Interface do Adapter (contrato)

Ambos os adapters (`mockAdapter` e `saiposAdapter`) implementam a mesma interface:

```
interface MenuAdapter {
  fetchCategorias(): Promise<Categoria[]>
  fetchProdutos(categoriaSlug: string): Promise<Produto[]>
  fetchProdutoPorSlug(slug: string): Promise<Produto | null>
}

interface OrderAdapter {
  criarPedido(dados: NovoPedido): Promise<Pedido>
  buscarPedido(id: string): Promise<Pedido | null>
}
```

### saiposAdapter.ts no MVP
No MVP, o arquivo existe mas todos os métodos lançam `throw new Error('Saipos não integrado')`.
Isso torna explícito onde a integração deve acontecer, sem bloquear o desenvolvimento.

---

## Fases de Implementação

### Fase 0 — Fundação do Projeto
**Objetivo:** Estrutura base funcionando com design system

Tarefas:
- Inicializar Next.js 14 com TypeScript e Tailwind
- Configurar paleta de cores dark premium no `tailwind.config.ts`
- Configurar fontes (Playfair Display + Inter via `next/font`)
- Criar componentes base de UI: `Button`, `Badge`, `Card`, `Skeleton`, `Toast`
- Criar `RootProviders` com Zustand devtools
- Criar `cartStore` e `sessionStore` com persistência em localStorage
- Criar tipos TypeScript em `src/types/`
- Criar dados mock iniciais em `src/data/` (5 categorias, 20 produtos)
- Criar serviços com `mockAdapter` funcional
- Criar `PageTransition` com Framer Motion

**Critério de conclusão:** `npm run dev` roda sem erros, design system básico visível

---

### Fase 1 — Cardápio (Landing → Categorias → Produto)
**Objetivo:** Usuário navega pelo cardápio completo

Tarefas:
- Implementar Landing Page com `HeroSection` e `ActionGrid`
- Implementar `/cardapio` com `CategoryGrid` e filtros
- Implementar `/cardapio/[categoria]` com `ProductList` e adição rápida ao carrinho
- Implementar `/cardapio/[categoria]/[produto]` com página completa do produto
- Implementar `CartFab` fixo com contador
- Implementar `useTableFromUrl` para ler `?mesa=X`
- Testar em mobile (375px, 390px, 414px)

**Critério de conclusão:** Navegação completa de landing até produto funcionando

---

### Fase 2 — Carrinho e Checkout
**Objetivo:** Usuário finaliza um pedido completo

Tarefas:
- Implementar `/carrinho` completo com edição de itens
- Implementar `CartSummary` com cálculo de total
- Implementar `/checkout` com as 3 etapas e validação Zod
- Implementar `orderService.criarPedido()` (mock: gera ID e salva em memória)
- Implementar `/confirmacao/[pedidoId]` com animação
- Garantir que carrinho é limpo após confirmação
- Garantir persistência do carrinho no localStorage

**Critério de conclusão:** Fluxo completo de pedido do carrinho até a confirmação

---

### Fase 3 — Upsell
**Objetivo:** Estratégias de upsell ativas em todos os pontos definidos

Tarefas:
- Implementar `UpsellSection` na página de produto
- Implementar `CartUpsell` com detecção de bebida ausente
- Implementar `CartComboProgress` com avaliação de valor
- Implementar destaque da categoria Combos no grid de categorias
- Implementar `useUpsell` com todas as regras de `upsellRules.ts`
- Popular dados mock com relações entre produtos (complementares e relacionados)

**Critério de conclusão:** Upsell ativo em produto, carrinho e listagem de categorias

---

### Fase 4 — Pesquisa de Satisfação
**Objetivo:** Coleta de NPS e feedback pós-pedido

Tarefas:
- Implementar `/pesquisa/[pedidoId]` completa
- Implementar `surveyService.enviarPesquisa()` (mock: salva em localStorage)
- Garantir link para pesquisa na página de confirmação
- Implementar `SurveyComplete` com CTA de Instagram

**Critério de conclusão:** Fluxo de pesquisa completo, dados salvos localmente

---

### Fase 5 — Polimento e Deploy
**Objetivo:** Produto pronto para uso no restaurante

Tarefas:
- Revisão completa de UX mobile em dispositivos reais
- Otimização de imagens com `next/image` e lazy loading
- Metadados de SEO e Open Graph
- Favicon e ícone de PWA
- Deploy na Vercel com domínio personalizado (`cardapio.marujos.com.br`)
- Gerar e imprimir QR Codes por mesa (`?mesa=1` até `?mesa=30`)
- Testar fluxo completo em dispositivos iOS e Android

**Critério de conclusão:** Sistema acessível pelo QR Code, funcionando no restaurante

---

### Fase 6 (Futura) — Backend e Integração Saipos
**Objetivo:** Persistência real e integração com PDV

Tarefas:
- Criar API Node.js/Fastify com PostgreSQL e Prisma
- Implementar `saiposAdapter` com integração real
- Migrar `orderService` para usar API real
- Migrar `surveyService` para salvar no banco
- Dashboard de NPS e pedidos

---

## Dados Mock — Conteúdo Mínimo

O seed de dados em `src/data/` deve cobrir:

### Categorias (mínimo 8)
1. Combos — destaque, primeira
2. Entradas
3. Uramakis
4. Temakis
5. Niguiris
6. Sashimis
7. Bebidas
8. Sobremesas

### Produtos (mínimo 30)
- 3 combos com preço comparativo ao avulso
- 4 entradas (gyoza, edamame, missoshiru, harumaki)
- 8 uramakis com variação de tamanho (8 peças / 16 peças)
- 4 temakis
- 4 niguiris com opções de peixe
- 3 bebidas (refrigerante, saquê, cerveja japonesa)
- 4 bebidas sem álcool
- 3 sobremesas (sorvete de matcha, mochi, temaki de nutella)

Cada produto deve ter ao menos 2 `produtosComplementares` definidos.

---

## Configurações do Restaurante (`restaurantConfig.ts`)

```
{
  nomeRestaurante: "Marujos Sushi",
  slogan: "A experiência começa aqui",
  instagram: "@marujos.sushi",
  whatsapp: "5511XXXXXXXXX",
  totalDeMesas: 30,
  categoriaDestaqueSlug: "combos",
  tempoEstimadoMinutos: 25,
  taxaServico: 0,                     // sem taxa de serviço no MVP
  anuncio: {
    ativo: true,
    texto: "Sexta e sábado: Combo Premium com 10% off",
    validade: "2025-12-31"
  }
}
```
