'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ManagerCliente, CustomerSegment, ManagerListResponse } from '@/app/api/crm/manager/route'

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

function daysLabel(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return 'hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

// ─── Segment config ───────────────────────────────────────────────────────────

const SEGMENT_STYLE: Record<CustomerSegment, { label: string; color: string; bg: string; border: string }> = {
  vip:          { label: 'VIP',        color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.35)'  },
  frequente:    { label: 'Frequente',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  novo:         { label: 'Novo',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
  ativo:        { label: 'Ativo',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)'  },
  dias_20_30:   { label: '20–30 dias', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)'  },
  dias_30_45:   { label: '30–45 dias', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)'  },
  dias_50_plus: { label: '50+ dias',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
  none:         { label: '—',          color: '#555',    bg: 'transparent',            border: '#222'                   },
}

function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  const s = SEGMENT_STYLE[segment]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '2px 7px', borderRadius: 100,
      color: s.color, backgroundColor: s.bg,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ─── Summary card config ──────────────────────────────────────────────────────

interface CardConfig {
  id: CustomerSegment | 'vip_inactive'
  label: string
  subtitle: string
  color: string
  bg: string
  border: string
  description: string
  actionLabel: string
}

const CARDS: CardConfig[] = [
  {
    id:          'dias_20_30',
    label:       '20–30 dias',
    subtitle:    'Esfriando',
    color:       '#fb923c',
    bg:          'rgba(251,146,60,0.08)',
    border:      'rgba(251,146,60,0.25)',
    description: 'Clientes que não compram há 20–30 dias. Janela ideal para reativação.',
    actionLabel: 'Ver clientes',
  },
  {
    id:          'dias_30_45',
    label:       '30–45 dias',
    subtitle:    'Em risco',
    color:       '#f97316',
    bg:          'rgba(249,115,22,0.08)',
    border:      'rgba(249,115,22,0.25)',
    description: 'Risco real de perda. Ação urgente pode recuperar a relação.',
    actionLabel: 'Ver clientes',
  },
  {
    id:          'dias_50_plus',
    label:       '50+ dias',
    subtitle:    'Inativos',
    color:       '#f87171',
    bg:          'rgba(248,113,113,0.08)',
    border:      'rgba(248,113,113,0.25)',
    description: 'Clientes perdidos. Alta chance de reconquistar com oferta especial.',
    actionLabel: 'Ver clientes',
  },
  {
    id:          'vip_inactive',
    label:       'VIP sem comprar',
    subtitle:    'Prioridade máxima',
    color:       '#C9A84C',
    bg:          'rgba(201,168,76,0.08)',
    border:      'rgba(201,168,76,0.25)',
    description: 'Clientes VIP (5+ pedidos) sem comprar há mais de 20 dias.',
    actionLabel: 'Ver VIPs',
  },
]

// ─── Fetch all customers (paginated) ─────────────────────────────────────────

async function fetchAllCustomers(): Promise<ManagerCliente[]> {
  const all: ManagerCliente[] = []
  let page = 1
  const limit = 200

  while (true) {
    const res = await fetch(`/api/crm/manager?view=list&limit=${limit}&page=${page}&sort=last_order`)
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json: ManagerListResponse = await res.json()
    all.push(...json.customers)
    if (all.length >= json.total || json.customers.length < limit) break
    page++
  }

  return all
}

// ─── Customer row ─────────────────────────────────────────────────────────────

function CustomerRow({
  c,
  selected,
  onToggle,
}: {
  c: ManagerCliente
  selected: boolean
  onToggle: () => void
}) {
  const avgTicket = c.orderCount > 0 ? Math.round(c.totalSpentCentavos / c.orderCount) : 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 110px 80px 70px 90px 90px 80px',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderBottom: '1px solid #111',
        backgroundColor: selected ? 'rgba(201,168,76,0.04)' : 'transparent',
        transition: 'background 0.1s',
        cursor: 'default',
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        style={{ accentColor: '#C9A84C', width: 15, height: 15, cursor: 'pointer' }}
      />

      {/* Name + phone */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F0E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.name || '—'}
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{c.phone}</div>
      </div>

      {/* Último pedido */}
      <div style={{ fontSize: 12, color: '#8A8A8A', textAlign: 'right' }}>{dt(c.lastOrderAt)}</div>

      {/* Dias sem comprar */}
      <div style={{
        fontSize: 12, fontWeight: 600, textAlign: 'right',
        color: (c.daysSinceLastOrder ?? 0) >= 50 ? '#f87171' :
               (c.daysSinceLastOrder ?? 0) >= 30 ? '#f97316' :
               (c.daysSinceLastOrder ?? 0) >= 20 ? '#fb923c' : '#4ade80',
      }}>
        {daysLabel(c.daysSinceLastOrder)}
      </div>

      {/* Pedidos */}
      <div style={{ fontSize: 12, color: '#8A8A8A', textAlign: 'right' }}>
        {c.orderCount}x
      </div>

      {/* Ticket médio */}
      <div style={{ fontSize: 12, color: '#8A8A8A', textAlign: 'right' }}>
        {avgTicket > 0 ? brl(avgTicket) : '—'}
      </div>

      {/* Total gasto */}
      <div style={{ fontSize: 12, color: '#C9A84C', textAlign: 'right', fontWeight: 600 }}>
        {c.totalSpentCentavos > 0 ? brl(c.totalSpentCentavos) : '—'}
      </div>

      {/* Segmento */}
      <div style={{ textAlign: 'right' }}>
        <SegmentBadge segment={c.segment} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type ActiveCard = CustomerSegment | 'vip_inactive' | null

type SortField = 'days' | 'orders' | 'total'

export function RemarketingPanel() {
  const [customers, setCustomers] = useState<ManagerCliente[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [activeCard, setActiveCard] = useState<ActiveCard>(null)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('days')
  const [filterSegment, setFilterSegment] = useState<CustomerSegment | 'all'>('all')
  const [showOnlyConsent, setShowOnlyConsent] = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    fetchAllCustomers()
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // ─── Buckets ───────────────────────────────────────────────────────────────

  const buckets = useMemo(() => {
    const b: Record<CustomerSegment, ManagerCliente[]> = {
      vip: [], frequente: [], ativo: [], dias_20_30: [], dias_30_45: [], dias_50_plus: [], novo: [], none: [],
    }
    for (const c of customers) b[c.segment].push(c)
    return b
  }, [customers])

  const vipInactive = useMemo(
    () => buckets.vip.filter((c) => (c.daysSinceLastOrder ?? 0) >= 20),
    [buckets.vip]
  )

  function countFor(id: ActiveCard): number {
    if (id === 'vip_inactive') return vipInactive.length
    if (id === null) return customers.length
    return buckets[id as CustomerSegment]?.length ?? 0
  }

  function revenueFor(id: ActiveCard): number {
    const list = id === 'vip_inactive' ? vipInactive
      : id === null ? customers
      : (buckets[id as CustomerSegment] ?? [])
    return list.reduce((s, c) => s + c.totalSpentCentavos, 0)
  }

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const baseList: ManagerCliente[] = useMemo(() => {
    if (activeCard === 'vip_inactive') return vipInactive
    if (activeCard === null) return customers
    return buckets[activeCard as CustomerSegment] ?? []
  }, [activeCard, customers, buckets, vipInactive])

  const filteredList = useMemo(() => {
    let list = baseList

    if (filterSegment !== 'all') {
      list = list.filter((c) => c.segment === filterSegment)
    }

    if (showOnlyConsent) {
      list = list.filter((c) => c.consentPromotional === true || c.consentRelational === true)
    }

    list = [...list].sort((a, b) => {
      if (sortField === 'days')   return (b.daysSinceLastOrder ?? 0) - (a.daysSinceLastOrder ?? 0)
      if (sortField === 'orders') return b.orderCount - a.orderCount
      if (sortField === 'total')  return b.totalSpentCentavos - a.totalSpentCentavos
      return 0
    })

    return list
  }, [baseList, filterSegment, showOnlyConsent, sortField])

  // ─── Selection ─────────────────────────────────────────────────────────────

  const allSelected = filteredList.length > 0 && filteredList.every((c) => selected.has(c.phone))

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredList.forEach((c) => next.delete(c.phone))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredList.forEach((c) => next.add(c.phone))
        return next
      })
    }
  }

  function toggleOne(phone: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(phone)) next.delete(phone)
      else next.add(phone)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // ─── Quick actions ─────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const selectedList = filteredList.filter((c) => selected.has(c.phone))

  function handlePrepareCampaign() {
    if (selectedList.length === 0) { showToast('Selecione ao menos um cliente.'); return }
    const phones = selectedList.map((c) => c.phone).join(',')
    const seg = activeCard ?? 'all'
    window.location.href = `/campaigns?phones=${encodeURIComponent(phones)}&source=remarketing&segment=${seg}`
  }

  function handleMarkAutomation() {
    if (selectedList.length === 0) { showToast('Selecione ao menos um cliente.'); return }
    showToast(`${selectedList.length} cliente(s) marcados para automação futura.`)
  }

  function handleCopyPhones() {
    if (selectedList.length === 0) { showToast('Selecione ao menos um cliente.'); return }
    const text = selectedList.map((c) => c.phone).join('\n')
    navigator.clipboard.writeText(text).then(() =>
      showToast(`${selectedList.length} telefone(s) copiados.`)
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12, color: '#555' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #222', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ fontSize: 13 }}>Carregando clientes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#f87171' }}>
        <div style={{ fontSize: 14 }}>Erro ao carregar dados do CRM</div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', border: '1px solid #333', color: '#F5F0E8',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}

      {/* ─── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Visão de Retenção
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {CARDS.map((card) => {
            const count   = countFor(card.id)
            const revenue = revenueFor(card.id)
            const isActive = activeCard === card.id
            return (
              <button
                key={card.id}
                onClick={() => setActiveCard(isActive ? null : card.id)}
                style={{
                  textAlign: 'left', background: isActive ? card.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? card.border : '#1a1a1a'}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{card.subtitle}</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: card.color, lineHeight: 1 }}>
                    {count}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 8, lineHeight: 1.4 }}>
                  {card.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#555' }}>
                    {revenue > 0 ? <span style={{ color: '#C9A84C', fontWeight: 600 }}>{brl(revenue)}</span> : 'Sem histórico'}
                    <span style={{ marginLeft: 4, color: '#444' }}>total gasto</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? card.color : '#555' }}>
                    {isActive ? '← ocultar' : card.actionLabel + ' →'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Filters + actions bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        padding: '12px 14px', background: '#0f0f0f', border: '1px solid #1a1a1a',
        borderRadius: 10, marginBottom: 12,
      }}>
        {/* Segment filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexGrow: 1 }}>
          {(['all', 'vip', 'frequente', 'novo', 'ativo', 'dias_20_30', 'dias_30_45', 'dias_50_plus'] as const).map((seg) => {
            const isAll = seg === 'all'
            const style = isAll ? { color: '#F5F0E8', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)' }
                                : { color: SEGMENT_STYLE[seg].color, bg: SEGMENT_STYLE[seg].bg, border: SEGMENT_STYLE[seg].border }
            const active = filterSegment === seg
            return (
              <button
                key={seg}
                onClick={() => setFilterSegment(seg)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                  cursor: 'pointer', border: `1px solid ${active ? style.border : '#222'}`,
                  background: active ? style.bg : 'transparent',
                  color: active ? style.color : '#555',
                  transition: 'all 0.12s', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                {isAll ? 'Todos' : SEGMENT_STYLE[seg].label}
              </button>
            )
          })}
        </div>

        {/* Consent filter */}
        <button
          onClick={() => setShowOnlyConsent((v) => !v)}
          style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100,
            cursor: 'pointer', border: `1px solid ${showOnlyConsent ? '#4ade80' : '#222'}`,
            background: showOnlyConsent ? 'rgba(74,222,128,0.1)' : 'transparent',
            color: showOnlyConsent ? '#4ade80' : '#555',
            transition: 'all 0.12s', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}
        >
          Com consentimento
        </button>

        {/* Sort */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          style={{
            background: '#111', border: '1px solid #222', color: '#8A8A8A',
            fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
          }}
        >
          <option value="days">Ordenar: mais tempo sem comprar</option>
          <option value="orders">Ordenar: mais pedidos</option>
          <option value="total">Ordenar: maior gasto</option>
        </select>
      </div>

      {/* ─── Customer list ──────────────────────────────────────────────────── */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>

        {/* List header */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F0E8' }}>
              {activeCard === null
                ? `Todos os clientes`
                : activeCard === 'vip_inactive'
                ? 'VIP sem comprar'
                : SEGMENT_STYLE[activeCard as CustomerSegment].label}
              <span style={{ marginLeft: 8, fontWeight: 400, color: '#555', fontSize: 12 }}>
                {filteredList.length} clientes
              </span>
            </span>
            {selected.size > 0 && (
              <span style={{ fontSize: 12, color: '#C9A84C', fontWeight: 600 }}>
                {selected.size} selecionado(s)
              </span>
            )}
          </div>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {selected.size > 0 && (
              <>
                <button
                  onClick={handleCopyPhones}
                  style={actionBtnStyle('#333', '#8A8A8A')}
                >
                  Copiar telefones
                </button>
                <button
                  onClick={handleMarkAutomation}
                  style={actionBtnStyle('#1a1a2e', '#a78bfa')}
                >
                  Marcar automação
                </button>
                <button
                  onClick={handlePrepareCampaign}
                  style={actionBtnStyle('rgba(201,168,76,0.15)', '#C9A84C')}
                >
                  Preparar campanha
                </button>
                <button
                  onClick={clearSelection}
                  style={actionBtnStyle('#111', '#555')}
                >
                  ✕ Limpar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 110px 80px 70px 90px 90px 80px',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#0a0a0a',
        }}>
          <div>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{ accentColor: '#C9A84C', width: 15, height: 15, cursor: 'pointer' }}
            />
          </div>
          {['Cliente', 'Último pedido', 'Ausência', 'Pedidos', 'Ticket médio', 'Total gasto', 'Segmento'].map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Cliente' ? 'left' : 'right' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {filteredList.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 13 }}>
            Nenhum cliente neste segmento.
          </div>
        ) : (
          filteredList.map((c) => (
            <CustomerRow
              key={c.phone}
              c={c}
              selected={selected.has(c.phone)}
              onToggle={() => toggleOne(c.phone)}
            />
          ))
        )}

        {/* Footer */}
        {filteredList.length > 0 && (
          <div style={{ padding: '8px 14px', borderTop: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#444' }}>
              {filteredList.length} clientes listados
            </span>
            <span style={{ fontSize: 11, color: '#555' }}>
              Total gasto:{' '}
              <span style={{ color: '#C9A84C', fontWeight: 600 }}>
                {brl(filteredList.reduce((s, c) => s + c.totalSpentCentavos, 0))}
              </span>
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
    cursor: 'pointer', border: `1px solid ${color}33`,
    background: bg, color: color, transition: 'all 0.12s',
  }
}
