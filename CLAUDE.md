# CLAUDE.md — Cardápio Digital Marujos Sushi

Este arquivo é lido automaticamente pelo Claude Code ao iniciar uma sessão neste projeto.
Leia com atenção antes de qualquer tarefa.

---

## Sobre o Projeto

Cardápio digital premium para consumo **no local** (restaurante físico). Não há entrega.
O cliente escaneia um QR Code na mesa, navega pelo cardápio, monta o pedido e envia.
O garçom recebe o pedido e o atende presencialmente.

**Restaurante:** Marujos Sushi
**Objetivo comercial:** Aumentar ticket médio via upsell e coletar dados dos clientes.
**Integração futura:** API da Saipos (PDV). O frontend não deve depender disso.

---

## Filosofia de Desenvolvimento

### MVP-first, sempre
Construa o mínimo necessário para validar a experiência do usuário.
Não adicione complexidade antes de precisar dela.

### Frontend-first com dados mockados
A primeira versão NÃO tem backend real.
Todos os dados vêm de arquivos locais em `src/data/`.
A comunicação com dados ocorre exclusivamente via camada de serviço (`src/services/`).
Quando o backend real existir, apenas os serviços mudam — jamais os componentes.

### Nenhuma dessas tecnologias no MVP:
- ❌ PostgreSQL, MySQL ou qualquer banco de dados
- ❌ Redis ou qualquer cache de servidor
- ❌ Prisma ou qualquer ORM
- ❌ Fastify, NestJS, Express ou qualquer servidor Node
- ❌ Docker ou qualquer containerização
- ❌ Autenticação de usuário (login/senha)

### O que SIM entra no MVP:
- ✅ Next.js 14 com App Router
- ✅ TypeScript (tipagem estrita)
- ✅ Tailwind CSS (dark, premium, mobile-first)
- ✅ Framer Motion (animações de transição)
- ✅ Zustand (estado global: carrinho, sessão)
- ✅ React Hook Form + Zod (formulários e validação)
- ✅ Dados mockados em `src/data/`
- ✅ Camada de serviço em `src/services/` (pronta para trocar mock por API)

---

## Regras de Negócio Invioláveis

1. **Não existe entrega.** Não mencione, não implemente, não sugira entrega ou frete.
2. **Mesa é obrigatória.** Todo pedido precisa de número de mesa. Vem via QR Code (`?mesa=X`) ou seleção manual.
3. **Nome e telefone são obrigatórios no checkout.** E-mail é opcional.
4. **Upsell é estratégico, não agressivo.** Aparece em pontos definidos, nunca como popup bloqueante.
5. **Pesquisa de satisfação é pós-pedido.** Link na página de confirmação. Nunca obrigatória.
6. **Preço no pedido é snapshot.** O valor pago é o do momento do pedido, não o atual do produto.
7. **Telefone é a chave do cliente.** É o identificador principal para histórico futuro.

---

## Camada de Serviço — Padrão Adapter

Todo acesso a dados passa por `src/services/`.
Os componentes NUNCA importam de `src/data/` diretamente.

```
Componente → Hook (useMenu, useCart) → Service (menuService) → Adapter (mockAdapter | apiAdapter)
```

No MVP, o adapter usado é o `mockAdapter` (lê de `src/data/`).
Na integração com Saipos, um novo `saiposAdapter` é criado e plugado nos serviços.
**O restante do código não muda.**

---

## Design

- Tema: dark, premium, sofisticado
- Cor de fundo base: `#0A0A0A` (preto profundo)
- Cor de destaque: `#C9A84C` (dourado)
- Texto principal: `#F5F0E8` (branco marfim)
- Texto secundário: `#8A8A8A` (cinza médio)
- Mobile-first: projetado para telas de 375px em diante
- Fonte de exibição: Playfair Display (títulos)
- Fonte de interface: Inter (corpo, botões, labels)

---

## Estrutura de Pastas (resumo)

```
src/
├── app/          → rotas Next.js (App Router)
├── components/   → UI dividida por feature
├── data/         → dados mockados (JSON/TS)
├── hooks/        → hooks de negócio
├── services/     → camada de acesso a dados (adapter pattern)
├── store/        → Zustand stores
├── types/        → contratos TypeScript
└── utils/        → funções utilitárias puras
```

Veja `PROJECT_PLAN.md` para a estrutura completa.
Veja `MENU_DATA_SCHEMA.md` para os tipos de dados.

---

## Convenções de Código

- Componentes: PascalCase, um por arquivo
- Hooks: camelCase com prefixo `use`
- Serviços: camelCase com sufixo `Service`
- Tipos: PascalCase, exportados de `src/types/`
- Dados mock: arquivos `.ts` em `src/data/`, exportando arrays ou objetos tipados
- Strings de UI: sempre em português brasileiro
- Datas: sempre em UTC, formatadas no cliente com `Intl.DateTimeFormat`
- Valores monetários: sempre em centavos (número inteiro) no código, formatados na exibição

---

## Como Rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

Para simular uma mesa específica: `http://localhost:3000?mesa=5`

---

## Arquivos de Referência

- `PROJECT_PLAN.md` — plano de implementação por fases, rotas, componentes
- `MENU_DATA_SCHEMA.md` — estrutura de dados completa com exemplos
- `CRM_ARCHITECTURE.md` — arquitetura CRM: consentimento, segmentação e comunicação WhatsApp segura
