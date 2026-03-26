# CRM_ARCHITECTURE.md — Arquitetura CRM Marujos Sushi

Documento de referência para o CRM que será alimentado pelo cardápio digital.
Esta arquitetura é desenhada com **segurança WhatsApp, consentimento explícito e segmentação inteligente** como pilares fundamentais.

---

## Princípios Fundacionais

### 1. Não há mass blasting
O CRM não foi projetado para disparos em massa. A lógica de comunicação é sempre orientada a **segmentos relevantes** com **mensagens contextuais**. Volume alto é um sinal de problema, não de sucesso.

### 2. Somente canais oficiais
A camada de comunicação é **abstraída via adapter pattern** (mesmo princípio do cardápio). O sistema nunca depende de automações não-oficiais do WhatsApp Web. O adapter oficial pode ser integrado com qualquer provedor de API oficial (Meta Cloud API, Twilio, Gupshup, etc.).

### 3. Consentimento é dado de primeira classe
Consentimento não é um checkbox legal — é um campo estruturado com tipo, timestamp, canal de coleta e granularidade por categoria de mensagem.

### 4. Segurança é arquitetural, não operacional
Rate limiting, aprovação de campanha, registro de envios e tratamento de bloqueios são partes do modelo de dados — não regras de negócio adicionadas depois.

---

## Modelo de Dados CRM

### 4.1 — Cliente CRM

```typescript
// crm/types/customer.ts

type CanalPreferido = 'whatsapp' | 'email' | 'nenhum'

interface ConsentimentoCanal {
  aceito: boolean
  timestamp: string                 // ISO 8601 — momento do aceite
  canal_coleta: ConsentimentoFonte  // onde foi coletado
  ip_hash?: string                  // hash do IP — para auditoria, jamais o IP bruto
  versao_politica: string           // ex: "v1.0" — para controle de versão dos termos
}

type ConsentimentoFonte =
  | 'checkout_cardapio'             // coletado no formulário de checkout
  | 'confirmacao_pedido'            // opt-in após confirmação do pedido
  | 'pesquisa_satisfacao'           // coletado ao final da pesquisa NPS
  | 'admin_manual'                  // inserido manualmente pelo admin (ex: clientes antigos)

interface ConsentimentoCliente {
  atualizacoes_transacionais: ConsentimentoCanal   // confirmações de pedido, status
  mensagens_relacionais: ConsentimentoCanal        // follow-up, aniversário, feedback
  mensagens_promocionais: ConsentimentoCanal       // ofertas, campanhas, reativação
}

interface ClienteCRM {
  id: string                        // UUID
  telefone: string                  // chave principal — apenas dígitos: "5511987654321"
  nome: string
  email?: string
  canal_preferido: CanalPreferido
  consentimento: ConsentimentoCliente
  bloqueado: boolean                // true se solicitou opt-out ou bloqueou no WhatsApp
  bloqueado_em?: string             // ISO 8601
  bloqueado_motivo?: ConsentimentoBloqueioMotivo
  criado_em: string                 // ISO 8601
  atualizado_em: string             // ISO 8601
  fonte_origem: ConsentimentoFonte  // como entrou no CRM
}

type ConsentimentoBloqueioMotivo =
  | 'opt_out_whatsapp'              // cliente respondeu STOP ou bloqueou
  | 'opt_out_manual'                // solicitou diretamente
  | 'qualidade_baixa'               // conta marcada como spam — precaução
  | 'admin'                         // bloqueado manualmente pelo admin
```

---

### 4.2 — Histórico de Pedidos (vindo do cardápio)

```typescript
// crm/types/order_history.ts

interface PedidoCRM {
  id: string                        // mesmo ID do Pedido do cardápio
  cliente_id: string                // FK → ClienteCRM.id
  cliente_telefone: string          // desnormalizado para busca rápida
  mesa: string
  itens: ItemPedidoResumo[]
  total: number                     // centavos
  forma_pagamento: string
  canal_origem: 'cardapio_qrcode'   // extensível no futuro
  atribuicao_mesa?: string          // rastrear mesa de origem para análise
  criado_em: string
}

interface ItemPedidoResumo {
  produto_id: string
  produto_nome: string
  categoria_slug: string
  quantidade: number
  subtotal: number
}
```

---

### 4.3 — Eventos Comportamentais

```typescript
// crm/types/events.ts
// Fonte de verdade para segmentação comportamental

type TipoEvento =
  | 'pedido_realizado'
  | 'pesquisa_respondida'
  | 'link_confirmacao_acessado'
  | 'opt_in_transacional'
  | 'opt_in_promocional'
  | 'opt_out'
  | 'mensagem_enviada'
  | 'mensagem_lida'                 // disponível via webhook do provedor oficial
  | 'mensagem_falhou'
  | 'campanha_recebida'
  | 'aniversario_detectado'

interface EventoCRM {
  id: string
  cliente_id: string
  tipo: TipoEvento
  payload: Record<string, unknown>  // dados contextuais do evento
  criado_em: string
}
```

---

### 4.4 — Segmentos

```typescript
// crm/types/segments.ts

type TipoSegmento =
  | 'recencia'                      // pedidos nos últimos N dias
  | 'frequencia'                    // mais de N pedidos no período
  | 'valor'                         // gasto acima de R$ X
  | 'aniversario'                   // aniversário nos próximos N dias
  | 'inatividade'                   // sem pedidos há mais de N dias
  | 'nps_detrator'                  // NPS 0–6
  | 'nps_promotor'                  // NPS 9–10
  | 'categoria_preferencia'         // pediu X vezes da categoria Y
  | 'consentimento_promocional'     // aceita campanhas

interface SegmentoCliente {
  id: string
  nome: string                      // "Clientes VIP", "Inativos 60 dias"
  descricao: string
  tipo: TipoSegmento
  criterios: Record<string, unknown>   // parametrização do critério
  tamanho_atual: number             // recalculado periodicamente
  atualizado_em: string
}
```

---

### 4.5 — Categorias de Mensagem

```typescript
// crm/types/messaging.ts

type CategoriaMensagem =
  | 'transacional'                  // confirmação de pedido, status de preparo
  | 'relacional'                    // follow-up pós-visita, aniversário, solicitação de feedback
  | 'promocional'                   // oferta, campanha, reativação

// Mapeamento de consentimento necessário por categoria
const CONSENTIMENTO_NECESSARIO: Record<CategoriaMensagem, keyof ConsentimentoCliente> = {
  transacional: 'atualizacoes_transacionais',
  relacional: 'mensagens_relacionais',
  promocional: 'mensagens_promocionais',
}

type TemplateStatus = 'rascunho' | 'aguardando_aprovacao' | 'aprovado' | 'rejeitado' | 'arquivado'

interface TemplateMensagem {
  id: string
  nome: string
  categoria: CategoriaMensagem
  canal: 'whatsapp' | 'email'
  conteudo: string                  // com variáveis: {{nome}}, {{numero_pedido}}
  variaveis: string[]               // lista das variáveis usadas
  status: TemplateStatus
  aprovado_por?: string             // ID do admin que aprovou
  aprovado_em?: string
  waba_template_id?: string         // ID do template aprovado no WABA (WhatsApp Business API)
  criado_em: string
}
```

---

### 4.6 — Campanhas e Workflow de Aprovação

```typescript
// crm/types/campaigns.ts

type StatusCampanha =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'rejeitada'
  | 'em_andamento'
  | 'pausada'
  | 'concluida'
  | 'cancelada'

interface Campanha {
  id: string
  nome: string
  categoria: CategoriaMensagem      // define quais clientes são elegíveis
  template_id: string               // FK → TemplateMensagem.id (deve estar aprovado)
  segmento_id: string               // FK → SegmentoCliente.id
  canal: 'whatsapp' | 'email'

  // Controles de segurança
  tamanho_estimado: number          // calculado no momento da aprovação
  limite_envios_por_hora: number    // proteção contra ban — máximo por hora
  limite_total: number              // teto absoluto de envios desta campanha
  intervalo_entre_envios_ms: number // delay entre cada mensagem individual

  status: StatusCampanha
  criado_por: string                // ID do admin que criou
  aprovado_por?: string
  aprovado_em?: string
  rejeitado_motivo?: string
  agendado_para?: string            // ISO 8601 — null = envio imediato após aprovação
  iniciado_em?: string
  concluido_em?: string

  // Métricas
  total_enviados: number
  total_entregues: number
  total_falhas: number
  total_opt_outs: number
  criado_em: string
}
```

---

### 4.7 — Log de Mensagens

```typescript
// crm/types/message_log.ts

type StatusMensagem =
  | 'enfileirada'
  | 'enviada'
  | 'entregue'
  | 'lida'
  | 'falhou'
  | 'bloqueada_por_opt_out'
  | 'bloqueada_sem_consentimento'
  | 'bloqueada_limite_atingido'

interface LogMensagem {
  id: string
  cliente_id: string
  campanha_id?: string              // null para mensagens transacionais automáticas
  template_id: string
  categoria: CategoriaMensagem
  canal: 'whatsapp' | 'email'
  telefone_destino: string          // desnormalizado — snapshot no momento do envio
  status: StatusMensagem
  erro?: string                     // mensagem de erro do provedor
  provedor_mensagem_id?: string     // ID retornado pelo provedor (para rastreamento)
  enviada_em?: string
  entregue_em?: string
  lida_em?: string
  criado_em: string
}
```

---

## Fluxo de Dados: Cardápio → CRM

```
Checkout do Cardápio
│
├── DadosCliente (nome, telefone, email)
│   └── → ClienteCRM (criado ou atualizado por telefone)
│
├── ConsentimentoFonte: 'checkout_cardapio'
│   └── → ConsentimentoCliente.atualizacoes_transacionais (sempre solicitado)
│       └── ConsentimentoCliente.mensagens_promocionais (opt-in explícito, separado)
│
├── Pedido confirmado
│   └── → PedidoCRM (snapshot do pedido)
│       └── → EventoCRM { tipo: 'pedido_realizado' }
│
└── PesquisaSatisfacao (opcional)
    └── → EventoCRM { tipo: 'pesquisa_respondida', payload: { nps, avaliacoes } }
```

---

## Coleta de Consentimento no Checkout

O `CustomerForm` do cardápio deve exibir dois campos distintos:

```
[x] Quero receber atualizações sobre meu pedido via WhatsApp
    (padrão: marcado — essencial para a experiência do cliente)

[ ] Quero receber ofertas e novidades do Marujos Sushi via WhatsApp
    (padrão: desmarcado — opt-in explícito)
```

Esses dois campos alimentam `ConsentimentoCliente.atualizacoes_transacionais` e `ConsentimentoCliente.mensagens_promocionais` com timestamps e `canal_coleta: 'checkout_cardapio'`.

**O campo de promoções NUNCA é pré-marcado.**

---

## Segmentação: Exemplos de Uso

| Segmento | Critério | Categoria permitida |
|---|---|---|
| Clientes recentes | Pedido nos últimos 7 dias | Transacional, Relacional |
| Clientes VIP | 4+ pedidos ou R$500+ em 90 dias | Transacional, Relacional, Promocional* |
| Inativos 60 dias | Sem pedido há 60+ dias | Relacional, Promocional* |
| Aniversariantes da semana | `data_nascimento` nos próximos 7 dias | Relacional* |
| Detratores NPS | NPS 0–6 na última pesquisa | Relacional |
| Promotores NPS | NPS 9–10 | Relacional |

*Somente se `consentimento.mensagens_promocionais.aceito === true`

---

## Controles de Segurança WhatsApp

### Regras de envio
- Mensagens transacionais: podem ser enviadas sem template pré-aprovado **somente dentro da janela de 24h** após interação do cliente (regra Meta).
- Mensagens fora da janela de 24h: **obrigatório usar template aprovado no WABA**.
- Mensagens promocionais: **sempre template aprovado**, independente da janela.

### Rate limiting (configurável)
```typescript
// Valores padrão recomendados para evitar sinalização de spam
const LIMITES_PADRAO = {
  mensagens_por_hora: 50,           // por conta WABA
  mensagens_por_campanha_por_hora: 30,
  intervalo_minimo_entre_envios_ms: 2000,  // 2 segundos entre cada mensagem
  max_campanhas_ativas_simultaneas: 2
}
```

### Workflow de aprovação obrigatório para campanhas
```
Criação (rascunho)
  → Revisão do template (aprovado no WABA?)
    → Seleção do segmento (tamanho calculado)
      → Aprovação por admin (StatusCampanha: 'aguardando_aprovacao' → 'aprovada')
        → Agendamento ou envio imediato
          → Monitoramento em tempo real (opt-outs, falhas)
            → Pausa automática se opt-outs > threshold
```

### Opt-out imediato
Qualquer sinal de opt-out (resposta "STOP", bloqueio detectado via webhook) deve:
1. Imediatamente setar `ClienteCRM.bloqueado = true`
2. Setar `consentimento.mensagens_promocionais.aceito = false`
3. Registrar `EventoCRM { tipo: 'opt_out' }`
4. **Nunca mais enviar para esse número** sem novo opt-in explícito

---

## Adapter de Comunicação

A camada de envio segue o mesmo padrão adapter do cardápio:

```typescript
// crm/services/adapters/types.ts

interface CommunicationAdapter {
  enviarMensagem(params: EnvioMensagem): Promise<ResultadoEnvio>
  verificarStatusMensagem(provedor_id: string): Promise<StatusMensagem>
  registrarWebhook(evento: WebhookProvedor): Promise<void>
}

interface EnvioMensagem {
  destinatario: string              // telefone no formato E.164: "+5511987654321"
  template_id: string               // ID do template aprovado no provedor
  variaveis: Record<string, string> // valores para interpolação
  categoria: CategoriaMensagem
}

interface ResultadoEnvio {
  sucesso: boolean
  provedor_mensagem_id?: string
  erro?: string
}
```

Adapters planejados:
- `mockCommunicationAdapter` — MVP: loga no console, salva em localStorage
- `metaCloudAdapter` — integração direta com Meta Cloud API (oficial)
- `twilioAdapter` — via Twilio WhatsApp Business API
- `gupshupAdapter` — via Gupshup (provedor oficial BSP)

**Nenhum adapter não-oficial (WhatsApp Web JS, Baileys, WPPConnect) deve ser implementado.**

---

## Estrutura de Pastas CRM (futura)

```
crm/
├── types/
│   ├── customer.ts               # ClienteCRM, ConsentimentoCliente
│   ├── order_history.ts          # PedidoCRM
│   ├── events.ts                 # EventoCRM, TipoEvento
│   ├── segments.ts               # SegmentoCliente
│   ├── messaging.ts              # TemplateMensagem, CategoriaMensagem
│   ├── campaigns.ts              # Campanha, StatusCampanha
│   └── message_log.ts            # LogMensagem, StatusMensagem
│
├── services/
│   ├── adapters/
│   │   ├── types.ts              # CommunicationAdapter (contrato)
│   │   ├── mockAdapter.ts        # MVP: log + localStorage
│   │   └── metaCloudAdapter.ts   # Stub — implementado na integração
│   ├── customerService.ts        # upsertCliente, buscarPorTelefone
│   ├── consentimentoService.ts   # registrarConsentimento, verificarElegibilidade
│   ├── segmentService.ts         # calcularSegmento, listarClientesPorSegmento
│   ├── campanhaService.ts        # criarCampanha, aprovarCampanha, executarCampanha
│   └── mensagemService.ts        # enviarMensagem (com todas as verificações de segurança)
│
└── utils/
    ├── eligibility.ts            # verificarElegibilidadeEnvio(cliente, categoria)
    ├── rate_limiter.ts           # controle de frequência de envios
    └── opt_out.ts                # processarOptOut(telefone)
```

---

## Função Central de Elegibilidade

Todo envio passa por esta verificação antes de qualquer chamada ao adapter:

```typescript
// crm/utils/eligibility.ts

function verificarElegibilidadeEnvio(
  cliente: ClienteCRM,
  categoria: CategoriaMensagem
): { elegivel: boolean; motivo?: string } {
  if (cliente.bloqueado) {
    return { elegivel: false, motivo: 'cliente_bloqueado' }
  }

  const chaveConsentimento = CONSENTIMENTO_NECESSARIO[categoria]
  if (!cliente.consentimento[chaveConsentimento].aceito) {
    return { elegivel: false, motivo: 'sem_consentimento' }
  }

  // Verificações adicionais de rate limit e janela de 24h
  // são feitas no mensagemService

  return { elegivel: true }
}
```

---

## O que o Cardápio deve exportar para o CRM

Quando o backend real existir, o `orderService.criarPedido()` deve emitir um evento para o CRM com:

```typescript
interface EventoNovoPedido {
  tipo: 'pedido_realizado'
  cliente: {
    nome: string
    telefone: string
    email?: string
  }
  consentimento: {
    atualizacoes_transacionais: boolean
    mensagens_promocionais: boolean
    timestamp: string
    fonte: 'checkout_cardapio'
  }
  pedido: {
    id: string
    mesa: string
    total: number
    itens: ItemPedidoResumo[]
    criado_em: string
  }
  fonte: 'cardapio_qrcode'
  atribuicao_mesa?: string
}
```

No MVP (sem backend), este payload é salvo no `localStorage` com chave `marujos_crm_eventos` para ser importado futuramente.

---

## O que NÃO fazer — Restrições Arquiteturais

| Proibido | Motivo |
|---|---|
| Mass broadcast para toda a base | Risco de ban do número WABA |
| Pre-marcar opt-in de promoções | Violação de LGPD e políticas do Meta |
| Usar número pessoal do WhatsApp | Risco de bloqueio permanente sem recurso |
| WhatsApp Web automations | Termos de serviço do WhatsApp — banimento imediato |
| Enviar template não-aprovado fora da janela de 24h | Violação direta da política Meta |
| Ignorar opt-outs | LGPD — infração administrativa |
| Campanhas sem aprovação prévia | Controle arquitetural obrigatório |
| Segmentar por dados sensíveis (saúde, religião, etc.) | LGPD — dados especiais |
