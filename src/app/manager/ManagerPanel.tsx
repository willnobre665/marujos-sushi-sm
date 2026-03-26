'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ManagerCliente,
  ManagerDetail,
  ManagerListResponse,
  CampaignsResponse,
  CampaignStat,
  CustomerSegment,
} from '@/app/api/crm/manager/route'

// ─── Formatting ───────────────────────────────────────────────────────────────

function brl(centavos: number): string {
  return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ',')
}

function dt(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

function dtFull(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function daysLabel(days: number | null): string {
  if (days === null) return '—'
  if (days === 0)    return 'hoje'
  if (days === 1)    return '1 dia'
  return `${days} dias`
}

// ─── Segment config ───────────────────────────────────────────────────────────

const SEGMENT_STYLE: Record<CustomerSegment, { label: string; color: string; bg: string }> = {
  vip:          { label: 'VIP',        color: '#C9A84C', bg: 'rgba(201,168,76,0.12)'  },
  frequente:    { label: 'Frequente',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  novo:         { label: 'Novo',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  ativo:        { label: 'Ativo',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  dias_20_30:   { label: '20–30 dias', color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  dias_30_45:   { label: '30–45 dias', color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  dias_50_plus: { label: '50+ dias',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  none:         { label: '',           color: '#555',    bg: 'transparent'             },
}

function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  const s = SEGMENT_STYLE[segment]
  if (!s.label) return null
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '2px 7px', borderRadius: 100,
      color: s.color, backgroundColor: s.bg,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {s.label}
    </span>
  )
}

// ─── Consent ──────────────────────────────────────────────────────────────────

function ConsentDot({ value, title }: { value: boolean | null; title?: string }) {
  const color = value === true ? '#4ade80' : value === false ? '#f87171' : '#333'
  return <span title={title} style={{ color, fontSize: 16, lineHeight: 1 }}>●</span>
}

function ConsentRow({ label, value }: { label: string; value: boolean | null }) {
  const text  = value === true ? 'Sim' : value === false ? 'Não' : 'Sem registro'
  const color = value === true ? '#4ade80' : value === false ? '#f87171' : '#555'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <ConsentDot value={value} />
      <span style={{ color: '#888', fontSize: 12 }}>{label}:</span>
      <span style={{ fontSize: 12, color }}>{text}</span>
    </div>
  )
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

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
    borderBottom: '1px solid #1e1e1e',
    padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  } as React.CSSProperties,

  body: {
    padding: '20px 24px',
    maxWidth: 1500,
    margin: '0 auto',
  } as React.CSSProperties,

  tabBar: {
    display: 'flex', gap: 4, marginBottom: 20,
    borderBottom: '1px solid #1e1e1e', paddingBottom: 0,
  } as React.CSSProperties,

  filterBar: {
    display: 'flex', gap: 10, flexWrap: 'wrap' as const,
    marginBottom: 12, alignItems: 'flex-end',
  } as React.CSSProperties,

  quickFilters: {
    display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  fGroup: {
    display: 'flex', flexDirection: 'column' as const, gap: 4,
  } as React.CSSProperties,

  fLabel: {
    fontSize: 10, color: '#444',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  } as React.CSSProperties,

  select: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '6px 10px', outline: 'none', cursor: 'pointer',
  } as React.CSSProperties,

  input: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '6px 10px', outline: 'none', width: 140,
  } as React.CSSProperties,

  btn: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#ccc', fontSize: 13,
    padding: '6px 14px', cursor: 'pointer',
  } as React.CSSProperties,

  btnPrimary: {
    backgroundColor: '#C9A84C', border: 'none',
    borderRadius: 8, color: '#0A0A0A', fontWeight: 700,
    fontSize: 13, padding: '6px 14px', cursor: 'pointer',
  } as React.CSSProperties,

  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as React.CSSProperties,

  th: {
    textAlign: 'left' as const, padding: '7px 10px',
    color: '#444', fontSize: 11,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    borderBottom: '1px solid #1e1e1e', fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  td: {
    padding: '9px 10px', borderBottom: '1px solid #131313',
    verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  card: {
    backgroundColor: '#111', border: '1px solid #1e1e1e',
    borderRadius: 12, padding: 16, marginBottom: 12,
  } as React.CSSProperties,

  overlay: {
    position: 'fixed' as const, inset: 0,
    backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 100,
    display: 'flex', justifyContent: 'flex-end',
  } as React.CSSProperties,

  drawer: {
    backgroundColor: '#0d0d0d', width: '100%', maxWidth: 580,
    height: '100vh', overflowY: 'auto' as const,
    borderLeft: '1px solid #1e1e1e',
  } as React.CSSProperties,

  secTitle: {
    fontSize: 10, color: '#444',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    marginBottom: 10, fontWeight: 600,
  } as React.CSSProperties,
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  consent: string
  segment: string
  minOrders: string
  source: string
  campaign: string
  since: string
  until: string
  sort: string
}

const DEFAULT_FILTERS: Filters = {
  consent: '', segment: '', minOrders: '',
  source: '', campaign: '', since: '', until: '', sort: 'last_order',
}

function buildListUrl(f: Filters, page: number): string {
  const p = new URLSearchParams({ view: 'list' })
  if (f.consent)   p.set('consent',   f.consent)
  if (f.segment)   p.set('segment',   f.segment)
  if (f.minOrders) p.set('minOrders', f.minOrders)
  if (f.source)    p.set('source',    f.source)
  if (f.campaign)  p.set('campaign',  f.campaign)
  if (f.since)     p.set('since',     f.since)
  if (f.until)     p.set('until',     f.until)
  if (f.sort)      p.set('sort',      f.sort)
  p.set('page', String(page))
  p.set('limit', '50')
  return '/api/crm/manager?' + p.toString()
}

// ─── Quick filter pills ───────────────────────────────────────────────────────

const QUICK_FILTERS: { label: string; segment: string; color: string }[] = [
  { label: 'VIP',        segment: 'vip',          color: '#C9A84C' },
  { label: 'Frequente',  segment: 'frequente',    color: '#a78bfa' },
  { label: 'Novo',       segment: 'novo',         color: '#60a5fa' },
  { label: 'Ativo',      segment: 'ativo',        color: '#4ade80' },
  { label: '20–30 dias', segment: 'dias_20_30',   color: '#fb923c' },
  { label: '30–45 dias', segment: 'dias_30_45',   color: '#f97316' },
  { label: '50+ dias',   segment: 'dias_50_plus', color: '#f87171' },
]

function QuickFilters({ active, onSelect }: {
  active: string
  onSelect: (segment: string) => void
}) {
  return (
    <div style={S.quickFilters}>
      <span style={{ ...S.fLabel, alignSelf: 'center', marginRight: 4 }}>Filtro rápido:</span>
      {QUICK_FILTERS.map(({ label, segment, color }) => {
        const isActive = active === segment
        return (
          <button
            key={segment}
            onClick={() => onSelect(isActive ? '' : segment)}
            style={{
              fontSize: 12, fontWeight: isActive ? 700 : 400,
              padding: '4px 12px', borderRadius: 100, cursor: 'pointer',
              border: `1px solid ${isActive ? color : '#2a2a2a'}`,
              color: isActive ? '#0A0A0A' : color,
              backgroundColor: isActive ? color : 'transparent',
              transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        )
      })}
      {active && (
        <button
          onClick={() => onSelect('')}
          style={{ ...S.btn, fontSize: 12, padding: '4px 12px', borderRadius: 100 }}
        >
          × Limpar
        </button>
      )}
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, onApply, onReset }: {
  filters: Filters
  onChange: (f: Filters) => void
  onApply: () => void
  onReset: () => void
}) {
  function set(field: keyof Filters, value: string) { onChange({ ...filters, [field]: value }) }

  return (
    <div style={S.filterBar}>
      <div style={S.fGroup}>
        <span style={S.fLabel}>Consentimento</span>
        <select style={S.select} value={filters.consent} onChange={(e) => set('consent', e.target.value)}>
          <option value="">Todos</option>
          <option value="transactional">Transacional ativo</option>
          <option value="relational">Relacional ativo</option>
          <option value="promotional">Promocional ativo</option>
          <option value="none">Sem consentimento</option>
        </select>
      </div>

      <div style={S.fGroup}>
        <span style={S.fLabel}>Mín. Pedidos</span>
        <input style={S.input} type="number" min={0} placeholder="Ex: 2"
          value={filters.minOrders} onChange={(e) => set('minOrders', e.target.value)} />
      </div>

      <div style={S.fGroup}>
        <span style={S.fLabel}>Fonte</span>
        <select style={S.select} value={filters.source} onChange={(e) => set('source', e.target.value)}>
          <option value="">Todas</option>
          <option value="qr">QR Code</option>
          <option value="instagram">Instagram</option>
          <option value="google">Google</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="direct">Direto</option>
        </select>
      </div>

      <div style={S.fGroup}>
        <span style={S.fLabel}>Campanha utm</span>
        <input style={S.input} type="text" placeholder="Ex: verao2025"
          value={filters.campaign} onChange={(e) => set('campaign', e.target.value)} />
      </div>

      <div style={S.fGroup}>
        <span style={S.fLabel}>Último pedido desde</span>
        <input style={S.input} type="date"
          value={filters.since} onChange={(e) => set('since', e.target.value)} />
      </div>

      <div style={S.fGroup}>
        <span style={S.fLabel}>Até</span>
        <input style={S.input} type="date"
          value={filters.until} onChange={(e) => set('until', e.target.value)} />
      </div>

      <div style={S.fGroup}>
        <span style={S.fLabel}>Ordenar por</span>
        <select style={S.select} value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="last_order">Último pedido</option>
          <option value="order_count">Nº de pedidos</option>
          <option value="total_spent">Total gasto</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <button style={S.btnPrimary} onClick={onApply}>Filtrar</button>
        <button style={S.btn} onClick={onReset}>Limpar</button>
      </div>
    </div>
  )
}

// ─── Customer table ───────────────────────────────────────────────────────────

function CustomerTable({ customers, onSelect }: {
  customers: ManagerCliente[]
  onSelect: (phone: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (customers.length === 0) {
    return (
      <p style={{ color: '#444', marginTop: 40, textAlign: 'center', fontSize: 14 }}>
        Nenhum cliente encontrado com esses filtros.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Cliente</th>
            <th style={S.th}>Segmento</th>
            <th style={S.th}>Pedidos</th>
            <th style={S.th}>Total Gasto</th>
            <th style={S.th}>Último Pedido</th>
            <th style={S.th}>Há</th>
            <th style={{ ...S.th, textAlign: 'center' as const }}>T R P</th>
            <th style={S.th}>Fonte</th>
            <th style={S.th}>Campanha</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const isHovered = hovered === c.phone
            const riskColor = c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 45
              ? '#f87171' : c.daysSinceLastOrder !== null && c.daysSinceLastOrder > 20
              ? '#fb923c' : '#888'

            return (
              <tr
                key={c.phone}
                style={{ cursor: 'pointer', backgroundColor: isHovered ? '#111' : 'transparent' }}
                onMouseEnter={() => setHovered(c.phone)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(c.phone)}
              >
                <td style={S.td}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{c.phone}</div>
                </td>
                <td style={S.td}>
                  <SegmentBadge segment={c.segment} />
                </td>
                <td style={{ ...S.td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>
                  {c.orderCount}
                </td>
                <td style={{ ...S.td, textAlign: 'right' as const, color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}>
                  {brl(c.totalSpentCentavos)}
                </td>
                <td style={{ ...S.td, color: '#666' }}>{dt(c.lastOrderAt)}</td>
                <td style={{ ...S.td, color: riskColor, fontVariantNumeric: 'tabular-nums' }}>
                  {daysLabel(c.daysSinceLastOrder)}
                </td>
                <td style={{ ...S.td, textAlign: 'center' as const }}>
                  <ConsentDot value={c.consentOrderUpdates} title="Transacional" />
                  {' '}
                  <ConsentDot value={c.consentRelational} title="Relacional" />
                  {' '}
                  <ConsentDot value={c.consentPromotional} title="Promocional" />
                </td>
                <td style={{ ...S.td, color: '#666' }}>{c.latestSource ?? '—'}</td>
                <td style={{ ...S.td, color: '#666' }}>{c.latestCampaign ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Campaigns view ───────────────────────────────────────────────────────────

function CampaignsView() {
  const [data, setData]       = useState<CampaignsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crm/manager?view=campaigns')
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); return }
        setData(json as CampaignsResponse)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: '#555', marginTop: 24 }}>Carregando campanhas...</p>
  if (error)   return <p style={{ color: '#f87171', marginTop: 24 }}>Erro: {error}</p>
  if (!data || data.campaigns.length === 0) {
    return <p style={{ color: '#444', marginTop: 40, textAlign: 'center' }}>Nenhuma campanha com pedidos ainda.</p>
  }

  const totalRevenue = data.campaigns.reduce((s, c) => s + c.revenue, 0)

  return (
    <div>
      <div style={{ marginBottom: 16, color: '#555', fontSize: 13 }}>
        {data.campaigns.length} campanha{data.campaigns.length !== 1 ? 's' : ''} ·{' '}
        receita total: <span style={{ color: '#C9A84C' }}>{brl(totalRevenue)}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Campanha</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Pedidos</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Clientes únicos</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Receita</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Ticket Médio</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>% Receita</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((c: CampaignStat) => {
              const pct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0
              const avgTicket = c.orders > 0 ? c.revenue / c.orders : 0
              return (
                <tr key={c.campaign}>
                  <td style={S.td}>
                    {c.campaign === '__none__'
                      ? <span style={{ color: '#555', fontStyle: 'italic' }}>Sem campanha</span>
                      : <span style={{ color: '#C9A84C', fontWeight: 500 }}>{c.campaign}</span>
                    }
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>{c.customers}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: '#C9A84C', fontVariantNumeric: 'tabular-nums' }}>{brl(c.revenue)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: '#888', fontVariantNumeric: 'tabular-nums' }}>{brl(avgTicket)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 4, backgroundColor: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#C9A84C', borderRadius: 2 }} />
                      </div>
                      <span style={{ color: '#888', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ phone, onClose }: { phone: string; onClose: () => void }) {
  const [data, setData]       = useState<ManagerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null); setData(null)
    fetch(`/api/crm/manager?view=detail&phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); return }
        setData(json as ManagerDetail)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [phone])

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Sticky header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 1,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Detalhe do Cliente</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {loading && <p style={{ color: '#444' }}>Carregando...</p>}
          {error   && <p style={{ color: '#f87171' }}>Erro: {error}</p>}

          {data && (() => {
            const c = data.cliente
            return (
              <>
                {/* Identity + segment */}
                <div style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 3 }}>{c.name}</p>
                      <p style={{ color: '#666', fontSize: 13 }}>{c.phone}</p>
                      {c.email && <p style={{ color: '#666', fontSize: 13 }}>{c.email}</p>}
                    </div>
                    <SegmentBadge segment={c.segment} />
                  </div>
                  <p style={{ color: '#444', fontSize: 12, marginTop: 6 }}>
                    Cliente desde {dt(c.firstSeenAt)}
                    {c.lastOrderAt && <> · último pedido {dt(c.lastOrderAt)}</>}
                    {c.daysSinceLastOrder !== null && (
                      <> · <span style={{ color: c.daysSinceLastOrder > 15 ? '#f87171' : '#888' }}>
                        há {daysLabel(c.daysSinceLastOrder)}
                      </span></>
                    )}
                  </p>
                  {c.segmentTags.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.segmentTags.map((t) => (
                        <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, backgroundColor: '#1e1e1e', color: '#666' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={S.secTitle}>Pedidos</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>{c.orderCount}</p>
                  </div>
                  <div>
                    <p style={S.secTitle}>Total Gasto</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C' }}>{brl(c.totalSpentCentavos)}</p>
                  </div>
                  <div>
                    <p style={S.secTitle}>Ticket Médio</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#888' }}>
                      {c.orderCount > 0 ? brl(Math.round(c.totalSpentCentavos / c.orderCount)) : '—'}
                    </p>
                  </div>
                </div>

                {/* Consent */}
                <div style={S.card}>
                  <p style={S.secTitle}>Consentimento</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <ConsentRow label="Atualizações de pedido (transacional)" value={c.consentOrderUpdates} />
                    <ConsentRow label="Relacionamento (relacional)"          value={c.consentRelational}   />
                    <ConsentRow label="Promoções (promocional)"              value={c.consentPromotional}  />
                  </div>
                </div>

                {/* Consent log */}
                {data.consentLogs.length > 0 && (
                  <div style={S.card}>
                    <p style={S.secTitle}>Histórico de Consentimento</p>
                    {data.consentLogs.map((l) => (
                      <div key={l.id} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, alignItems: 'center' }}>
                        <ConsentDot value={l.granted} />
                        <span style={{ color: '#555' }}>{dtFull(l.grantedAt)}</span>
                        <span style={{ color: '#888' }}>{l.category}</span>
                        <span style={{ color: '#444' }}>{l.source}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Orders */}
                <div style={S.card}>
                  <p style={S.secTitle}>Pedidos ({data.pedidos.length})</p>
                  {data.pedidos.length === 0
                    ? <p style={{ color: '#444', fontSize: 13 }}>Nenhum pedido registrado.</p>
                    : data.pedidos.map((pedido) => {
                        const attr = pedido.attribution
                        const attrLine = [
                          attr?.utm_source   && `src: ${attr.utm_source}`,
                          attr?.utm_medium   && `med: ${attr.utm_medium}`,
                          attr?.utm_campaign && `camp: ${attr.utm_campaign}`,
                        ].filter(Boolean).join(' · ')
                        return (
                          <div key={pedido.id} style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: 10, marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{brl(pedido.total)}</span>
                                <span style={{ color: '#555', fontSize: 12, marginLeft: 8 }}>{pedido.context}</span>
                                <span style={{ color: '#555', fontSize: 12, marginLeft: 6 }}>via {pedido.source}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: pedido.status === 'confirmed' ? '#4ade80' : '#f87171' }}>
                                  {pedido.status}
                                </span>
                                <span style={{ color: '#444', fontSize: 12 }}>{dt(pedido.createdAt)}</span>
                              </div>
                            </div>
                            {attrLine && (
                              <div style={{ fontSize: 11, color: '#444', marginTop: 3 }}>{attrLine}</div>
                            )}
                          </div>
                        )
                      })
                  }
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'clientes' | 'kanban' | 'campanhas' | 'automacoes'

const TAB_CONFIG: { id: Tab; label: string; href?: string }[] = [
  { id: 'clientes',   label: 'Clientes' },
  { id: 'kanban',     label: 'Kanban',      href: '/crm-kanban' },
  { id: 'campanhas',  label: 'Campanhas',   href: '/campaigns' },
  { id: 'automacoes', label: 'Automações',  href: '/crm-automacoes' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={S.tabBar}>
      {TAB_CONFIG.map(({ id, label, href }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => href ? (window.location.href = href) : onChange(id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#F5F0E8' : '#555',
              padding: '0 4px 12px',
              borderBottom: `2px solid ${isActive ? '#C9A84C' : 'transparent'}`,
              transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ManagerPanel() {
  const [tab, setTab] = useState<Tab>('clientes')
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS)
  const [activeFilters, setActiveFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage]                   = useState(1)
  const [data, setData]                   = useState<ManagerListResponse | null>(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)

  const fetchList = useCallback((f: Filters, p: number) => {
    setLoading(true); setError(null)
    fetch(buildListUrl(f, p))
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); return }
        setData(json as ManagerListResponse)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // Read ?tab= param after hydration — must be in useEffect, not useState initializer,
  // so server and client both start with the same 'clientes' default.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('tab')
    if (p === 'campanhas') setTab('campanhas')
  }, [])

  useEffect(() => { fetchList(DEFAULT_FILTERS, 1) }, [fetchList])

  function applyFilters(f: Filters) {
    setActiveFilters(f); setPage(1); fetchList(f, 1)
  }

  function handleQuickFilter(segment: string) {
    const next = { ...filters, segment }
    setFilters(next); applyFilters(next)
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS); applyFilters(DEFAULT_FILTERS)
  }

  function handlePageChange(p: number) { setPage(p); fetchList(activeFilters, p) }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>
            CRM — Marujos Sushi
          </span>
          <span style={{ marginLeft: 10, color: '#333', fontSize: 12 }}>painel interno</span>
        </div>
        {tab === 'clientes' && data && (
          <span style={{ color: '#444', fontSize: 12 }}>
            {data.total} cliente{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={S.body}>
        <TabBar active={tab} onChange={setTab} />

        {tab === 'campanhas' && <CampaignsView />}

        {tab === 'clientes' && (
          <>
            <QuickFilters active={filters.segment} onSelect={handleQuickFilter} />
            <FilterBar
              filters={filters}
              onChange={setFilters}
              onApply={() => applyFilters(filters)}
              onReset={handleReset}
            />

            {loading && <p style={{ color: '#444' }}>Carregando...</p>}
            {error   && <p style={{ color: '#f87171' }}>Erro: {error}</p>}

            {!loading && !error && data && (
              <>
                <CustomerTable customers={data.customers} onSelect={setSelectedPhone} />

                {totalPages > 1 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 20, justifyContent: 'center' }}>
                    <button style={S.btn} onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>← Anterior</button>
                    <span style={{ color: '#444', fontSize: 13 }}>Página {page} de {totalPages}</span>
                    <button style={S.btn} onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>Próxima →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selectedPhone && (
        <DetailDrawer phone={selectedPhone} onClose={() => setSelectedPhone(null)} />
      )}
    </div>
  )
}
