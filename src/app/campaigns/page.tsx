'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  Campaign,
  CampaignClass,
  CampaignMetrics,
  CampaignType,
  CampaignStatus,
  CampaignWithMetrics,
  TargetSegment,
  ExecutionFlow,
  ExecutionStats,
} from '@/app/api/campaigns/route'
import { classifyCampaign } from '@/app/api/campaigns/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

function dtShort(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CampaignType, string> = {
  instagram: 'Instagram',
  google:    'Google Ads',
  whatsapp:  'WhatsApp',
  email:     'E-mail',
  flyer:     'Flyer / Físico',
  other:     'Outro',
}

const TYPE_COLOR: Record<CampaignType, string> = {
  instagram: '#e1306c',
  google:    '#4285f4',
  whatsapp:  '#25d366',
  email:     '#C9A84C',
  flyer:     '#a78bfa',
  other:     '#8A8A8A',
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft:  'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  ended:  'Encerrada',
}

const STATUS_COLOR: Record<CampaignStatus, string> = {
  draft:  '#555',
  active: '#4ade80',
  paused: '#facc15',
  ended:  '#8A8A8A',
}

const TYPES:    CampaignType[]   = ['instagram', 'google', 'whatsapp', 'email', 'flyer', 'other']
const STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'ended']

const CLASS_CFG: Record<CampaignClass, { label: string; color: string; hint: string }> = {
  testing:    { label: 'Testando',   color: '#60a5fa', hint: 'Sem receita atribuída ainda' },
  scaling:    { label: 'Escalando',  color: '#facc15', hint: 'ROAS 1–3× — potencial de escala' },
  profitable: { label: 'Lucrativa',  color: '#4ade80', hint: 'ROAS ≥ 3×' },
  losing:     { label: 'Negativo',   color: '#f87171', hint: 'ROAS < 1× — gasto > receita' },
}

const SEGMENT_LABELS: Record<TargetSegment, string> = {
  at_risk:      'Em risco (7–30 dias inativo)',
  new_customer: 'Novos clientes (últimas 48h)',
  vip:          'VIP (≥5 pedidos ou ≥R$300)',
  custom:       'Personalizado',
}

const FLOW_LABELS: Record<ExecutionFlow, string> = {
  at_risk:      'Reativação — em risco',
  new_customer: 'Boas-vindas',
  vip:          'Oferta VIP',
  reactivation: 'Reativação geral',
  upsell:       'Upsell / novidades',
}

const SEGMENTS: TargetSegment[] = ['at_risk', 'new_customer', 'vip', 'custom']
const FLOWS:    ExecutionFlow[]  = ['at_risk', 'new_customer', 'vip', 'reactivation', 'upsell']

function fmt(centavos: number | null | undefined): string {
  if (centavos == null) return '—'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtRoas(spend: number | null, revenue: number): string {
  if (!spend || spend === 0) return '—'
  return `${(revenue / spend).toFixed(2)}×`
}

function fmtCpa(spend: number | null, orders: number): string {
  if (!spend || spend === 0 || orders === 0) return '—'
  return fmt(Math.round(spend / orders))
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
    color: '#F5F0E8',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 14,
  } as React.CSSProperties,

  header: {
    backgroundColor: '#111',
    padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  } as React.CSSProperties,

  tabBar: {
    display: 'flex', gap: 4, marginBottom: 0,
    borderBottom: '1px solid #1e1e1e', paddingBottom: 0,
    paddingLeft: 24,
    backgroundColor: '#111',
  } as React.CSSProperties,

  body: {
    padding: '20px 24px',
    maxWidth: 1400,
    margin: '0 auto',
  } as React.CSSProperties,

  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as React.CSSProperties,

  th: {
    textAlign: 'left' as const, padding: '7px 12px',
    color: '#444', fontSize: 11,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    borderBottom: '1px solid #1e1e1e', fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  td: {
    padding: '11px 12px', borderBottom: '1px solid #131313',
    verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  overlay: {
    position: 'fixed' as const, inset: 0,
    backgroundColor: 'rgba(0,0,0,0.70)', zIndex: 100,
    display: 'flex', justifyContent: 'flex-end',
  } as React.CSSProperties,

  drawer: {
    backgroundColor: '#0d0d0d', width: '100%', maxWidth: 600,
    height: '100vh', overflowY: 'auto' as const,
    borderLeft: '1px solid #1e1e1e',
  } as React.CSSProperties,

  card: {
    backgroundColor: '#111', border: '1px solid #1e1e1e',
    borderRadius: 12, padding: 16, marginBottom: 12,
  } as React.CSSProperties,

  secTitle: {
    fontSize: 10, color: '#444',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    marginBottom: 10, fontWeight: 600,
  } as React.CSSProperties,

  btn: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#ccc', fontSize: 13,
    padding: '6px 14px', cursor: 'pointer',
  } as React.CSSProperties,

  btnPrimary: {
    backgroundColor: '#C9A84C', border: 'none',
    borderRadius: 8, color: '#0A0A0A', fontWeight: 700,
    fontSize: 13, padding: '7px 16px', cursor: 'pointer',
  } as React.CSSProperties,

  input: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '8px 12px', outline: 'none', width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  textarea: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '8px 12px', outline: 'none', width: '100%',
    boxSizing: 'border-box' as const, resize: 'vertical' as const,
    minHeight: 72,
  } as React.CSSProperties,

  select: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '8px 12px', outline: 'none', width: '100%',
    cursor: 'pointer', boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  fLabel: {
    fontSize: 11, color: '#555',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    marginBottom: 5, display: 'block',
  } as React.CSSProperties,
}

// ─── CRM Tab bar ──────────────────────────────────────────────────────────────

const CRM_TABS = [
  { id: 'clientes',   label: 'Clientes',   href: '/manager' },
  { id: 'kanban',     label: 'Kanban',     href: '/crm-kanban' },
  { id: 'campanhas',  label: 'Campanhas',  href: '/campaigns' },
  { id: 'automacoes', label: 'Automações', href: '/crm-automacoes' },
]

function CrmTabBar() {
  return (
    <div style={S.tabBar}>
      {CRM_TABS.map(({ id, label, href }) => {
        const isActive = id === 'campanhas'
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

// ─── Badges ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CampaignType }) {
  const color = TYPE_COLOR[type]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px',
      borderRadius: 100, border: `1px solid ${color}30`,
      color, backgroundColor: `${color}15`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const color = STATUS_COLOR[status]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px',
      borderRadius: 100, border: `1px solid ${color}40`,
      color, backgroundColor: `${color}18`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ClassBadge({ cls }: { cls: CampaignClass }) {
  const cfg = CLASS_CFG[cls]
  return (
    <span title={cfg.hint} style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 100, border: `1px solid ${cfg.color}40`,
      color: cfg.color, backgroundColor: `${cfg.color}15`,
      textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'default',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  campaignName: string
  campaignType: CampaignType
  status:       CampaignStatus
  utmCampaign:  string
  utmSource:    string
  utmMedium:    string
  startDate:    string
  endDate:      string
  description:  string
  audience:     string
  observations: string
  budgetTotal:  string  // BRL string — converted to centavos on save
  spend:        string  // BRL string — converted to centavos on save
  // ── Targeting ─────────────────────────────────────────────────────────────
  targetSegment:            string   // TargetSegment | ''
  targetFlow:               string   // ExecutionFlow | ''
  filterMinOrderCount:      string
  filterMaxOrderCount:      string
  filterMinTotalSpent:      string   // BRL
  filterMinDaysSinceOrder:  string
  filterMaxDaysSinceOrder:  string
}

function emptyForm(): FormState {
  return {
    campaignName: '', campaignType: 'instagram', status: 'draft',
    utmCampaign: '', utmSource: '', utmMedium: '',
    startDate: '', endDate: '',
    description: '', audience: '', observations: '',
    budgetTotal: '', spend: '',
    targetSegment: '', targetFlow: '',
    filterMinOrderCount: '', filterMaxOrderCount: '',
    filterMinTotalSpent: '',
    filterMinDaysSinceOrder: '', filterMaxDaysSinceOrder: '',
  }
}

function campaignToForm(c: Campaign): FormState {
  const t = c.targeting
  const f = t?.filters ?? {}
  return {
    campaignName: c.campaignName,
    campaignType: c.campaignType,
    status:       c.status,
    utmCampaign:  c.utmCampaign  ?? '',
    utmSource:    c.utmSource    ?? '',
    utmMedium:    c.utmMedium    ?? '',
    startDate:    c.startDate    ?? '',
    endDate:      c.endDate      ?? '',
    description:  c.description  ?? '',
    audience:     c.audience     ?? '',
    observations: c.observations ?? '',
    budgetTotal:  c.budgetTotal != null ? String(c.budgetTotal / 100) : '',
    spend:        c.spend        != null ? String(c.spend        / 100) : '',
    targetSegment:           t?.segment ?? '',
    targetFlow:              t?.flow    ?? '',
    filterMinOrderCount:     f.minOrderCount         != null ? String(f.minOrderCount)         : '',
    filterMaxOrderCount:     f.maxOrderCount         != null ? String(f.maxOrderCount)         : '',
    filterMinTotalSpent:     f.minTotalSpent         != null ? String(f.minTotalSpent / 100)   : '',
    filterMinDaysSinceOrder: f.minDaysSinceLastOrder != null ? String(f.minDaysSinceLastOrder) : '',
    filterMaxDaysSinceOrder: f.maxDaysSinceLastOrder != null ? String(f.maxDaysSinceLastOrder) : '',
  }
}

/** Build targeting JSONB from form state. Returns null when no segment is chosen. */
function formToTargeting(f: FormState): object | null {
  if (!f.targetSegment && !f.targetFlow) return null
  const filters: Record<string, number> = {}
  if (f.filterMinOrderCount)     filters.minOrderCount         = parseInt(f.filterMinOrderCount, 10)
  if (f.filterMaxOrderCount)     filters.maxOrderCount         = parseInt(f.filterMaxOrderCount, 10)
  if (f.filterMinTotalSpent) {
    const n = parseFloat(f.filterMinTotalSpent.replace(',', '.'))
    if (!isNaN(n)) filters.minTotalSpent = Math.round(n * 100)
  }
  if (f.filterMinDaysSinceOrder) filters.minDaysSinceLastOrder = parseInt(f.filterMinDaysSinceOrder, 10)
  if (f.filterMaxDaysSinceOrder) filters.maxDaysSinceLastOrder = parseInt(f.filterMaxDaysSinceOrder, 10)
  return {
    segment: f.targetSegment || null,
    flow:    f.targetFlow    || null,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  }
}

/** Parse a BRL string ("150.00" or "150,00") → centavos integer or null */
function parseBRL(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricBox({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      backgroundColor: accent ? '#1a1200' : '#111',
      border: `1px solid ${accent ? '#C9A84C40' : '#1e1e1e'}`,
      borderRadius: 10, padding: '12px 16px',
    }}>
      <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 900, color: accent ? '#C9A84C' : '#F5F0E8' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

// ─── Campaign form ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={S.fLabel}>{label}</label>
      {children}
    </div>
  )
}

function CampaignForm({
  initial, onSave, onCancel, busy, error,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  busy: boolean
  error: string | null
}) {
  const [f, setF] = useState<FormState>(initial)
  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setF((prev) => ({ ...prev, [k]: v })) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{
          backgroundColor: '#3f0707', border: '1px solid #7f1d1d',
          borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Row: name + type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
        <Field label="Nome da campanha *">
          <input
            style={S.input}
            value={f.campaignName}
            onChange={(e) => set('campaignName', e.target.value)}
            placeholder="Ex: Promoção de Verão"
          />
        </Field>
        <Field label="Tipo *">
          <select style={{ ...S.select, width: 160 }} value={f.campaignType}
            onChange={(e) => set('campaignType', e.target.value as CampaignType)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
      </div>

      {/* Row: status + dates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 12 }}>
        <Field label="Status *">
          <select style={{ ...S.select, width: 140 }} value={f.status}
            onChange={(e) => set('status', e.target.value as CampaignStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field label="Data de início">
          <input type="date" style={S.input} value={f.startDate}
            onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Data de fim">
          <input type="date" style={S.input} value={f.endDate}
            onChange={(e) => set('endDate', e.target.value)} />
        </Field>
      </div>

      {/* UTM params */}
      <div style={{
        backgroundColor: '#111', border: '1px solid #1e1e1e',
        borderRadius: 10, padding: '14px 16px',
      }}>
        <p style={S.secTitle}>Rastreamento UTM</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="utm_campaign">
            <input style={S.input} value={f.utmCampaign}
              onChange={(e) => set('utmCampaign', e.target.value)}
              placeholder="verao2025" />
          </Field>
          <Field label="utm_source">
            <input style={S.input} value={f.utmSource}
              onChange={(e) => set('utmSource', e.target.value)}
              placeholder="instagram" />
          </Field>
          <Field label="utm_medium">
            <input style={S.input} value={f.utmMedium}
              onChange={(e) => set('utmMedium', e.target.value)}
              placeholder="cpc" />
          </Field>
        </div>
        <p style={{ fontSize: 11, color: '#333', marginTop: 8 }}>
          O campo <strong style={{ color: '#555' }}>utm_campaign</strong> é a chave de rastreamento
          — deve coincidir exatamente com o parâmetro usado nos links da campanha.
        </p>
      </div>

      {/* Audience + description */}
      <Field label="Público-alvo">
        <input style={S.input} value={f.audience}
          onChange={(e) => set('audience', e.target.value)}
          placeholder="Ex: clientes VIP, novos seguidores no Instagram…" />
      </Field>

      <Field label="Descrição">
        <textarea style={S.textarea} value={f.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Objetivo e contexto da campanha…" />
      </Field>

      <Field label="Observações">
        <textarea style={{ ...S.textarea, minHeight: 52 }} value={f.observations}
          onChange={(e) => set('observations', e.target.value)}
          placeholder="Notas internas, resultados qualitativos…" />
      </Field>

      {/* Budget / spend */}
      <div style={{
        backgroundColor: '#111', border: '1px solid #1e1e1e',
        borderRadius: 10, padding: '14px 16px',
      }}>
        <p style={S.secTitle}>Investimento em mídia</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Orçamento total (R$)">
            <input style={S.input} value={f.budgetTotal} type="number" min="0" step="0.01"
              onChange={(e) => set('budgetTotal', e.target.value)}
              placeholder="Ex: 500.00" />
          </Field>
          <Field label="Gasto real (R$)">
            <input style={S.input} value={f.spend} type="number" min="0" step="0.01"
              onChange={(e) => set('spend', e.target.value)}
              placeholder="Ex: 432.50" />
          </Field>
        </div>
        <p style={{ fontSize: 11, color: '#333', marginTop: 8 }}>
          CPA e ROAS são calculados automaticamente a partir do gasto real e dos pedidos atribuídos via UTM.
        </p>
      </div>

      {/* Segmentação CRM */}
      <div style={{
        backgroundColor: '#111', border: '1px solid #1e1e1e',
        borderRadius: 10, padding: '14px 16px',
      }}>
        <p style={S.secTitle}>Segmentação CRM</p>
        <p style={{ fontSize: 11, color: '#333', marginBottom: 12 }}>
          Define quem receberá as mensagens quando você executar esta campanha via CRM.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Segmento">
            <select style={S.select} value={f.targetSegment}
              onChange={(e) => set('targetSegment', e.target.value)}>
              <option value="">— Não definido —</option>
              {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Tipo de mensagem (flow)">
            <select style={S.select} value={f.targetFlow}
              onChange={(e) => set('targetFlow', e.target.value)}>
              <option value="">— Não definido —</option>
              {FLOWS.map((fl) => <option key={fl} value={fl}>{FLOW_LABELS[fl]}</option>)}
            </select>
          </Field>
        </div>

        {f.targetSegment === 'custom' && (
          <>
            <p style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>Filtros personalizados (aplicados em adição ao segmento)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label="Pedidos mín.">
                <input type="number" min="0" style={S.input} value={f.filterMinOrderCount}
                  onChange={(e) => set('filterMinOrderCount', e.target.value)} placeholder="Ex: 2" />
              </Field>
              <Field label="Pedidos máx.">
                <input type="number" min="0" style={S.input} value={f.filterMaxOrderCount}
                  onChange={(e) => set('filterMaxOrderCount', e.target.value)} placeholder="Ex: 10" />
              </Field>
              <Field label="Gasto mín. (R$)">
                <input type="number" min="0" step="0.01" style={S.input} value={f.filterMinTotalSpent}
                  onChange={(e) => set('filterMinTotalSpent', e.target.value)} placeholder="Ex: 100.00" />
              </Field>
              <Field label="Dias inativo (mín.)">
                <input type="number" min="0" style={S.input} value={f.filterMinDaysSinceOrder}
                  onChange={(e) => set('filterMinDaysSinceOrder', e.target.value)} placeholder="Ex: 7" />
              </Field>
              <Field label="Dias inativo (máx.)">
                <input type="number" min="0" style={S.input} value={f.filterMaxDaysSinceOrder}
                  onChange={(e) => set('filterMaxDaysSinceOrder', e.target.value)} placeholder="Ex: 30" />
              </Field>
            </div>
          </>
        )}

        {!f.targetSegment && !f.targetFlow && (
          <p style={{ fontSize: 11, color: '#2a2a2a' }}>
            Sem segmentação configurada — esta campanha não poderá ser executada pelo CRM.
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button style={S.btn} onClick={onCancel}>Cancelar</button>
        <button style={{ ...S.btnPrimary, flex: 1 }} onClick={() => onSave(f)} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar campanha'}
        </button>
      </div>
    </div>
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

interface ExecuteResult {
  targeted: number
  inserted: number
  skipped:  number
  detail:   string[]
}

function DetailDrawer({
  campaign, onClose, onEdit, onDelete,
}: {
  campaign: Campaign
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState<ExecuteResult | null>(null)
  const [execError, setExecError]   = useState<string | null>(null)
  const [execStats, setExecStats]   = useState<ExecutionStats | null>(campaign.executionStats ?? null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/campaigns?id=${campaign.id}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json() as { campaign: CampaignWithMetrics }
        if (!cancelled) setMetrics(json.campaign.metrics)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [campaign.id])

  async function handleExecute() {
    if (executing) return
    if (!campaign.targeting?.segment && !campaign.targeting?.flow) {
      setExecError('Configure a segmentação antes de executar.')
      return
    }
    if (!confirm(`Executar campanha "${campaign.campaignName}"?\n\nIsso irá criar entradas pendentes na fila de automações para todos os clientes que correspondam à segmentação configurada.`)) return
    setExecuting(true)
    setExecResult(null)
    setExecError(null)
    try {
      const res = await fetch('/api/campaigns/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id }),
      })
      const json = await res.json() as { ok?: boolean; error?: string; targeted?: number; inserted?: number; skipped?: number; detail?: string[] }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setExecResult({
        targeted: json.targeted ?? 0,
        inserted: json.inserted ?? 0,
        skipped:  json.skipped  ?? 0,
        detail:   json.detail   ?? [],
      })
      setExecStats({
        lastRunAt:        new Date().toISOString(),
        targeted:         json.targeted ?? 0,
        inserted:         json.inserted ?? 0,
        skipped:          json.skipped  ?? 0,
        converted:        execStats?.converted        ?? 0,
        convertedRevenue: execStats?.convertedRevenue ?? 0,
      })
    } catch (e) {
      setExecError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Drawer header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 1,
        }}>
          <div>
            <p style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Campanha
            </p>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#F5F0E8', lineHeight: 1.3, maxWidth: 400 }}>
              {campaign.campaignName}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <TypeBadge type={campaign.campaignType} />
              <StatusBadge status={campaign.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ ...S.btn, fontSize: 18, padding: '2px 10px', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Performance metrics */}
          <p style={S.secTitle}>Performance</p>
          {loading && (
            <p style={{ color: '#333', fontSize: 13, marginBottom: 16 }}>Calculando métricas…</p>
          )}
          {!loading && metrics && (
            <>
              {/* Paid-media KPIs — only shown when spend is set */}
              {campaign.spend != null && campaign.spend > 0 && (() => {
                const cls = classifyCampaign(campaign.spend, metrics.totalRevenue)
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Classificação
                      </span>
                      {cls && <ClassBadge cls={cls} />}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <MetricBox label="Gasto real" value={fmt(campaign.spend)} />
                      <MetricBox label="ROAS" value={fmtRoas(campaign.spend, metrics.totalRevenue)} accent={classifyCampaign(campaign.spend, metrics.totalRevenue) === 'profitable'} />
                      <MetricBox label="CPA" value={fmtCpa(campaign.spend, metrics.generatedOrders)} />
                    </div>
                    {campaign.budgetTotal != null && (
                      <div style={{
                        backgroundColor: '#111', border: '1px solid #1e1e1e',
                        borderRadius: 8, padding: '8px 12px', marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <span style={{ fontSize: 11, color: '#555' }}>Orçamento</span>
                        <div style={{
                          flex: 1, height: 4, borderRadius: 2, backgroundColor: '#1e1e1e', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 2, backgroundColor: '#C9A84C',
                            width: `${Math.min(100, Math.round((campaign.spend / campaign.budgetTotal) * 100))}%`,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#C9A84C', whiteSpace: 'nowrap' }}>
                          {fmt(campaign.spend)} / {fmt(campaign.budgetTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* UTM-attributed performance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <MetricBox label="Pedidos gerados" value={String(metrics.generatedOrders)} />
                <MetricBox label="Clientes impactados" value={String(metrics.impactedCustomers)} />
                <MetricBox label="Receita gerada" value={brl(metrics.totalRevenue)} accent />
                <MetricBox label="Ticket médio" value={brl(metrics.avgTicket)} />
                <MetricBox
                  label="Impacto CMV"
                  value={brl(metrics.cmvImpact)}
                  sub={metrics.totalRevenue > 0 ? `${pct(metrics.cmvPct)} da receita` : undefined}
                />
                <MetricBox
                  label="Margem contrib."
                  value={brl(metrics.totalRevenue - metrics.cmvImpact)}
                  sub={metrics.totalRevenue > 0
                    ? pct(((metrics.totalRevenue - metrics.cmvImpact) / metrics.totalRevenue) * 100)
                    : undefined}
                />
              </div>
            </>
          )}
          {!loading && !metrics && (
            <p style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>Sem dados de performance.</p>
          )}

          {/* Campaign info */}
          <p style={S.secTitle}>Informações</p>
          <div style={S.card}>
            {[
              { label: 'Período', value: campaign.startDate || campaign.endDate
                  ? `${dtShort(campaign.startDate)} → ${dtShort(campaign.endDate)}`
                  : '—' },
              { label: 'utm_campaign', value: campaign.utmCampaign ?? '—' },
              { label: 'utm_source',   value: campaign.utmSource   ?? '—' },
              { label: 'utm_medium',   value: campaign.utmMedium   ?? '—' },
            ].map(({ label, value }, i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', gap: 16,
                paddingBottom: i < 3 ? 8 : 0, marginBottom: i < 3 ? 8 : 0,
                borderBottom: i < 3 ? '1px solid #1a1a1a' : 'none',
              }}>
                <span style={{ color: '#555', fontSize: 12 }}>{label}</span>
                <span style={{
                  fontSize: 12, color: '#F5F0E8', fontFamily: 'monospace',
                  maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{value}</span>
              </div>
            ))}
          </div>

          {campaign.audience && (
            <>
              <p style={S.secTitle}>Público-alvo</p>
              <div style={{ ...S.card, color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>
                {campaign.audience}
              </div>
            </>
          )}

          {campaign.description && (
            <>
              <p style={S.secTitle}>Descrição</p>
              <div style={{ ...S.card, color: '#ccc', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>
                {campaign.description}
              </div>
            </>
          )}

          {campaign.observations && (
            <>
              <p style={S.secTitle}>Observações</p>
              <div style={{ ...S.card, color: '#aaa', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>
                {campaign.observations}
              </div>
            </>
          )}

          {/* ── CRM Execution ─────────────────────────────────────────────── */}
          <p style={{ ...S.secTitle, marginTop: 20 }}>Execução CRM</p>

          {/* Targeting summary */}
          {campaign.targeting?.segment || campaign.targeting?.flow ? (
            <div style={{ ...S.card, marginBottom: 12 }}>
              {campaign.targeting.segment && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Segmento</span>
                  <span style={{ fontSize: 12, color: '#F5F0E8' }}>
                    {SEGMENT_LABELS[campaign.targeting.segment as TargetSegment] ?? campaign.targeting.segment}
                  </span>
                </div>
              )}
              {campaign.targeting.flow && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Mensagem</span>
                  <span style={{ fontSize: 12, color: '#F5F0E8' }}>
                    {FLOW_LABELS[campaign.targeting.flow as ExecutionFlow] ?? campaign.targeting.flow}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#333', marginBottom: 12 }}>
              Sem segmentação — edite a campanha para configurar antes de executar.
            </p>
          )}

          {/* Last execution stats */}
          {execStats && (
            <div style={{
              backgroundColor: '#0e1a0e', border: '1px solid #1a3a1a',
              borderRadius: 10, padding: '12px 14px', marginBottom: 12,
            }}>
              <p style={{ ...S.secTitle, color: '#4ade80', marginBottom: 8 }}>Última execução</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alcançados</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#F5F0E8' }}>{execStats.targeted}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Enfileirados</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>{execStats.inserted}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ignorados</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#555' }}>{execStats.skipped}</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#333', marginTop: 8 }}>
                {new Date(execStats.lastRunAt).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          {/* Execute result (current run) */}
          {execResult && (
            <div style={{
              backgroundColor: '#0a1a0a', border: '1px solid #4ade8040',
              borderRadius: 10, padding: '12px 14px', marginBottom: 12,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>
                ✓ Execução concluída
              </p>
              <p style={{ fontSize: 12, color: '#ccc' }}>
                {execResult.inserted} mensagens enfileiradas · {execResult.skipped} ignoradas · {execResult.targeted} clientes avaliados
              </p>
              {execResult.detail.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 11, color: '#555', cursor: 'pointer' }}>
                    Ver detalhes ({execResult.detail.length} linhas)
                  </summary>
                  <div style={{
                    marginTop: 6, maxHeight: 160, overflowY: 'auto',
                    fontFamily: 'monospace', fontSize: 11, color: '#444', lineHeight: 1.6,
                  }}>
                    {execResult.detail.map((line, i) => <div key={i}>{line}</div>)}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Execute error */}
          {execError && (
            <div style={{
              backgroundColor: '#3f0707', border: '1px solid #7f1d1d',
              borderRadius: 8, padding: '10px 14px', marginBottom: 12,
              color: '#fca5a5', fontSize: 13,
            }}>
              {execError}
            </div>
          )}

          {/* Execute button */}
          <button
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              fontWeight: 700, fontSize: 13, cursor: executing ? 'not-allowed' : 'pointer',
              backgroundColor: executing ? '#1a1a1a' : '#1a3a1a',
              color: executing ? '#555' : '#4ade80',
              marginBottom: 16,
              transition: 'background-color 0.15s',
            }}
            onClick={handleExecute}
            disabled={executing}
          >
            {executing ? '⏳ Executando…' : '▶ Executar campanha'}
          </button>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...S.btnPrimary, flex: 1 }} onClick={onEdit}>Editar campanha</button>
            <button
              style={{ ...S.btn, color: '#ef4444', borderColor: '#7f1d1d' }}
              onClick={onDelete}>
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit drawer ──────────────────────────────────────────────────────────────

function EditDrawer({
  campaign, onClose, onSaved,
}: {
  campaign: Campaign
  onClose: () => void
  onSaved: (updated: Campaign) => void
}) {
  const [form, setForm] = useState<FormState>(campaignToForm(campaign))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(f: FormState) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/campaigns?id=${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: f.campaignName,
          campaignType: f.campaignType,
          status:       f.status,
          utmCampaign:  f.utmCampaign  || null,
          utmSource:    f.utmSource    || null,
          utmMedium:    f.utmMedium    || null,
          startDate:    f.startDate    || null,
          endDate:      f.endDate      || null,
          description:  f.description  || null,
          audience:     f.audience     || null,
          observations: f.observations || null,
          budgetTotal:  parseBRL(f.budgetTotal),
          spend:        parseBRL(f.spend),
          targeting:    formToTargeting(f),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      onSaved(json.campaign as Campaign)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 1,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#F5F0E8' }}>Editar campanha</p>
          <button onClick={onClose} style={{ ...S.btn, fontSize: 18, padding: '2px 10px' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <CampaignForm
            initial={form}
            onSave={handleSave}
            onCancel={onClose}
            busy={busy}
            error={error}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Create drawer ────────────────────────────────────────────────────────────

function CreateDrawer({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: (c: Campaign) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(f: FormState) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: f.campaignName,
          campaignType: f.campaignType,
          status:       f.status,
          utmCampaign:  f.utmCampaign  || null,
          utmSource:    f.utmSource    || null,
          utmMedium:    f.utmMedium    || null,
          startDate:    f.startDate    || null,
          endDate:      f.endDate      || null,
          description:  f.description  || null,
          audience:     f.audience     || null,
          observations: f.observations || null,
          budgetTotal:  parseBRL(f.budgetTotal),
          spend:        parseBRL(f.spend),
          targeting:    formToTargeting(f),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      onCreated(json.campaign as Campaign)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 1,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#F5F0E8' }}>Nova campanha</p>
          <button onClick={onClose} style={{ ...S.btn, fontSize: 18, padding: '2px 10px' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <CampaignForm
            initial={emptyForm()}
            onSave={handleSave}
            onCancel={onClose}
            busy={busy}
            error={error}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface ListFilters {
  status: string
  type: string
  search: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type DrawerState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'detail'; campaign: Campaign }
  | { kind: 'edit';   campaign: Campaign }

export default function CampaignsPage() {
  const [campaigns, setCampaigns]   = useState<Campaign[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [drawer, setDrawer]         = useState<DrawerState>({ kind: 'none' })
  const [filters, setFilters]       = useState<ListFilters>({ status: '', type: '', search: '' })

  const fetchCampaigns = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/campaigns', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { campaigns: Campaign[] }
      setCampaigns(json.campaigns)
    } catch (e) {
      setError('Erro ao carregar campanhas')
      console.error('[campaigns]', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta campanha? Esta ação não pode ser desfeita.')) return
    try {
      const res = await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setDrawer({ kind: 'none' })
    } catch (e) {
      alert('Erro ao excluir: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Filtered list
  const filtered = campaigns.filter((c) => {
    if (filters.status && c.status !== filters.status) return false
    if (filters.type   && c.campaignType !== filters.type) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !c.campaignName.toLowerCase().includes(q) &&
        !(c.utmCampaign ?? '').toLowerCase().includes(q) &&
        !(c.description ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ backgroundColor: '#111' }}>
        <div style={S.header}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>
              CRM — Marujos Sushi
            </span>
            <span style={{ marginLeft: 10, color: '#333', fontSize: 12 }}>painel interno</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button style={S.btn} onClick={() => fetchCampaigns()} disabled={loading}>
              {loading ? '…' : '↻ Atualizar'}
            </button>
            <button style={S.btnPrimary} onClick={() => setDrawer({ kind: 'create' })}>
              + Nova campanha
            </button>
          </div>
        </div>
        <CrmTabBar />
      </div>

      <div style={S.body}>
        {error && (
          <div style={{
            backgroundColor: '#3f0707', border: '1px solid #7f1d1d',
            borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={S.fLabel}>Busca</span>
            <input
              style={{ ...S.input, width: 240 }}
              placeholder="Nome, utm_campaign…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={S.fLabel}>Status</span>
            <select style={{ ...S.select, width: 160 }} value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Todos</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={S.fLabel}>Tipo</span>
            <select style={{ ...S.select, width: 160 }} value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
              <option value="">Todos</option>
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          {(filters.status || filters.type || filters.search) && (
            <button style={{ ...S.btn, alignSelf: 'flex-end' }}
              onClick={() => setFilters({ status: '', type: '', search: '' })}>
              × Limpar filtros
            </button>
          )}
        </div>

        {/* Campaign count */}
        <p style={{ fontSize: 12, color: '#444', marginBottom: 12 }}>
          {filtered.length} campanha{filtered.length !== 1 ? 's' : ''}
          {filters.status || filters.type || filters.search ? ' (filtrado)' : ''}
        </p>

        {/* Table */}
        {loading && campaigns.length === 0 && (
          <p style={{ color: '#333', textAlign: 'center', padding: '60px 0' }}>Carregando…</p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 0',
            color: '#333', fontSize: 14,
          }}>
            {campaigns.length === 0
              ? 'Nenhuma campanha cadastrada. Crie a primeira!'
              : 'Nenhuma campanha corresponde aos filtros.'}
          </div>
        )}

        {filtered.length > 0 && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Campanha</th>
                <th style={S.th}>Tipo</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Período</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Gasto</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Receita</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>Pedidos</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>ROAS</th>
                <th style={{ ...S.th, textAlign: 'right' as const }}>CPA</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDrawer({ kind: 'detail', campaign: c })}>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600, color: '#F5F0E8' }}>{c.campaignName}</span>
                    {c.description && (
                      <p style={{ fontSize: 11, color: '#555', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.description}
                      </p>
                    )}
                  </td>
                  <td style={S.td}><TypeBadge type={c.campaignType} /></td>
                  <td style={S.td}><StatusBadge status={c.status} /></td>
                  <td style={{ ...S.td, color: '#888', fontSize: 12 }}>
                    {c.startDate || c.endDate
                      ? `${dtShort(c.startDate)} – ${dtShort(c.endDate)}`
                      : '—'}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', color: c.spend ? '#F5F0E8' : '#333', fontSize: 12 }}>
                    {fmt(c.spend)}
                  </td>
                  {/* Revenue, orders, ROAS, CPA require UTM attribution — computed in detail view */}
                  <td style={{ ...S.td, textAlign: 'right', color: '#2a2a2a', fontSize: 11 }}>ver →</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#2a2a2a', fontSize: 11 }}>ver →</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#2a2a2a', fontSize: 11 }}>ver →</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#2a2a2a', fontSize: 11 }}>ver →</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <button
                      style={{ ...S.btn, fontSize: 12, padding: '4px 10px' }}
                      onClick={(e) => { e.stopPropagation(); setDrawer({ kind: 'detail', campaign: c }) }}>
                      Ver →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawers */}
      {drawer.kind === 'create' && (
        <CreateDrawer
          onClose={() => setDrawer({ kind: 'none' })}
          onCreated={(c) => {
            setCampaigns((prev) => [c, ...prev])
            setDrawer({ kind: 'detail', campaign: c })
          }}
        />
      )}

      {drawer.kind === 'detail' && (
        <DetailDrawer
          campaign={drawer.campaign}
          onClose={() => setDrawer({ kind: 'none' })}
          onEdit={() => setDrawer({ kind: 'edit', campaign: drawer.campaign })}
          onDelete={() => handleDelete(drawer.campaign.id)}
        />
      )}

      {drawer.kind === 'edit' && (
        <EditDrawer
          campaign={drawer.campaign}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={(updated) => {
            setCampaigns((prev) => prev.map((c) => c.id === updated.id ? updated : c))
            setDrawer({ kind: 'detail', campaign: updated })
          }}
        />
      )}
    </div>
  )
}
