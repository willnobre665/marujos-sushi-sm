'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import FinancePage from '@/app/finance/page'
import { RemarketingPanel } from '@/app/remarketing/RemarketingPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type KitchenStatus = 'new' | 'preparing' | 'ready' | 'delivered'

interface KitchenOrder {
  id: string
  customerName: string
  tableId: string | null
  items: Array<{ productName: string; quantity: number; variations?: string }>
  total: number                         // centavos — this order
  createdAt: string
  status: KitchenStatus
  customerOrderCount:         number    // lifetime orders (0 if unknown)
  customerTotalSpentCentavos: number    // lifetime spend (0 if unknown)
}

type Urgency   = 'ok' | 'warning' | 'delayed'
type ValueTier = 'vip' | 'high' | 'normal'

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_MS      = 15_000
const TICK_MS      = 10_000
const OK_MINS      = 10
const WARNING_MINS = 20

const VIP_ORDER_COUNT  = 5
const VIP_SPEND_BRL    = 300_00
const HIGH_ORDER_BRL   = 80_00

const EXPECTED_MINS: Record<KitchenStatus, number> = {
  new:       10,
  preparing: 20,
  ready:     20,
  delivered: 20,
}

const NEXT: Record<KitchenStatus, KitchenStatus | null> = {
  new:       'preparing',
  preparing: 'ready',
  ready:     'delivered',
  delivered: null,
}

const COLUMNS: {
  status:     KitchenStatus
  label:      string
  headerBg:   string
  headerText: string
  btnClass:   string
  btnLabel:   string
}[] = [
  {
    status:     'new',
    label:      'NOVO',
    headerBg:   'bg-red-700',
    headerText: 'text-white',
    btnClass:   'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white',
    btnLabel:   'Iniciar preparo',
  },
  {
    status:     'preparing',
    label:      'PREPARANDO',
    headerBg:   'bg-yellow-600',
    headerText: 'text-black',
    btnClass:   'bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black',
    btnLabel:   'Finalizar',
  },
  {
    status:     'ready',
    label:      'PRONTO',
    headerBg:   'bg-green-700',
    headerText: 'text-white',
    btnClass:   'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white',
    btnLabel:   'Entregue',
  },
]

// ─── Priority score ───────────────────────────────────────────────────────────

function priorityScore(order: KitchenOrder): number {
  const mins     = elapsedMins(order.createdAt)
  const orderBrl = order.total / 100
  const urgency  = getUrgency(order.createdAt, order.status)

  const timeScore  = mins
  const valueScore = orderBrl * 0.5
  const vipBonus   =
    order.customerOrderCount >= VIP_ORDER_COUNT ||
    order.customerTotalSpentCentavos >= VIP_SPEND_BRL
      ? 40
      : order.total >= HIGH_ORDER_BRL
      ? 20
      : 0

  const urgencyMul =
    urgency === 'delayed' ? 2.0 :
    urgency === 'warning' ? 1.3 :
    1.0

  return (timeScore + valueScore + vipBonus) * urgencyMul
}

function getValueTier(order: KitchenOrder): ValueTier {
  if (
    order.customerOrderCount >= VIP_ORDER_COUNT ||
    order.customerTotalSpentCentavos >= VIP_SPEND_BRL
  ) return 'vip'
  if (order.total >= HIGH_ORDER_BRL) return 'high'
  return 'normal'
}

// ─── Urgency ──────────────────────────────────────────────────────────────────

function getUrgency(createdAt: string, status: KitchenStatus): Urgency {
  if (status === 'ready' || status === 'delivered') return 'ok'
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60_000
  if (mins >= WARNING_MINS) return 'delayed'
  if (mins >= OK_MINS)      return 'warning'
  return 'ok'
}

const URGENCY_TIME_BG: Record<Urgency, string> = {
  ok:      'bg-[#1a1a1a] text-[#6a6a6a]',
  warning: 'bg-yellow-900/60 text-yellow-300 font-bold',
  delayed: 'bg-red-900 text-red-200 font-black',
}

const URGENCY_DOT: Record<Urgency, string> = {
  ok:      '🟢',
  warning: '🟡',
  delayed: '🔴',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function elapsedMins(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000
}

function elapsedLabel(iso: string): string {
  const mins = Math.floor(elapsedMins(iso))
  if (mins < 1) return 'agora'
  return `${mins} min`
}

function progressPct(createdAt: string, status: KitchenStatus): number {
  const expected = EXPECTED_MINS[status]
  const elapsed  = elapsedMins(createdAt)
  return Math.min(110, Math.round((elapsed / expected) * 100))
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const KITCHEN_STYLE = `
@keyframes k-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  50%       { box-shadow: 0 0 0 10px rgba(239,68,68,0.45); }
}
@keyframes k-shake {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-3px); }
  40%     { transform: translateX(3px); }
  60%     { transform: translateX(-2px); }
  80%     { transform: translateX(2px); }
}
@keyframes k-flash {
  0%   { background-color: rgba(239,68,68,0.25); }
  100% { background-color: transparent; }
}
.k-delayed {
  animation: k-pulse 1.6s ease-in-out infinite;
}
.k-new-delayed {
  animation: k-shake 0.5s ease-in-out 1, k-flash 1.2s ease-out 1, k-pulse 1.6s ease-in-out 0.5s infinite;
}
`

function useKitchenStyle() {
  useEffect(() => {
    const id = 'kitchen-styles'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = KITCHEN_STYLE
    document.head.appendChild(el)
    return () => { el.remove() }
  }, [])
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, urgency }: { pct: number; urgency: Urgency }) {
  const color =
    urgency === 'delayed' ? '#ef4444' :
    urgency === 'warning' ? '#eab308' :
    '#4ade80'

  return (
    <div className="w-full rounded-full bg-[#1e1e1e] overflow-hidden" style={{ height: 5 }}>
      <div
        style={{
          width:           `${Math.min(100, pct)}%`,
          height:          '100%',
          backgroundColor: color,
          borderRadius:    '9999px',
          transition:      'width 0.8s ease',
          opacity:         pct > 100 ? 0.6 : 1,
        }}
      />
    </div>
  )
}

// ─── Value badge ──────────────────────────────────────────────────────────────

function ValueBadge({ tier }: { tier: ValueTier }) {
  if (tier === 'vip') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40">
        ⭐ VIP
      </span>
    )
  }
  if (tier === 'high') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/40">
        💎 Alto valor
      </span>
    )
  }
  return null
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  col,
  onAdvance,
  advancing,
  flashOnMount,
}: {
  order:        KitchenOrder
  col:          (typeof COLUMNS)[number]
  onAdvance:    (id: string, next: KitchenStatus) => void
  advancing:    boolean
  flashOnMount: boolean
}) {
  const next    = NEXT[order.status]
  const cardRef = useRef<HTMLDivElement>(null)

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => clearInterval(t)
  }, [])

  const prevUrgencyRef = useRef<Urgency | null>(null)
  const [justBecameDelayed, setJustBecameDelayed] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const urgency   = useMemo(() => getUrgency(order.createdAt, order.status),  [tick, order.createdAt, order.status])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const elapsed   = useMemo(() => elapsedLabel(order.createdAt),              [tick, order.createdAt])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pct       = useMemo(() => progressPct(order.createdAt, order.status), [tick, order.createdAt, order.status])
  const valueTier = useMemo(() => getValueTier(order), [order.customerOrderCount, order.customerTotalSpentCentavos, order.total]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevUrgencyRef.current !== null && prevUrgencyRef.current !== 'delayed' && urgency === 'delayed') {
      setJustBecameDelayed(true)
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const t = setTimeout(() => setJustBecameDelayed(false), 2_500)
      return () => clearTimeout(t)
    }
    prevUrgencyRef.current = urgency
  }, [urgency])

  useEffect(() => {
    if (flashOnMount) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [flashOnMount])

  const borderStyle: React.CSSProperties =
    urgency === 'delayed'
      ? { border: '2px solid #ef4444', backgroundColor: 'rgba(239,68,68,0.04)' }
      : urgency === 'warning'
      ? { border: '2px solid #eab308' }
      : valueTier === 'vip'
      ? { border: '2px solid rgba(201,168,76,0.5)' }
      : { border: '2px solid #2a2a2a' }

  const animClass =
    justBecameDelayed ? 'k-new-delayed' :
    urgency === 'delayed' ? 'k-delayed' :
    ''

  return (
    <div
      ref={cardRef}
      className={`bg-[#111] rounded-xl p-4 flex flex-col gap-3 ${animClass}`}
      style={borderStyle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <p className={`text-lg font-bold leading-tight truncate ${urgency === 'delayed' ? 'text-red-100' : 'text-[#F5F0E8]'}`}>
            {order.customerName}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {order.tableId && (
              <span className="text-sm text-[#C9A84C] font-semibold">
                Mesa {order.tableId}
              </span>
            )}
            {valueTier !== 'normal' && <ValueBadge tier={valueTier} />}
          </div>
        </div>

        {/* Time badge */}
        <div className={`flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1 ${URGENCY_TIME_BG[urgency]}`}>
          <span className="text-base leading-none">{URGENCY_DOT[urgency]}</span>
          <span className="text-base leading-none tabular-nums">{elapsed}</span>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar pct={pct} urgency={urgency} />

      {/* Items */}
      <ul className="space-y-1.5 border-t border-[#1e1e1e] pt-3">
        {(order.items ?? []).map((item, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className="text-xl font-black text-[#F5F0E8] leading-none w-7 shrink-0">
              {item.quantity}×
            </span>
            <span className="text-base text-[#D0C9BC] leading-snug">
              {item.productName}
              {item.variations && (
                <span className="text-sm text-[#6a6a6a]"> — {item.variations}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <span className="text-sm font-semibold text-[#C9A84C]">{brl(order.total)}</span>
        {next && (
          <button
            onClick={() => onAdvance(order.id, next)}
            disabled={advancing}
            className={`
              flex-1 py-3 px-4 rounded-xl text-base font-bold
              transition-all active:scale-95 disabled:opacity-40
              ${col.btnClass}
            `}
          >
            {advancing ? '…' : col.btnLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  col,
  orders,
  onAdvance,
  advancing,
  newDelayedIds,
}: {
  col:           (typeof COLUMNS)[number]
  orders:        KitchenOrder[]
  onAdvance:     (id: string, next: KitchenStatus) => void
  advancing:     string | null
  newDelayedIds: Set<string>
}) {
  const sorted = useMemo(
    () => [...orders].sort((a, b) => priorityScore(b) - priorityScore(a)),
    [orders],
  )

  const delayedCount = useMemo(
    () => orders.filter((o) => getUrgency(o.createdAt, o.status) === 'delayed').length,
    [orders],
  )

  const avgMins = useMemo(() => {
    if (orders.length === 0) return null
    const total = orders.reduce((sum, o) => sum + elapsedMins(o.createdAt), 0)
    return Math.round(total / orders.length)
  }, [orders])

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className={`rounded-xl ${col.headerBg}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className={`text-sm font-black tracking-widest ${col.headerText}`}>
            {col.label}
          </span>
          <div className="flex items-center gap-2">
            {delayedCount > 0 && (
              <span className="text-xs font-black rounded-full px-2 py-0.5 bg-red-500 text-white">
                🔴 {delayedCount}
              </span>
            )}
            {orders.length > 0 && (
              <span className={`text-sm font-black rounded-full w-7 h-7 flex items-center justify-center bg-black/30 ${col.headerText}`}>
                {orders.length}
              </span>
            )}
          </div>
        </div>

        {orders.length > 0 && (
          <div className={`flex gap-3 px-4 pb-2.5 text-xs font-semibold ${col.headerText} opacity-80`}>
            <span>{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
            {avgMins !== null && <span>· média {avgMins} min</span>}
            {delayedCount > 0 && (
              <span className="text-red-300 font-black">· {delayedCount} atrasado{delayedCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-10 rounded-xl border-2 border-dashed border-[#1e1e1e]">
          <span className="text-[#333] text-sm">Sem pedidos</span>
        </div>
      ) : (
        sorted.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            col={col}
            onAdvance={onAdvance}
            advancing={advancing === order.id}
            flashOnMount={newDelayedIds.has(order.id)}
          />
        ))
      )}
    </div>
  )
}

// ─── Global Stats Bar ─────────────────────────────────────────────────────────

function GlobalStatsBar({ orders }: { orders: KitchenOrder[] }) {
  const active  = orders.filter((o) => o.status !== 'delivered')
  const delayed = active.filter((o) => getUrgency(o.createdAt, o.status) === 'delayed').length

  const avgMins = useMemo(() => {
    if (active.length === 0) return null
    const total = active.reduce((sum, o) => sum + elapsedMins(o.createdAt), 0)
    return Math.round(total / active.length)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-[#111] border-b border-[#1e1e1e] text-sm flex-wrap">
      <span className="text-[#8A8A8A]">
        <span className="font-black text-[#F5F0E8]">{active.length}</span> ativo{active.length !== 1 ? 's' : ''}
      </span>
      {avgMins !== null && (
        <span className="text-[#8A8A8A]">
          média <span className="font-black text-[#F5F0E8]">{avgMins} min</span>
        </span>
      )}
      {delayed > 0 ? (
        <span className="font-black text-red-400">
          🔴 {delayed} atrasado{delayed !== 1 ? 's' : ''}
        </span>
      ) : (
        <span className="text-green-500 font-semibold">✓ tudo no prazo</span>
      )}
    </div>
  )
}

// ─── Kitchen Panel ────────────────────────────────────────────────────────────

function KitchenPanel() {
  useKitchenStyle()

  const [orders, setOrders]           = useState<KitchenOrder[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [advancing, setAdvancing]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const knownDelayedRef = useRef<Set<string>>(new Set())
  const [newDelayedIds, setNewDelayedIds] = useState<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/production', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { orders: KitchenOrder[] }
      setOrders(data.orders)
      setError(null)
      setLastUpdated(new Date())
    } catch (e) {
      setError('Erro ao carregar pedidos')
      console.error('[production]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    intervalRef.current = setInterval(fetchOrders, POLL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchOrders])

  useEffect(() => {
    const nowDelayed = new Set(
      orders.filter((o) => getUrgency(o.createdAt, o.status) === 'delayed').map((o) => o.id),
    )
    const fresh = new Set<string>()
    for (const id of nowDelayed) {
      if (!knownDelayedRef.current.has(id)) fresh.add(id)
    }
    knownDelayedRef.current = nowDelayed
    if (fresh.size > 0) {
      setNewDelayedIds(fresh)
      const t = setTimeout(() => setNewDelayedIds(new Set()), 3_000)
      return () => clearTimeout(t)
    }
  }, [orders])

  const handleAdvance = useCallback(
    async (id: string, next: KitchenStatus) => {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)))
      setAdvancing(id)

      if (next === 'delivered') {
        setTimeout(() => setOrders((prev) => prev.filter((o) => o.id !== id)), 1_000)
      }

      try {
        const res = await fetch('/api/production', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id, status: next }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (e) {
        console.error('[production] advance failed — reverting:', e)
        fetchOrders()
      } finally {
        setAdvancing(null)
      }
    },
    [fetchOrders],
  )

  const activeOrders = orders.filter((o) => o.status !== 'delivered')
  const colData      = COLUMNS.map((col) => ({
    col,
    orders: orders.filter((o) => o.status === col.status),
  }))

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <>
      <div className="sticky top-[89px] z-20 bg-[#0A0A0A] border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-[#8A8A8A]">
          {loading
            ? 'Carregando…'
            : error
            ? error
            : `${activeOrders.length} pedido${activeOrders.length !== 1 ? 's' : ''} ativo${activeOrders.length !== 1 ? 's' : ''}${updatedLabel ? ` · ${updatedLabel}` : ''}`}
        </p>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="shrink-0 border border-[#C9A84C] text-[#C9A84C] font-semibold text-sm px-4 py-2 rounded-lg active:opacity-60 disabled:opacity-40"
        >
          Atualizar
        </button>
      </div>

      <GlobalStatsBar orders={orders} />

      {error && !loading && (
        <div className="bg-red-900/60 border-b border-red-700 px-4 py-2 text-sm text-red-200">
          {error} — toque em Atualizar para tentar novamente
        </div>
      )}

      <main className="p-4 flex flex-col gap-6 md:flex-row md:items-start md:gap-4">
        {colData.map(({ col, orders: colOrders }) => (
          <div key={col.status} className="md:flex-1">
            <Column
              col={col}
              orders={colOrders}
              onAdvance={handleAdvance}
              advancing={advancing}
              newDelayedIds={newDelayedIds}
            />
          </div>
        ))}
      </main>
    </>
  )
}

// ─── Production Shell ─────────────────────────────────────────────────────────

type ProductionTab = 'kitchen' | 'finance' | 'remarketing'

const PROD_TABS: { id: ProductionTab; label: string }[] = [
  { id: 'kitchen',     label: 'Cozinha'     },
  { id: 'finance',     label: 'Financeiro'  },
  { id: 'remarketing', label: 'Remarketing' },
]

export default function ProductionPage() {
  const [tab, setTab] = useState<ProductionTab>('kitchen')

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8]">

      {/* Shell header */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-[#1a1a1a]">
        <div className="px-4 pt-4 pb-0 flex items-center gap-3">
          <h1 className="text-xl font-black tracking-wide">Operacional</h1>
          <span className="text-xs text-[#8A8A8A]">Marujos Sushi</span>
        </div>

        {/* Tab bar */}
        <nav className="flex px-4 mt-3 overflow-x-auto">
          {PROD_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors
                ${tab === t.id
                  ? 'border-[#C9A84C] text-[#C9A84C]'
                  : 'border-transparent text-[#8A8A8A] hover:text-[#F5F0E8]'}
              `}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'kitchen'     && <KitchenPanel />}
      {tab === 'finance'     && <FinancePage />}
      {tab === 'remarketing' && <RemarketingPanel />}

    </div>
  )
}
