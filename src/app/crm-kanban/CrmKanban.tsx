'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  ManagerCliente,
  ManagerDetail,
  CustomerSegment,
} from '@/app/api/crm/manager/route'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function brl(centavos: number): string {
  return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ',')
}

function dtFull(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Priority scoring ─────────────────────────────────────────────────────────

type PriorityLevel = 'high' | 'medium' | 'low'

interface Priority {
  level:        PriorityLevel
  score:        number
  label:        string
  icon:         string
  color:        string
  futureCents:  number   // estimated future revenue in centavos
}

function computePriorityScore(
  totalSpentCentavos: number,
  orderCount: number,
  daysSinceLastOrder: number | null,
): Priority {
  // Score components (0–100 each)
  const spendScore   = Math.min(totalSpentCentavos / 300, 100)          // R$300 = 100pts
  const orderScore   = Math.min(orderCount * 12, 100)                    // ~8 orders = 100pts
  const recencyScore = daysSinceLastOrder === null
    ? 50
    : Math.max(0, 100 - daysSinceLastOrder * 4)                          // 25+ days = 0pts

  const score = Math.round(spendScore * 0.4 + orderScore * 0.3 + recencyScore * 0.3)

  // Estimated future value: avg ticket × expected orders per month × 3 months
  const avgTicket    = orderCount > 0 ? totalSpentCentavos / orderCount : 0
  const ordersPerMo  = orderCount > 0 && daysSinceLastOrder !== null
    ? Math.max(0.5, orderCount / Math.max(1, (daysSinceLastOrder + 30) / 30))
    : 0.5
  const futureCents  = Math.round(avgTicket * ordersPerMo * 3)

  if (score >= 60) return { level: 'high',   score, label: 'Prioridade alta',  icon: '🔥', color: '#f97316', futureCents }
  if (score >= 30) return { level: 'medium', score, label: 'Prioridade média', icon: '⚠️', color: '#eab308', futureCents }
  return                   { level: 'low',   score, label: 'Prioridade baixa', icon: '💤', color: '#6b7280', futureCents }
}

// ─── Churn risk ───────────────────────────────────────────────────────────────

interface ChurnRisk {
  label: string
  color: string
}

function getChurnRisk(days: number | null): ChurnRisk {
  if (days === null)  return { label: 'Sem pedido', color: '#555' }
  if (days === 0)     return { label: 'Pediu hoje', color: '#4ade80' }
  if (days <= 7)      return { label: 'Risco baixo', color: '#4ade80' }
  if (days <= 20)     return { label: 'Risco médio', color: '#eab308' }
  return                     { label: 'Risco alto',  color: '#f87171' }
}

// ─── Recommended action ───────────────────────────────────────────────────────

interface RecommendedAction {
  text:  string
  emoji: string
  cta:   ActionKey
}

function getRecommendedAction(
  priority:    Priority,
  churnRisk:   ChurnRisk,
  days:        number | null,
  orderCount:  number,
  suppressed?: boolean,
): RecommendedAction {
  // Suppressed customers: do not recommend any outreach
  if (suppressed) {
    return { text: 'Silenciado — aguardar', emoji: '💤', cta: 'message' }
  }
  // High churn risk → re-engage now
  if (churnRisk.label === 'Risco alto' || (days !== null && days >= 20)) {
    return { text: 'Reativar agora', emoji: '🚨', cta: 'message' }
  }
  if (orderCount === 1 && days !== null && days >= 3) {
    return { text: 'Incentivar 2º pedido', emoji: '🎯', cta: 'message' }
  }
  if (priority.level === 'high' && churnRisk.label === 'Risco médio') {
    return { text: 'Campanha personalizada', emoji: '📣', cta: 'campaign' }
  }
  if (priority.level === 'high') {
    return { text: 'Elevar para VIP', emoji: '⭐', cta: 'vip' }
  }
  return { text: 'Manter contato', emoji: '💬', cta: 'message' }
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────

/** Returns true for cards that should pulse: high priority AND ≥10 days silent */
function isUrgent(priority: Priority, days: number | null): boolean {
  return priority.level === 'high' && days !== null && days >= 10
}

/** Injects @keyframes once into <head> — idempotent */
let keyframesInjected = false
function injectKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return
  keyframesInjected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes urgentGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
      50%       { box-shadow: 0 0 0 4px rgba(248,113,113,0.18); }
    }
  `
  document.head.appendChild(style)
}

function silenciaLabel(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return 'Pediu hoje'
  if (days === 1) return '⏳ 1 dia sem pedir'
  return `⏳ ${days} dias sem pedir`
}

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColumnDef {
  segment:     CustomerSegment
  label:       string
  description: string
  color:       string
  bg:          string
  borderColor: string
}

const COLUMNS: ColumnDef[] = [
  {
    segment: 'novo',
    label: 'Novo',
    description: '1º pedido',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.07)',
    borderColor: 'rgba(96,165,250,0.25)',
  },
  {
    segment: 'ativo',
    label: 'Ativo',
    description: '0–20 dias',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.07)',
    borderColor: 'rgba(74,222,128,0.25)',
  },
  {
    segment: 'frequente',
    label: 'Frequente',
    description: '2–4 pedidos',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.07)',
    borderColor: 'rgba(167,139,250,0.25)',
  },
  {
    segment: 'vip',
    label: 'VIP',
    description: '5+ pedidos',
    color: '#C9A84C',
    bg: 'rgba(201,168,76,0.07)',
    borderColor: 'rgba(201,168,76,0.25)',
  },
  {
    segment: 'dias_20_30',
    label: '20–30 dias',
    description: 'Reativar em breve',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.07)',
    borderColor: 'rgba(251,146,60,0.25)',
  },
  {
    segment: 'dias_30_45',
    label: '30–45 dias',
    description: 'Reativar logo',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.07)',
    borderColor: 'rgba(249,115,22,0.25)',
  },
  {
    segment: 'dias_50_plus',
    label: '50+ dias',
    description: 'Reativação urgente',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.07)',
    borderColor: 'rgba(248,113,113,0.25)',
  },
]

// ─── Segmentation ─────────────────────────────────────────────────────────────

const VIP_MIN_ORDERS       = 5
const FREQUENTE_MIN_ORDERS = 2
const DAYS_ATIVO           = 20
const DAYS_50_PLUS         = 50

function assignSegment(c: ManagerCliente): CustomerSegment {
  if (c.orderCount === 0) return 'none'

  // VIP: 5+ orders — overrides everything
  if (c.orderCount >= VIP_MIN_ORDERS) return 'vip'

  // Frequente: 2–4 orders — overrides time-based
  if (c.orderCount >= FREQUENTE_MIN_ORDERS) return 'frequente'

  // First purchase
  if (c.orderCount === 1) return 'novo'

  // Time-based fallthrough
  const days = c.daysSinceLastOrder
  if (days === null)          return 'ativo'
  if (days <= DAYS_ATIVO)     return 'ativo'
  if (days <= 30)             return 'dias_20_30'
  if (days <= 45)             return 'dias_30_45'
  if (days >= DAYS_50_PLUS)   return 'dias_50_plus'
  return 'ativo'
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchAllCustomers(): Promise<ManagerCliente[]> {
  const res = await fetch(
    `/api/crm/manager?view=list&limit=500&sort=last_order`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const json = await res.json()
  return json.customers as ManagerCliente[]
}

function groupBySegment(customers: ManagerCliente[]): BoardData {
  const board: BoardData = { vip: [], frequente: [], novo: [], ativo: [], dias_20_30: [], dias_30_45: [], dias_50_plus: [], none: [] }
  for (const c of customers) {
    const seg = assignSegment(c)
    board[seg].push(c)
  }
  // Sort each column by priority score desc
  for (const seg of Object.keys(board) as CustomerSegment[]) {
    board[seg].sort((a, b) => {
      const pa = computePriorityScore(a.totalSpentCentavos, a.orderCount, a.daysSinceLastOrder)
      const pb = computePriorityScore(b.totalSpentCentavos, b.orderCount, b.daysSinceLastOrder)
      return pb.score - pa.score
    })
  }
  return board
}

async function fetchDetail(phone: string): Promise<ManagerDetail> {
  const res = await fetch(
    `/api/crm/manager?view=detail&phone=${encodeURIComponent(phone)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`detail failed: ${res.status}`)
  return res.json() as Promise<ManagerDetail>
}

// ─── Inline action handlers ───────────────────────────────────────────────────

type ActionKey = 'message' | 'vip' | 'campaign'

// Opens whatsapp:// deep-link with pre-filled message (no API needed)
function openWhatsApp(phone: string, name: string) {
  const msg = encodeURIComponent(
    `Olá ${name}! Sentimos sua falta no Marujos Sushi 🍣 Que tal uma visita em breve?`
  )
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
}

// Navigate to campaigns page pre-filtered
function openCampaignCreation(phone?: string) {
  window.location.href = phone ? `/campaigns?phone=${encodeURIComponent(phone)}` : '/campaigns'
}

// ─── Suppression helpers (DB-backed via PATCH /api/crm/manager) ───────────────

/** Returns true when the customer's suppressedUntil is in the future */
function isCustomerSuppressed(c: ManagerCliente): boolean {
  if (!c.suppressedUntil) return false
  return new Date(c.suppressedUntil) > new Date()
}

async function apiSetSuppression(
  phone: string,
  suppressedUntil: string | null,
  suppressedBy?: string,
): Promise<void> {
  const body: Record<string, unknown> = { suppressedUntil }
  if (suppressedUntil !== null) {
    body.suppressedReason = '7-day operator silence'
    if (suppressedBy) body.suppressedBy = suppressedBy
  }
  const res = await fetch(
    `/api/crm/manager?phone=${encodeURIComponent(phone)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
  }
}

// ─── Customer card ────────────────────────────────────────────────────────────

function CustomerCard({
  customer,
  colColor,
  onClick,
  onAction,
}: {
  customer:  ManagerCliente
  colColor:  string
  onClick:   () => void
  onAction:  (key: ActionKey, customer: ManagerCliente, e: React.MouseEvent) => void
}) {
  const [hovered,     setHovered]     = useState(false)
  const [whyOpen,     setWhyOpen]     = useState(false)
  const injectedRef                   = useRef(false)

  const priority   = computePriorityScore(customer.totalSpentCentavos, customer.orderCount, customer.daysSinceLastOrder)
  const churn      = getChurnRisk(customer.daysSinceLastOrder)
  const avgTicket  = customer.orderCount > 0
    ? Math.round(customer.totalSpentCentavos / customer.orderCount)
    : 0
  const urgent     = isUrgent(priority, customer.daysSinceLastOrder)
  const suppressed = isCustomerSuppressed(customer)
  const action     = getRecommendedAction(priority, churn, customer.daysSinceLastOrder, customer.orderCount, suppressed)

  // inject keyframes once per component mount if urgent
  useEffect(() => {
    if (urgent && !injectedRef.current) {
      injectKeyframes()
      injectedRef.current = true
    }
  }, [urgent])

  const borderColor = hovered ? colColor + '55'
    : suppressed    ? '#1e1e1e'
    : urgent        ? 'rgba(248,113,113,0.35)'
    :                  '#1e1e1e'
  const animation   = urgent && !hovered && !suppressed ? 'urgentGlow 2.8s ease-in-out infinite' : 'none'

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: hovered ? '#171717' : suppressed ? '#0e0e0e' : urgent ? '#130f0f' : '#111',
        border: `1px solid ${borderColor}`,
        opacity: suppressed ? 0.65 : 1,
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? `0 4px 20px rgba(0,0,0,0.5)` : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
        animation,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Clickable body */}
      <button
        onClick={onClick}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '12px 14px 10px', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {/* Row 1: name + badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: suppressed ? '#666' : '#F5F0E8', lineHeight: 1.3 }}>
            {customer.name}
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'nowrap' }}>
            {suppressed && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                backgroundColor: '#1a1a1a', color: '#444',
                borderRadius: 100, padding: '2px 7px',
                border: '1px solid #2a2a2a',
              }}>
                💤
              </span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700,
              backgroundColor: priority.color + '22',
              color: priority.color,
              borderRadius: 100, padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}>
              {priority.icon} {priority.label}
            </span>
          </div>
        </div>

        {/* Row 2: phone */}
        <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{customer.phone}</div>

        {/* Row 3: silence + churn risk */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: urgent ? '#f87171' : '#777' }}>
            {silenciaLabel(customer.daysSinceLastOrder)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: churn.color }}>
            {churn.label}
          </span>
        </div>

        {/* Row 4: value metrics (compact) */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Stat label="Pedidos"      value={String(customer.orderCount)} />
          <Stat label="Gasto total"  value={brl(customer.totalSpentCentavos)} />
          <Stat label="Ticket médio" value={avgTicket > 0 ? brl(avgTicket) : '—'} />
        </div>

        {/* Row 5: Potential — prominent gold block */}
        {priority.futureCents > 0 && (
          <div style={{
            marginTop: 10,
            backgroundColor: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 7,
            padding: '6px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, color: '#a07c30', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🔥 Potencial 3 meses
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>
              {brl(priority.futureCents)}
            </span>
          </div>
        )}

        {/* Row 6: Recommended action */}
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Ação:
          </span>
          <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
            {action.emoji} {action.text}
          </span>
        </div>

        {/* Campaign tag */}
        {customer.latestCampaign && (
          <div style={{
            marginTop: 6, fontSize: 11, color: '#C9A84C',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ opacity: 0.6 }}>campanha:</span>
            <span style={{ fontWeight: 500 }}>{customer.latestCampaign}</span>
          </div>
        )}
      </button>

      {/* "Por que esse cliente?" — collapsible explainability block */}
      <div style={{ padding: '0 10px 6px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setWhyOpen((v) => !v) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: '#3a3a3a', padding: '2px 0',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 9 }}>{whyOpen ? '▼' : '▶'}</span>
          Por que esse cliente?
        </button>
        {whyOpen && (
          <div style={{
            marginTop: 6,
            backgroundColor: '#0d0d0d',
            border: '1px solid #1e1e1e',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
            color: '#666',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            <WhyLine label="Sem pedir"    value={silenciaLabel(customer.daysSinceLastOrder)} />
            <WhyLine label="Pedidos"      value={String(customer.orderCount)} />
            <WhyLine label="Ticket médio" value={avgTicket > 0 ? brl(avgTicket) : '—'} />
            <WhyLine label="Score"        value={`${priority.score} pts (${priority.label})`} valueColor={priority.color} />
          </div>
        )}
      </div>

      {/* Inline actions */}
      <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px' }}>
        <ActionBtn
          label="💬 Mensagem"
          title="Enviar mensagem no WhatsApp"
          highlight={action.cta === 'message'}
          onClick={(e) => onAction('message', customer, e)}
        />
        <ActionBtn
          label="⭐ VIP"
          title="Marcar como VIP (abre detalhes)"
          highlight={action.cta === 'vip'}
          onClick={(e) => onAction('vip', customer, e)}
        />
        <ActionBtn
          label="🎯 Campanha"
          title="Ir para campanhas"
          highlight={action.cta === 'campaign'}
          onClick={(e) => onAction('campaign', customer, e)}
        />
      </div>
    </div>
  )
}

function WhyLine({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#3a3a3a' }}>{label}</span>
      <span style={{ color: valueColor ?? '#777' }}>{value}</span>
    </div>
  )
}

function ActionBtn({
  label,
  title,
  highlight = false,
  onClick,
}: {
  label:      string
  title:      string
  highlight?: boolean
  onClick:    (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        fontSize: 11, fontWeight: highlight ? 700 : 500,
        padding: '5px 4px',
        borderRadius: 6,
        border: `1px solid ${hov ? '#444' : highlight ? '#2e2a20' : '#222'}`,
        backgroundColor: hov ? '#1e1e1e' : highlight ? '#1a1710' : '#161616',
        color: hov ? '#ccc' : highlight ? '#C9A84C' : '#666',
        cursor: 'pointer',
        transition: 'color 0.1s, border-color 0.1s, background-color 0.1s',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </button>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: color ?? '#bbb', marginTop: 1 }}>{value}</div>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  customers,
  loading,
  onCardClick,
  onAction,
}: {
  col:        ColumnDef
  customers:  ManagerCliente[]
  loading:    boolean
  onCardClick: (c: ManagerCliente) => void
  onAction:   (key: ActionKey, customer: ManagerCliente, e: React.MouseEvent) => void
}) {
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpentCentavos, 0)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minWidth: 280,
      flex: '1 1 280px',
      maxWidth: 340,
      backgroundColor: col.bg,
      border: `1px solid ${col.borderColor}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${col.borderColor}`,
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: col.color }}>
            {col.label}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            backgroundColor: col.color + '22',
            color: col.color,
            borderRadius: 100, padding: '2px 9px',
          }}>
            {loading ? '…' : customers.length}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{col.description}</div>
        {!loading && customers.length > 0 && (
          <div style={{ fontSize: 11, color: col.color, opacity: 0.7, marginTop: 4 }}>
            {brl(totalRevenue)} total
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{
        overflowY: 'auto',
        padding: '10px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
      }}>
        {loading ? (
          <div style={{ color: '#333', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            Carregando…
          </div>
        ) : customers.length === 0 ? (
          <div style={{ color: '#333', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            Nenhum cliente
          </div>
        ) : (
          customers.map((c) => (
            <CustomerCard
              key={c.phone}
              customer={c}
              colColor={col.color}
              onClick={() => onCardClick(c)}
              onAction={onAction}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Automation log type (mirrors automations/route.ts mapRow output) ────────

interface AutomationEntry {
  id:                        string
  flow:                      string
  status:                    string
  messageText:               string
  triggeredAt:               string
  sentAt:                    string | null
  recoveredAt:               string | null | undefined
  recoveredRevenueCentavos:  number | null | undefined
  lastError:                 string | null | undefined
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  phone,
  customer,
  onClose,
  onToast,
  onCustomerUpdate,
}: {
  phone:             string
  customer:          ManagerCliente
  onClose:           () => void
  onToast:           (msg: string) => void
  onCustomerUpdate?: (phone: string, patch: Partial<ManagerCliente>) => void
}) {
  const [detail,      setDetail]      = useState<ManagerDetail | null>(null)
  const [automations, setAutomations] = useState<AutomationEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [isVip,          setIsVip]          = useState(customer.segmentTags.includes('vip'))
  const [suppressed,     setSuppressed]     = useState(() => isCustomerSuppressed(customer))
  const [suppressWorking,setSuppressWorking] = useState(false)
  const [vipWorking,     setVipWorking]     = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setAutomations([])

    Promise.all([
      fetchDetail(phone),
      fetch(`/api/crm/automations?phone=${encodeURIComponent(phone)}&limit=20`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => (j.entries ?? []) as AutomationEntry[])
        .catch(() => [] as AutomationEntry[]),
    ])
      .then(([d, a]) => { setDetail(d); setAutomations(a) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [phone])

  const priority = computePriorityScore(customer.totalSpentCentavos, customer.orderCount, customer.daysSinceLastOrder)
  const churn    = getChurnRisk(customer.daysSinceLastOrder)
  const action   = getRecommendedAction(priority, churn, customer.daysSinceLastOrder, customer.orderCount, suppressed)

  const segmentLabel: Record<string, string> = {
    vip: 'VIP', hot: 'Recorrente', new: 'Novo', at_risk: 'Em risco',
  }
  const segmentColors: Record<string, string> = {
    vip: '#C9A84C', hot: '#fb923c', new: '#60a5fa', at_risk: '#f87171',
  }
  const displaySegment = isVip ? 'vip' : customer.segment
  const segColor = segmentColors[displaySegment] ?? '#888'

  async function handleMarkVip() {
    if (vipWorking) return
    const newTags = isVip
      ? customer.segmentTags.filter((t) => t !== 'vip')
      : [...customer.segmentTags.filter((t) => t !== 'vip'), 'vip']

    setVipWorking(true)
    try {
      const res = await fetch(
        `/api/crm/manager?phone=${encodeURIComponent(phone)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentTags: newTags }),
        }
      )
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao atualizar')
      setIsVip(!isVip)
      onCustomerUpdate?.(phone, { segmentTags: newTags })
      onToast(isVip ? '✓ Tag VIP removida' : '⭐ Marcado como VIP')
    } catch (e) {
      onToast(`Erro: ${(e as Error).message}`)
    } finally {
      setVipWorking(false)
    }
  }

  async function handleSilence() {
    if (suppressWorking) return
    setSuppressWorking(true)

    // Optimistic update
    const newSuppressed = !suppressed
    setSuppressed(newSuppressed)

    const newUntil = newSuppressed
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null

    try {
      await apiSetSuppression(phone, newUntil)
      const patchFields: Partial<ManagerCliente> = {
        suppressedUntil:  newUntil,
        suppressedReason: newSuppressed ? '7-day operator silence' : null,
        suppressedBy:     null,
      }
      onCustomerUpdate?.(phone, patchFields)
      onToast(newSuppressed ? '💤 Silenciado por 7 dias' : '🔔 Silêncio removido')
    } catch (e) {
      // Revert optimistic update on failure
      setSuppressed(suppressed)
      onToast(`Erro: ${(e as Error).message}`)
    } finally {
      setSuppressWorking(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 500,
        backgroundColor: '#0c0c0c',
        borderLeft: '1px solid #1e1e1e',
        zIndex: 50, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ── Sticky header ── */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #1e1e1e',
          backgroundColor: '#0c0c0c',
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#F5F0E8' }}>{customer.name}</span>
                {displaySegment !== 'none' && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    color: segColor, backgroundColor: segColor + '22', textTransform: 'uppercase',
                  }}>
                    {segmentLabel[displaySegment] ?? displaySegment}
                  </span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                  color: priority.color, backgroundColor: priority.color + '22',
                }}>
                  {priority.icon} {priority.label}
                </span>
                {suppressed && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    color: '#555', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                  }}>
                    💤 Silenciado
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#444', marginTop: 3 }}>{customer.phone}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          {/* Recommended action banner */}
          <div style={{
            marginTop: 12,
            backgroundColor: '#0f120e',
            border: '1px solid #1e2a1e',
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 9, color: '#3a5a3a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                Próxima ação recomendada
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7ec87e' }}>
                {action.emoji} {action.text}
              </div>
            </div>
            <button
              onClick={() => {
                if (action.cta === 'message') openWhatsApp(customer.phone, customer.name)
                else if (action.cta === 'campaign') openCampaignCreation(customer.phone)
              }}
              style={{
                fontSize: 11, fontWeight: 600,
                backgroundColor: '#1a2e1a', border: '1px solid #2e4a2e',
                color: '#7ec87e', borderRadius: 6, padding: '6px 12px',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              Executar →
            </button>
          </div>

          {/* ── Ações rápidas ── */}
          <div style={{ marginTop: 12 }}>
            <div style={{
              fontSize: 9, color: '#2e2e2e', textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 7,
            }}>
              Ações rápidas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <DrawerActionBtn
                label="💬 Enviar mensagem agora"
                onClick={() => openWhatsApp(customer.phone, customer.name)}
              />
              <DrawerActionBtn
                label={isVip ? '⭐ Remover VIP' : '⭐ Marcar VIP'}
                active={isVip}
                loading={vipWorking}
                onClick={handleMarkVip}
              />
              <DrawerActionBtn
                label="🎯 Adicionar em campanha"
                onClick={() => openCampaignCreation(customer.phone)}
              />
              <DrawerActionBtn
                label={suppressed ? '🔔 Remover silêncio' : '💤 Silenciar 7 dias'}
                active={suppressed}
                loading={suppressWorking}
                onClick={handleSilence}
              />
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {loading && <div style={{ color: '#333', fontSize: 13 }}>Carregando…</div>}
          {error   && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}

          {/* ── Customer Value Block ── */}
          <DrawerSection title="Valor do Cliente">
            <ValueGrid customer={customer} priority={priority} automations={automations} />
          </DrawerSection>

          {/* ── Acquisition / Source ── */}
          <DrawerSection title="Aquisição">
            <AcquisitionBlock customer={customer} />
          </DrawerSection>

          {/* ── Order History ── */}
          {detail && detail.pedidos.length > 0 && (
            <DrawerSection title={`Pedidos (${detail.pedidos.length})`}>
              <OrderList pedidos={detail.pedidos} />
            </DrawerSection>
          )}

          {/* ── Automation History ── */}
          {automations.length > 0 && (
            <DrawerSection title={`Automações (${automations.length})`}>
              <AutomationList entries={automations} />
            </DrawerSection>
          )}

          {/* ── Consent ── */}
          {detail && (
            <DrawerSection title="Consentimento">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ConsentLine label="Pedidos (transacional)" value={detail.cliente.consentOrderUpdates} />
                <ConsentLine label="Relacionamento"          value={detail.cliente.consentRelational} />
                <ConsentLine label="Promoções"               value={detail.cliente.consentPromotional} />
              </div>
            </DrawerSection>
          )}

          {/* ── Consent Log ── */}
          {detail && detail.consentLogs.length > 0 && (
            <DrawerSection title="Log de Consentimento">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {detail.consentLogs.map((l) => (
                  <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#666' }}>
                    <span style={{ color: l.granted ? '#4ade80' : '#f87171', fontSize: 13 }}>{l.granted ? '✓' : '✗'}</span>
                    <span style={{ color: '#888' }}>{l.category}</span>
                    <span>via {l.source}</span>
                    <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#444' }}>{dtFull(l.grantedAt)}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Drawer sub-components ────────────────────────────────────────────────────

function DrawerActionBtn({
  label,
  active   = false,
  loading  = false,
  onClick,
}: {
  label:    string
  active?:  boolean
  loading?: boolean
  onClick:  () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: 11, fontWeight: active ? 700 : 500,
        padding: '7px 10px', borderRadius: 7,
        border: `1px solid ${active ? '#2e2a20' : hov ? '#333' : '#1e1e1e'}`,
        backgroundColor: active ? '#1a1710' : hov ? '#161616' : '#111',
        color: active ? '#C9A84C' : hov ? '#bbb' : '#666',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.5 : 1,
        transition: 'color 0.1s, border-color 0.1s, background-color 0.1s',
        textAlign: 'left' as const,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {loading ? '…' : label}
    </button>
  )
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#333',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid #1a1a1a',
      }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function ValueGrid({
  customer,
  priority,
  automations,
}: {
  customer:    ManagerCliente
  priority:    Priority
  automations: AutomationEntry[]
}) {
  const avgTicket      = customer.orderCount > 0 ? Math.round(customer.totalSpentCentavos / customer.orderCount) : 0
  const recoveredTotal = automations.reduce((s, a) => s + (a.recoveredRevenueCentavos ?? 0), 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
      <ValueTile label="Gasto total"     value={brl(customer.totalSpentCentavos)} />
      <ValueTile label="Ticket médio"    value={avgTicket > 0 ? brl(avgTicket) : '—'} />
      <ValueTile
        label="🔥 Potencial 3m"
        value={priority.futureCents > 0 ? brl(priority.futureCents) : '—'}
        highlight
      />
      <ValueTile
        label="Receita recuperada"
        value={recoveredTotal > 0 ? brl(recoveredTotal) : '—'}
        dimWhenEmpty={recoveredTotal === 0}
      />
      <ValueTile label="Pedidos"         value={String(customer.orderCount)} />
      <ValueTile label="Sem pedir"       value={silenciaLabel(customer.daysSinceLastOrder)} />
    </div>
  )
}

function ValueTile({
  label, value, highlight = false, dimWhenEmpty = false,
}: {
  label: string; value: string; highlight?: boolean; dimWhenEmpty?: boolean
}) {
  return (
    <div style={{
      backgroundColor: highlight ? 'rgba(201,168,76,0.07)' : '#111',
      border: `1px solid ${highlight ? 'rgba(201,168,76,0.18)' : '#1a1a1a'}`,
      borderRadius: 7, padding: '8px 10px',
    }}>
      <div style={{ fontSize: 9, color: highlight ? '#a07c30' : '#333', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? '#C9A84C' : dimWhenEmpty ? '#2a2a2a' : '#ccc' }}>
        {value}
      </div>
    </div>
  )
}

function AcquisitionBlock({ customer }: { customer: ManagerCliente }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
      <KV label="Telefone"     value={customer.phone} />
      <KV label="E-mail"       value={customer.email ?? '—'} />
      <KV label="Canal"        value={customer.latestSource ?? '—'} />
      <KV label="Campanha"     value={customer.latestCampaign ?? '—'} />
      <KV label="Primeiro contato" value={dtFull(customer.firstSeenAt)} />
      <KV label="Último pedido"    value={customer.lastOrderAt ? dtFull(customer.lastOrderAt) : '—'} />
    </div>
  )
}

function OrderList({ pedidos }: { pedidos: ManagerDetail['pedidos'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pedidos.map((p) => (
        <div key={p.id} style={{
          backgroundColor: '#111', border: '1px solid #1a1a1a',
          borderRadius: 7, padding: '9px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#F5F0E8', fontWeight: 600 }}>{brl(p.total)}</span>
            <span style={{ fontSize: 11, color: '#444' }}>{dtFull(p.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Tag text={p.source} />
            {p.context && p.context !== p.source && <Tag text={p.context} />}
            {p.attribution?.utm_campaign && <Tag text={p.attribution.utm_campaign} gold />}
          </div>
        </div>
      ))}
    </div>
  )
}

function AutomationList({ entries }: { entries: AutomationEntry[] }) {
  const STATUS_COLOR: Record<string, string> = {
    sent:    '#4ade80',
    failed:  '#f87171',
    skipped: '#555',
    pending: '#eab308',
  }
  const FLOW_LABEL: Record<string, string> = {
    at_risk:      'Em risco',
    new_customer: 'Novo cliente',
    vip:          'VIP',
    low_sales:    'Baixo volume',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map((e) => (
        <div key={e.id} style={{
          backgroundColor: '#111', border: '1px solid #1a1a1a',
          borderRadius: 7, padding: '9px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: STATUS_COLOR[e.status] ?? '#888',
                backgroundColor: (STATUS_COLOR[e.status] ?? '#888') + '18',
                borderRadius: 4, padding: '1px 6px',
              }}>
                {e.status.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: '#666' }}>{FLOW_LABEL[e.flow] ?? e.flow}</span>
            </div>
            <span style={{ fontSize: 11, color: '#333', flexShrink: 0 }}>{dtFull(e.triggeredAt)}</span>
          </div>
          {e.recoveredRevenueCentavos && e.recoveredRevenueCentavos > 0 && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#4ade80' }}>
              ↩ Recuperado: {brl(e.recoveredRevenueCentavos)} em {dtFull(e.recoveredAt ?? null)}
            </div>
          )}
          {e.lastError && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#f87171', opacity: 0.7 }}>
              Erro: {e.lastError}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Tag({ text, gold = false }: { text: string; gold?: boolean }) {
  return (
    <span style={{
      fontSize: 10, borderRadius: 4, padding: '1px 6px',
      backgroundColor: gold ? 'rgba(201,168,76,0.12)' : '#1a1a1a',
      color: gold ? '#C9A84C' : '#555',
      border: `1px solid ${gold ? 'rgba(201,168,76,0.2)' : '#222'}`,
    }}>
      {text}
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#444',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function ConsentLine({ label, value }: { label: string; value: boolean | null }) {
  const color = value === true ? '#4ade80' : value === false ? '#f87171' : '#333'
  const text  = value === true ? 'Sim' : value === false ? 'Não' : 'Sem registro'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color, fontSize: 13 }}>●</span>
      <span style={{ color: '#555', flex: 1 }}>{label}</span>
      <span style={{ color }}>{text}</span>
    </div>
  )
}

// ─── CRM Tab bar ──────────────────────────────────────────────────────────────

type CrmTab = 'clientes' | 'kanban' | 'campanhas' | 'automacoes'

const CRM_TABS: { id: CrmTab; label: string; href: string }[] = [
  { id: 'clientes',   label: 'Clientes',   href: '/manager' },
  { id: 'kanban',     label: 'Kanban',     href: '/crm-kanban' },
  { id: 'campanhas',  label: 'Campanhas',  href: '/campaigns' },
  { id: 'automacoes', label: 'Automações', href: '/crm-automacoes' },
]

function CrmTabBar({ active }: { active: CrmTab }) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 0,
      borderBottom: '1px solid #1e1e1e', paddingBottom: 0,
      paddingLeft: 24,
      backgroundColor: '#111',
    }}>
      {CRM_TABS.map(({ id, label, href }) => {
        const isActive = active === id
        return (
          <a
            key={id}
            href={href}
            style={{
              textDecoration: 'none',
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#F5F0E8' : '#555',
              padding: '12px 4px',
              borderBottom: `2px solid ${isActive ? '#C9A84C' : 'transparent'}`,
              transition: 'color 0.12s',
              display: 'inline-block',
            }}
          >
            {label}
          </a>
        )
      })}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#1e1e1e', border: '1px solid #333',
      color: '#F5F0E8', fontSize: 13, fontWeight: 500,
      padding: '10px 20px', borderRadius: 8,
      zIndex: 100, whiteSpace: 'nowrap',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    }}>
      {message}
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

type BoardData = Record<CustomerSegment, ManagerCliente[]>

export default function CrmKanban() {
  const [data, setData]               = useState<BoardData>({ vip: [], frequente: [], novo: [], ativo: [], dias_20_30: [], dias_30_45: [], dias_50_plus: [], none: [] })
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<ManagerCliente | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [toast, setToast]             = useState<string | null>(null)

  const loadAll = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAllCustomers()
      .then((customers) => {
        setData(groupBySegment(customers))
        setLastRefresh(new Date())
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleAction = useCallback((
    key: ActionKey,
    customer: ManagerCliente,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()

    if (key === 'message') {
      openWhatsApp(customer.phone, customer.name)
      return
    }

    if (key === 'vip') {
      // No dedicated VIP-mark endpoint yet — open drawer so operator can act
      setSelectedCustomer(customer)
      setToast(`📋 Perfil aberto — marque manualmente como VIP`)
      return
    }

    if (key === 'campaign') {
      openCampaignCreation()
    }
  }, [])

  const totalCustomers = COLUMNS.reduce((acc, col) => acc + data[col.segment].length, 0)
  const totalRevenue   = COLUMNS.reduce(
    (acc, col) => acc + data[col.segment].reduce((s, c) => s + c.totalSpentCentavos, 0), 0
  )

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0A0A0A',
      color: '#F5F0E8',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ backgroundColor: '#111' }}>
        <div style={{
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>
              CRM — Marujos Sushi
            </span>
            <span style={{ marginLeft: 10, color: '#333', fontSize: 12 }}>painel interno</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#444', fontSize: 12 }}>
              {totalCustomers} clientes · {brl(totalRevenue)} receita total
            </span>
            <span style={{ color: '#333', fontSize: 12 }}>
              {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={loadAll}
              style={{
                backgroundColor: '#161616', border: '1px solid #2a2a2a',
                color: '#ccc', borderRadius: 8,
                padding: '6px 14px', cursor: 'pointer', fontSize: 13,
              }}
            >
              Atualizar
            </button>
          </div>
        </div>
        <CrmTabBar active="kanban" />
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          color: '#f87171', fontSize: 13,
          padding: '10px 24px', margin: '16px 24px 0',
          borderRadius: 8,
        }}>
          Erro ao carregar: {error}
        </div>
      )}

      {/* Board */}
      <div style={{
        display: 'flex',
        gap: 14,
        padding: '20px 24px',
        overflowX: 'auto',
        alignItems: 'flex-start',
        minHeight: 'calc(100vh - 70px)',
      }}>
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.segment}
            col={col}
            customers={data[col.segment]}
            loading={loading}
            onCardClick={(c) => setSelectedCustomer(c)}
            onAction={handleAction}
          />
        ))}
      </div>

      {selectedCustomer && (
        <DetailDrawer
          phone={selectedCustomer.phone}
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onToast={(msg) => setToast(msg)}
          onCustomerUpdate={(phone, patch) => {
            setData((prev) => {
              const next = { ...prev }
              for (const seg of Object.keys(next) as CustomerSegment[]) {
                next[seg] = next[seg].map((c) =>
                  c.phone === phone ? { ...c, ...patch } : c
                )
              }
              return next
            })
            if (selectedCustomer.phone === phone) {
              setSelectedCustomer((c) => c ? { ...c, ...patch } : c)
            }
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
