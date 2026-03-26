'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Action memory (localStorage) ─────────────────────────────────────────────

const ACTION_MEMORY_KEY  = 'finance_last_action'
const ACTION_COOLDOWN_MS = 30 * 60 * 1000  // 30 min — don't repeat same suggestion

interface ActionMemory {
  actionType: string
  title: string
  timestamp: number  // ms since epoch
}

function loadActionMemory(): ActionMemory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ACTION_MEMORY_KEY)
    return raw ? (JSON.parse(raw) as ActionMemory) : null
  } catch { return null }
}

function saveActionMemory(mem: ActionMemory) {
  try { localStorage.setItem(ACTION_MEMORY_KEY, JSON.stringify(mem)) } catch { /* ignore */ }
}

function isOnCooldown(mem: ActionMemory | null, actionType: string): boolean {
  if (!mem || mem.actionType !== actionType) return false
  return Date.now() - mem.timestamp < ACTION_COOLDOWN_MS
}

// ─── Engine stats (real conversion rates from backend) ────────────────────────

interface EngineStats {
  conversionRates: { reactivation: number; upsell: number }
  execLastHour:    number
  execToday:       number
}

const DEFAULT_ENGINE_STATS: EngineStats = {
  conversionRates: { reactivation: 15, upsell: 10 },
  execLastHour: 0,
  execToday:    0,
}

// ─── Execution log (in-memory for current session) ────────────────────────────

type ExecStatus = 'running' | 'ok' | 'blocked' | 'error'

interface ExecLogEntry {
  id:            number
  flow:          string
  status:        ExecStatus
  inserted:      number
  blockedReason: string | null
  timestamp:     number
}

let execLogSeq = 0

// ─── Shared types ─────────────────────────────────────────────────────────────

type AppTab = 'summary' | 'cash'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Parse "123,45" or "123.45" → centavos integer */
function parseBrl(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function dtShort(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-widest px-1 mt-2">
      {children}
    </h2>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY TAB
// ═══════════════════════════════════════════════════════════════════════════════

type Range = 'today' | 'week'

interface FinanceData {
  range: Range
  rangeStart: string
  revenue: number
  orders: number
  avgTicket: number
  byPayment: Record<string, { orders: number; revenue: number }>
  byStatus: { new: number; preparing: number; ready: number; delivered: number }
  yesterdayRevenue: number
  weeklyAvgRevenue: number
  inactiveCustomerCount: number
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX', credito: 'Crédito', debito: 'Débito',
  dinheiro: 'Dinheiro', vr: 'VR', va: 'VA', desconhecido: 'Outros',
}

// Fallback daily revenue goal when no weekly history exists
const FALLBACK_GOAL_CENTAVOS = 150_000_00  // R$15.000

/** Pick goal: weekly avg if meaningful, otherwise fallback */
function effectiveGoal(weeklyAvg: number): number {
  return weeklyAvg > 0 ? weeklyAvg : FALLBACK_GOAL_CENTAVOS
}

// ── Performance status ──────────────────────────────────────────────────────

type PerfStatus = 'fraco' | 'normal' | 'forte'

function getPerfStatus(revenue: number, goal: number): PerfStatus {
  const now = new Date()
  // Fraction of the business day elapsed (assume 11h–23h = 12h window)
  const openHour  = 11
  const closeHour = 23
  const totalMins = (closeHour - openHour) * 60
  const elapsedMins = Math.max(0, Math.min(totalMins,
    (now.getUTCHours() * 60 + now.getUTCMinutes()) - openHour * 60,
  ))
  const dayFraction = totalMins > 0 ? elapsedMins / totalMins : 0.5
  const expectedNow = goal * dayFraction

  if (expectedNow < 1) return 'normal'  // too early to judge
  const ratio = revenue / expectedNow
  if (ratio >= 1.1) return 'forte'
  if (ratio >= 0.8) return 'normal'
  return 'fraco'
}

const PERF_CONFIG: Record<PerfStatus, { label: string; badgeBg: string; text: string; dot: string; blockBg: string; blockBorder: string }> = {
  forte:  { label: 'Forte',  badgeBg: 'bg-green-950 border-green-700',   text: 'text-green-300',  dot: '🟢', blockBg: 'bg-green-950/30',  blockBorder: 'border-green-900' },
  normal: { label: 'Normal', badgeBg: 'bg-[#111] border-[#1e1e1e]',      text: 'text-[#8A8A8A]', dot: '🟡', blockBg: 'bg-[#111]',         blockBorder: 'border-[#1e1e1e]' },
  fraco:  { label: 'Fraco',  badgeBg: 'bg-red-950/60 border-red-800',    text: 'text-red-400',   dot: '🔴', blockBg: 'bg-red-950/30',    blockBorder: 'border-red-900'   },
}

// ── Kitchen status ──────────────────────────────────────────────────────────

type KitchenLoad = 'idle' | 'ok' | 'overloaded'

function getKitchenLoad(byStatus: FinanceData['byStatus']): KitchenLoad {
  const active = byStatus.new + byStatus.preparing + byStatus.ready
  if (active === 0)  return 'idle'
  if (active >= 8)   return 'overloaded'
  return 'ok'
}

const KITCHEN_LOAD_CONFIG: Record<KitchenLoad, { label: string; sub: string; color: string }> = {
  idle:       { label: 'Ociosa',       sub: 'Sem pedidos ativos',          color: 'text-[#8A8A8A]' },
  ok:         { label: 'OK',           sub: 'Fluxo normal',                color: 'text-green-400' },
  overloaded: { label: 'Sobrecarregada', sub: '8+ pedidos simultâneos',    color: 'text-red-400'   },
}

// ── Time context ────────────────────────────────────────────────────────────

type TimeContext = 'early' | 'peak' | 'offpeak' | 'late'

/** BRT = UTC-3. Business window 11h–23h BRT. Peak = 12h–14h + 19h–22h. */
function getTimeContext(): TimeContext {
  const nowUtc  = new Date()
  const brtHour = ((nowUtc.getUTCHours() - 3) + 24) % 24
  if (brtHour < 11)                                  return 'early'
  if (brtHour >= 23)                                 return 'late'
  if ((brtHour >= 12 && brtHour < 14) || (brtHour >= 19 && brtHour < 22)) return 'peak'
  return 'offpeak'
}

// ── End-of-day projection ────────────────────────────────────────────────────

/** Projects revenue at close (23h BRT) based on current pace. Returns null before 11h. */
function getProjection(revenue: number): number | null {
  const nowUtc  = new Date()
  const brtHour = ((nowUtc.getUTCHours() - 3) + 24) % 24
  const brtMin  = nowUtc.getUTCMinutes()
  const openH   = 11
  const closeH  = 23
  const elapsed = (brtHour - openH) * 60 + brtMin   // mins since open
  const total   = (closeH  - openH) * 60             // 720 min window
  if (elapsed <= 0) return null
  const rate = revenue / elapsed           // centavos per minute
  return Math.round(rate * total)          // extrapolated to full day
}

// ── Action suggestions ──────────────────────────────────────────────────────

type ActionPriority = 'high' | 'medium' | 'low'
type ActionType     = 'reactivate' | 'upsell' | 'slow_kitchen' | 'push_special' | 'ok'

interface ActionItem {
  priority:       ActionPriority
  actionType:     ActionType
  icon:           string
  title:          string
  sub:            string
  impactCentavos: number | null   // estimated revenue impact
  ctaLabel:       string | null   // button label, null = no button
  ctaHref:        string | null   // whatsapp:// or /crm/... URL
}


function buildActions(
  data:         FinanceData,
  perf:         PerfStatus,
  kitchenLoad:  KitchenLoad,
  timeCtx:      TimeContext,
  memory:       ActionMemory | null,
  engineStats:  EngineStats,
): ActionItem[] {
  const items: ActionItem[] = []
  const inactive    = data.inactiveCustomerCount
  const isPeak      = timeCtx === 'peak'
  const isLate      = timeCtx === 'late'
  const rateReact   = engineStats.conversionRates.reactivation / 100
  const rateUpsell  = engineStats.conversionRates.upsell       / 100
  const overLimit   = engineStats.execLastHour >= 3

  // ── Kitchen overload ──────────────────────────────────────────────────────
  if (kitchenLoad === 'overloaded') {
    items.push({
      priority:       'high',
      actionType:     'slow_kitchen',
      icon:           '🔥',
      title:          'Cozinha sobrecarregada — pause novos pedidos',
      sub:            'Avise as mesas para aguardar. Retome quando a fila baixar.',
      impactCentavos: null,
      ctaLabel:       null,
      ctaHref:        null,
    })
    return items
  }

  // ── Reactivation — push demand ────────────────────────────────────────────
  if (perf === 'fraco' && !isOnCooldown(memory, 'reactivate')) {
    const urgency    = isPeak ? 'AGORA — horário de pico' : isLate ? 'Última chance hoje' : 'Momento oportuno'
    const impactEst  = inactive > 0 ? Math.round(inactive * data.avgTicket * rateReact) : null
    const convPct    = engineStats.conversionRates.reactivation
    items.push({
      priority:       isPeak || isLate ? 'high' : 'medium',
      actionType:     'reactivate',
      icon:           '📲',
      title:          inactive > 0
                        ? `${urgency} — ${inactive} clientes inativos`
                        : `${urgency} — ative promoção no salão`,
      sub:            inactive > 0
                        ? `+${impactEst ? brl(impactEst) : '?'} estimado (taxa real: ${convPct}%)`
                        : 'Vendas abaixo do esperado para este horário.',
      impactCentavos: impactEst,
      ctaLabel:       !overLimit && inactive > 0 ? `Executar agora (${inactive} clientes)` : null,
      ctaHref:        null,   // executed via autoexec API, not WhatsApp link
    })
  }

  // ── Low avg ticket: upsell ────────────────────────────────────────────────
  if (data.avgTicket < 5_000 && data.orders > 0 && !isOnCooldown(memory, 'upsell')) {
    const impactEst = Math.round(data.orders * data.avgTicket * rateUpsell)
    const convPct   = engineStats.conversionRates.upsell
    items.push({
      priority:       'medium',
      actionType:     'upsell',
      icon:           '🍱',
      title:          `Ticket médio baixo (${brl(data.avgTicket)}) — reativar clientes recentes`,
      sub:            `+${brl(impactEst)} estimado (taxa real: ${convPct}%)`,
      impactCentavos: impactEst,
      ctaLabel:       !overLimit ? 'Executar upsell agora' : null,
      ctaHref:        null,
    })
  }

  // ── Kitchen idle + not struggling ─────────────────────────────────────────
  if (kitchenLoad === 'idle' && perf !== 'fraco') {
    items.push({
      priority:       'low',
      actionType:     'push_special',
      icon:           '💬',
      title:          'Cozinha livre — aceite pedidos especiais',
      sub:            'Bom momento para pratos fora do cardápio ou preparo antecipado.',
      impactCentavos: null,
      ctaLabel:       null,
      ctaHref:        null,
    })
  }

  // ── All good ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    items.push({
      priority:       'low',
      actionType:     'ok',
      icon:           '✅',
      title:          'Tudo em ordem',
      sub:            'Ritmo dentro do esperado. Continue assim.',
      impactCentavos: null,
      ctaLabel:       null,
      ctaHref:        null,
    })
  }

  return items.slice(0, 3)
}

const PRIORITY_BADGE: Record<ActionPriority, { label: string; cls: string }> = {
  high:   { label: 'Alta prioridade',  cls: 'bg-red-900/60 text-red-300 border-red-700'         },
  medium: { label: 'Média prioridade', cls: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
  low:    { label: 'Info',             cls: 'bg-[#1a1a1a] text-[#8A8A8A] border-[#2a2a2a]'      },
}

// ── Payment insight ─────────────────────────────────────────────────────────

function isUnusualPayment(method: string, pct: number): string | null {
  if (method === 'dinheiro' && pct > 40)
    return `${pct}% em dinheiro — verifique o troco e confira o caixa`
  if (method === 'desconhecido' && pct > 10)
    return `${pct}% sem método registrado — peça ao atendente para corrigir`
  return null
}

// ── Summary tab ─────────────────────────────────────────────────────────────

function SummaryTab() {
  const [range, setRange]           = useState<Range>('today')
  const [data, setData]             = useState<FinanceData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [memory, setMemory]         = useState<ActionMemory | null>(null)
  const [engineStats, setEngineStats] = useState<EngineStats>(DEFAULT_ENGINE_STATS)
  const [execLog, setExecLog]       = useState<ExecLogEntry[]>([])
  const autoExecRef                 = useRef<boolean>(false)  // prevent double-fire

  // Load action memory on mount (client-only)
  useEffect(() => { setMemory(loadActionMemory()) }, [])

  // Fetch real conversion rates + hourly exec count
  const fetchEngineStats = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/engine-stats', { cache: 'no-store' })
      if (res.ok) setEngineStats(await res.json() as EngineStats)
    } catch { /* non-critical — keep defaults */ }
  }, [])

  useEffect(() => { fetchEngineStats() }, [fetchEngineStats])

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/finance?range=${r}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json() as FinanceData)
    } catch (e) {
      setError('Erro ao carregar dados')
      console.error('[finance]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(range) }, [range, fetchData])

  // ── Auto-execution ─────────────────────────────────────────────────────────

  /**
   * Call /api/finance/autoexec for a given flow.
   * Adds a log entry (running → ok/blocked/error).
   * Updates memory and engine stats after completion.
   */
  const autoExecute = useCallback(async (flow: 'reactivation' | 'upsell', source: 'auto' | 'manual') => {
    const id = ++execLogSeq
    setExecLog((prev) => [
      { id, flow, status: 'running', inserted: 0, blockedReason: null, timestamp: Date.now() },
      ...prev.slice(0, 4),
    ])

    try {
      const res  = await fetch('/api/finance/autoexec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow, source }),
      })
      const json = await res.json() as { ok: boolean; inserted?: number; blockedReason?: string | null }

      const actionType = flow === 'reactivation' ? 'reactivate' : 'upsell'
      if (json.ok) {
        const mem: ActionMemory = {
          actionType,
          title: flow === 'reactivation'
            ? `Reativação automática — ${json.inserted} mensagens enfileiradas`
            : `Upsell automático — ${json.inserted} mensagens enfileiradas`,
          timestamp: Date.now(),
        }
        saveActionMemory(mem)
        setMemory(mem)
        setExecLog((prev) => prev.map((e) =>
          e.id === id ? { ...e, status: 'ok', inserted: json.inserted ?? 0 } : e
        ))
      } else {
        setExecLog((prev) => prev.map((e) =>
          e.id === id ? { ...e, status: 'blocked', blockedReason: json.blockedReason ?? null } : e
        ))
      }

      // Refresh engine stats so hourly counter is up-to-date
      await fetchEngineStats()
    } catch {
      setExecLog((prev) => prev.map((e) =>
        e.id === id ? { ...e, status: 'error', blockedReason: 'Erro de rede' } : e
      ))
    }
  }, [fetchEngineStats])

  // ── Manual CTA handler ─────────────────────────────────────────────────────

  function handleActionClick(item: ActionItem) {
    if (item.actionType === 'reactivate' || item.actionType === 'upsell') {
      const flow = item.actionType === 'reactivate' ? 'reactivation' : 'upsell'
      autoExecute(flow, 'manual')
    } else {
      // Non-executable actions just record the tap
      const mem: ActionMemory = { actionType: item.actionType, title: item.title, timestamp: Date.now() }
      saveActionMemory(mem)
      setMemory(mem)
      if (item.ctaHref) window.open(item.ctaHref, '_blank', 'noopener,noreferrer')
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const paymentRows = data
    ? Object.entries(data.byPayment).sort((a, b) => b[1].revenue - a[1].revenue)
    : []

  const rangeLabel  = range === 'today' ? 'Hoje' : 'Últimos 7 dias'
  const goal        = data ? effectiveGoal(data.weeklyAvgRevenue) : FALLBACK_GOAL_CENTAVOS
  const perf        = data && range === 'today' ? getPerfStatus(data.revenue, goal) : null
  const kitchenLoad = data ? getKitchenLoad(data.byStatus) : null
  const goalIsAvg   = data && data.weeklyAvgRevenue > 0
  const timeCtx     = getTimeContext()
  const projection  = data && range === 'today' ? getProjection(data.revenue) : null
  const actions     = data && perf && kitchenLoad
    ? buildActions(data, perf, kitchenLoad, timeCtx, memory, engineStats)
    : []
  const primaryAction    = actions[0] ?? null
  const secondaryActions = actions.slice(1)

  // ── Auto-execute: fire when high-priority action and no cooldown ───────────
  useEffect(() => {
    if (!primaryAction || primaryAction.priority !== 'high') { autoExecRef.current = false; return }
    if (primaryAction.actionType !== 'reactivate' && primaryAction.actionType !== 'upsell') return
    if (autoExecRef.current) return          // already fired this cycle
    if (engineStats.execLastHour >= 3) return  // client-side rate limit check
    autoExecRef.current = true
    const flow = primaryAction.actionType === 'reactivate' ? 'reactivation' : 'upsell'
    autoExecute(flow, 'auto')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAction?.actionType, primaryAction?.priority])

  const TIME_CTX_LABEL: Record<TimeContext, string> = {
    early:   'antes do expediente',
    peak:    'horário de pico',
    offpeak: 'horário tranquilo',
    late:    'fim do expediente',
  }

  const BLOCKED_REASON_LABEL: Record<string, string> = {
    kitchen_overloaded:   'cozinha sobrecarregada',
    flow_on_cooldown:     'cooldown ativo',
    hourly_limit_reached: 'limite horário atingido',
  }

  // Yesterday vs today comparison
  const vsYesterday = data && range === 'today' && data.yesterdayRevenue > 0
    ? Math.round(((data.revenue - data.yesterdayRevenue) / data.yesterdayRevenue) * 100)
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* Range selector */}
      <div className="flex gap-2">
        {(['today', 'week'] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              range === r ? 'bg-[#C9A84C] text-black' : 'bg-[#111] text-[#8A8A8A] border border-[#1e1e1e]'
            }`}>
            {r === 'today' ? 'Hoje' : 'Últimos 7 dias'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-200">{error}</div>
      )}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <span className="text-[#333] text-sm">Carregando…</span>
        </div>
      )}

      {data && (
        <>
          {/* ── PRIMARY KPI BLOCK ──────────────────────────────────────── */}
          {range === 'today' && (
            <div className={`rounded-2xl p-5 flex flex-col gap-4 border ${perf ? PERF_CONFIG[perf].blockBg + ' ' + PERF_CONFIG[perf].blockBorder : 'bg-[#111] border-[#1e1e1e]'}`}>
              {/* Revenue vs goal */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#8A8A8A] uppercase tracking-wide mb-1">Receita hoje</p>
                  <p className="text-4xl font-black text-[#F5F0E8] leading-none">{brl(data.revenue)}</p>
                  {vsYesterday !== null && (
                    <p className={`text-sm font-bold mt-1.5 ${vsYesterday >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {vsYesterday >= 0 ? '▲' : '▼'} {Math.abs(vsYesterday)}% vs ontem ({brl(data.yesterdayRevenue)})
                    </p>
                  )}
                </div>
                {perf && (
                  <div className="flex flex-col items-end gap-1">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-black ${PERF_CONFIG[perf].badgeBg} ${PERF_CONFIG[perf].text}`}>
                      <span>{PERF_CONFIG[perf].dot}</span>
                      <span>{PERF_CONFIG[perf].label}</span>
                    </div>
                    <span className="text-xs text-[#555]">{TIME_CTX_LABEL[timeCtx]}</span>
                  </div>
                )}
              </div>

              {/* Goal progress bar */}
              <div>
                <div className="flex justify-between text-xs text-[#8A8A8A] mb-1.5">
                  <span>{goalIsAvg ? 'Meta — média dos últimos 7 dias' : 'Meta diária'}</span>
                  <span>{brl(goal)}</span>
                </div>
                <div className="h-2.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.round((data.revenue / goal) * 100))}%`,
                      backgroundColor: perf === 'forte' ? '#4ade80' : perf === 'fraco' ? '#ef4444' : '#C9A84C',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-[#8A8A8A]">
                    {Math.round((data.revenue / goal) * 100)}% atingido
                  </span>
                  {data.revenue < goal && (
                    <span className="text-[#C9A84C] font-semibold">
                      faltam {brl(goal - data.revenue)}
                    </span>
                  )}
                </div>
              </div>

              {/* Projection row */}
              {projection !== null && (
                <div className="flex items-center justify-between text-sm border-t border-[#1e1e1e] pt-3">
                  <span className="text-[#8A8A8A]">Projeção fim do dia</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-black ${projection >= goal ? 'text-green-400' : 'text-red-400'}`}>
                      {brl(projection)}
                    </span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${projection >= goal ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {projection >= goal ? '✓ meta' : `−${brl(goal - projection)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick metrics row */}
              <div className="flex gap-3 border-t border-[#1e1e1e] pt-4">
                <div className="flex-1 text-center">
                  <p className="text-xl font-black text-[#F5F0E8]">{data.orders}</p>
                  <p className="text-xs text-[#8A8A8A] mt-0.5">pedidos</p>
                </div>
                <div className="w-px bg-[#1e1e1e]" />
                <div className="flex-1 text-center">
                  <p className="text-xl font-black text-[#F5F0E8]">{brl(data.avgTicket)}</p>
                  <p className="text-xs text-[#8A8A8A] mt-0.5">ticket médio</p>
                </div>
                {data.yesterdayRevenue > 0 && (
                  <>
                    <div className="w-px bg-[#1e1e1e]" />
                    <div className="flex-1 text-center">
                      <p className="text-xl font-black text-[#6a6a6a]">{brl(data.yesterdayRevenue)}</p>
                      <p className="text-xs text-[#8A8A8A] mt-0.5">ontem</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Week view — simpler summary block */}
          {range === 'week' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex flex-col gap-1">
                <p className="text-xs text-[#8A8A8A] uppercase tracking-wide">Receita</p>
                <p className="text-2xl font-black text-[#F5F0E8]">{brl(data.revenue)}</p>
              </div>
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex flex-col gap-1">
                <p className="text-xs text-[#8A8A8A] uppercase tracking-wide">Pedidos</p>
                <p className="text-2xl font-black text-[#F5F0E8]">{data.orders}</p>
              </div>
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex flex-col gap-1">
                <p className="text-xs text-[#8A8A8A] uppercase tracking-wide">Ticket médio</p>
                <p className="text-2xl font-black text-[#F5F0E8]">{brl(data.avgTicket)}</p>
              </div>
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex flex-col gap-1">
                <p className="text-xs text-[#8A8A8A] uppercase tracking-wide">Período</p>
                <p className="text-sm font-bold text-[#F5F0E8] mt-1">
                  {new Date(data.rangeStart).toLocaleDateString('pt-BR')} – hoje
                </p>
              </div>
            </div>
          )}

          {/* ── DECISION ENGINE (today only) ────────────────────────── */}
          {range === 'today' && primaryAction && (
            <>
              <SectionTitle>Ação principal</SectionTitle>

              {/* Primary action — full highlight */}
              <div className={`rounded-2xl p-4 flex flex-col gap-3 border ${
                primaryAction.priority === 'high'
                  ? 'bg-red-950/40 border-red-800'
                  : primaryAction.priority === 'medium'
                  ? 'bg-yellow-950/30 border-yellow-800/60'
                  : 'bg-[#111] border-[#1e1e1e]'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">{primaryAction.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[primaryAction.priority].cls}`}>
                        {PRIORITY_BADGE[primaryAction.priority].label}
                      </span>
                    </div>
                    <p className="text-sm font-black text-[#F5F0E8] leading-snug">{primaryAction.title}</p>
                    <p className="text-xs text-[#8A8A8A] mt-1">{primaryAction.sub}</p>
                  </div>
                </div>

                {/* CTA button — manual execution */}
                {primaryAction.ctaLabel && (
                  <button
                    onClick={() => handleActionClick(primaryAction)}
                    disabled={execLog.some((e) => e.status === 'running')}
                    className="w-full py-3 rounded-xl text-sm font-black text-black bg-[#C9A84C] active:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {execLog.some((e) => e.status === 'running') ? 'Executando…' : primaryAction.ctaLabel}
                  </button>
                )}
              </div>

              {/* Secondary actions — compact */}
              {secondaryActions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {secondaryActions.map((item, i) => (
                    <div key={i} className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 flex items-start gap-3">
                      <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#F5F0E8]">{item.title}</p>
                        <p className="text-xs text-[#8A8A8A] mt-0.5">{item.sub}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[item.priority].cls}`}>
                          {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Média' : 'Info'}
                        </span>
                        {item.ctaLabel && (
                          <button
                            onClick={() => handleActionClick(item)}
                            disabled={execLog.some((e) => e.status === 'running')}
                            className="text-xs font-bold text-[#C9A84C] underline disabled:opacity-40"
                          >
                            Executar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Execution log ──────────────────────────────────────── */}
              {execLog.length > 0 && (
                <>
                  <SectionTitle>Log de execuções</SectionTitle>
                  <div className="flex flex-col gap-1.5">
                    {execLog.map((entry) => {
                      const diffMin = Math.round((Date.now() - entry.timestamp) / 60_000)
                      const timeAgo = diffMin < 1 ? 'agora' : diffMin < 60 ? `${diffMin}min` : `${Math.round(diffMin / 60)}h`
                      return (
                        <div key={entry.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                          entry.status === 'running' ? 'bg-[#1a1a1a] border-[#2a2a2a] text-[#8A8A8A]' :
                          entry.status === 'ok'      ? 'bg-green-950/30 border-green-900 text-green-400' :
                          entry.status === 'blocked' ? 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555]' :
                                                       'bg-red-950/30 border-red-900 text-red-400'
                        }`}>
                          <span className="font-black shrink-0">
                            {entry.status === 'running' ? '⏳' :
                             entry.status === 'ok'      ? '✓' :
                             entry.status === 'blocked' ? '⊘' : '✕'}
                          </span>
                          <span className="flex-1 font-semibold">
                            {entry.flow}
                            {entry.status === 'ok'      && ` — ${entry.inserted} enfileirados`}
                            {entry.status === 'blocked' && ` — ${BLOCKED_REASON_LABEL[entry.blockedReason ?? ''] ?? entry.blockedReason}`}
                            {entry.status === 'running' && ' — executando…'}
                            {entry.status === 'error'   && ` — ${entry.blockedReason ?? 'erro'}`}
                          </span>
                          <span className="text-[#444] shrink-0">{timeAgo}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Engine stats footer */}
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="flex gap-3 text-xs text-[#444]">
                  <span>Taxa de conversão: reativação {engineStats.conversionRates.reactivation}% · upsell {engineStats.conversionRates.upsell}%</span>
                </div>
                <span className={`text-xs font-bold ${engineStats.execLastHour >= 3 ? 'text-red-500' : 'text-[#444]'}`}>
                  {engineStats.execLastHour}/3 na última hora
                </span>
              </div>

              {/* Action memory — last action taken */}
              {memory && !execLog.length && (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-[#444]">Última ação:</span>
                  <span className="text-xs text-[#555] truncate flex-1">{memory.title}</span>
                  <span className="text-xs text-[#333] shrink-0">
                    {(() => {
                      const diffMs  = Date.now() - memory.timestamp
                      const diffMin = Math.round(diffMs / 60_000)
                      return diffMin < 60 ? `${diffMin}min atrás` : `${Math.round(diffMin / 60)}h atrás`
                    })()}
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── PAYMENT INSIGHT ────────────────────────────────────────── */}
          <SectionTitle>Pagamento — {rangeLabel}</SectionTitle>
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            {paymentRows.length === 0
              ? <p className="text-sm text-[#333] text-center py-6">Sem dados</p>
              : paymentRows.map(([method, stats], i) => {
                  const pct     = data.revenue > 0 ? Math.round((stats.revenue / data.revenue) * 100) : 0
                  const alert   = isUnusualPayment(method, pct)
                  return (
                    <div key={method} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#1a1a1a]' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#F5F0E8]">{PAYMENT_LABELS[method] ?? method}</p>
                          {alert && (
                            <span className="text-xs font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">⚠</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div className="h-full bg-[#C9A84C] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        {alert && (
                          <p className="text-xs text-yellow-500 mt-1">{alert}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#F5F0E8]">{brl(stats.revenue)}</p>
                        <p className="text-xs text-[#8A8A8A]">{stats.orders} ped · {pct}%</p>
                      </div>
                    </div>
                  )
                })}
          </div>

          {/* ── KITCHEN STATUS ─────────────────────────────────────────── */}
          <SectionTitle>Cozinha — agora</SectionTitle>
          {kitchenLoad && (
            <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${
              kitchenLoad === 'overloaded' ? 'bg-red-950/50 border-red-800' :
              kitchenLoad === 'idle'       ? 'bg-[#111] border-[#1e1e1e]'  :
                                             'bg-green-950/40 border-green-800'
            }`}>
              <div>
                <p className={`text-base font-black ${KITCHEN_LOAD_CONFIG[kitchenLoad].color}`}>
                  {KITCHEN_LOAD_CONFIG[kitchenLoad].label}
                </p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">{KITCHEN_LOAD_CONFIG[kitchenLoad].sub}</p>
              </div>
              <div className="flex gap-3 text-center">
                <div>
                  <p className="text-lg font-black text-red-400">{data.byStatus.new}</p>
                  <p className="text-xs text-[#555]">novos</p>
                </div>
                <div>
                  <p className="text-lg font-black text-yellow-400">{data.byStatus.preparing}</p>
                  <p className="text-xs text-[#555]">prep.</p>
                </div>
                <div>
                  <p className="text-lg font-black text-green-400">{data.byStatus.ready}</p>
                  <p className="text-xs text-[#555]">prontos</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASH TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface CashSession {
  id: string
  openedAt: string
  closedAt: string | null
  openingAmount: number
  countedAmount: number | null
  notes: string | null
}

interface CashEntry {
  id: string
  sessionId: string
  createdAt: string
  type: 'in' | 'out'
  amount: number
  description: string
}

type CashView = 'main' | 'open' | 'entry' | 'close'

function CashTab() {
  const [session, setSession] = useState<CashSession | null | undefined>(undefined) // undefined = not yet loaded
  const [entries, setEntries] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<CashView>('main')

  // Form fields
  const [fAmount, setFAmount] = useState('')
  const [fDescription, setFDescription] = useState('')
  const [fEntryType, setFEntryType] = useState<'in' | 'out'>('in')
  const [fCountedAmount, setFCountedAmount] = useState('')
  const [fNotes, setFNotes] = useState('')

  const amountRef = useRef<HTMLInputElement>(null)

  const fetchCash = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cash', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { session: CashSession | null; entries: CashEntry[] }
      setSession(data.session)
      setEntries(data.entries)
    } catch (e) {
      setError('Erro ao carregar caixa')
      console.error('[cash]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCash() }, [fetchCash])

  // Focus amount field when view changes
  useEffect(() => {
    if (view !== 'main') setTimeout(() => amountRef.current?.focus(), 100)
  }, [view])

  async function apiPost(body: Record<string, unknown>) {
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
    return json
  }

  function resetForms() {
    setFAmount('')
    setFDescription('')
    setFCountedAmount('')
    setFNotes('')
    setFEntryType('in')
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleOpen() {
    const amount = parseBrl(fAmount)
    if (amount === null) { setError('Valor inválido'); return }
    setBusy(true); setError(null)
    try {
      const data = await apiPost({ action: 'open', openingAmount: amount, notes: fNotes || undefined })
      setSession(data.session)
      setEntries([])
      resetForms()
      setView('main')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function handleEntry() {
    const amount = parseBrl(fAmount)
    if (amount === null || amount <= 0) { setError('Valor inválido'); return }
    if (!fDescription.trim()) { setError('Descrição obrigatória'); return }
    setBusy(true); setError(null)
    try {
      const data = await apiPost({ action: 'entry', type: fEntryType, amount, description: fDescription.trim() })
      setEntries((prev) => [...prev, data.entry])
      resetForms()
      setView('main')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function handleClose() {
    const counted = parseBrl(fCountedAmount)
    if (counted === null) { setError('Valor inválido'); return }
    setBusy(true); setError(null)
    try {
      const data = await apiPost({ action: 'close', countedAmount: counted, notes: fNotes || undefined })
      setSession(data.session)
      resetForms()
      setView('main')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const totalIn  = entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.amount, 0)
  const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0)
  const expected = session ? session.openingAmount + totalIn - totalOut : 0
  const difference = session?.countedAmount != null ? session.countedAmount - expected : null

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading && session === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[#333] text-sm">Carregando…</span>
      </div>
    )
  }

  // ── Error banner ──────────────────────────────────────────────────────────

  const ErrorBanner = error ? (
    <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-200">
      {error}
    </div>
  ) : null

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: OPEN REGISTER
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'open') {
    return (
      <div className="flex flex-col gap-4">
        {ErrorBanner}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 flex flex-col gap-5">
          <p className="text-base font-bold text-[#F5F0E8]">Abrir caixa</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8A8A] uppercase tracking-wide">Fundo de caixa (R$)</label>
            <input
              ref={amountRef}
              type="text" inputMode="decimal"
              placeholder="0,00"
              value={fAmount}
              onChange={(e) => setFAmount(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-xl font-bold text-[#F5F0E8] placeholder:text-[#333] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8A8A] uppercase tracking-wide">Observação (opcional)</label>
            <input
              type="text"
              placeholder="Ex: turno manhã, responsável João…"
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#555] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setView('main'); setError(null); resetForms() }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-[#8A8A8A] active:opacity-60">
              Cancelar
            </button>
            <button onClick={handleOpen} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-green-600 text-white disabled:opacity-40 active:opacity-70">
              {busy ? 'Abrindo…' : 'Confirmar abertura'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: ADD ENTRY
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'entry') {
    return (
      <div className="flex flex-col gap-4">
        {ErrorBanner}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 flex flex-col gap-5">
          <p className="text-base font-bold text-[#F5F0E8]">Lançamento manual</p>

          {/* Type selector */}
          <div className="flex gap-2">
            {(['in', 'out'] as const).map((t) => (
              <button key={t} onClick={() => setFEntryType(t)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                  fEntryType === t
                    ? t === 'in' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#8A8A8A]'
                }`}>
                {t === 'in' ? '+ Entrada' : '− Saída'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8A8A] uppercase tracking-wide">Valor (R$)</label>
            <input
              ref={amountRef}
              type="text" inputMode="decimal"
              placeholder="0,00"
              value={fAmount}
              onChange={(e) => setFAmount(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-xl font-bold text-[#F5F0E8] placeholder:text-[#333] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8A8A] uppercase tracking-wide">Descrição</label>
            <input
              type="text"
              placeholder="Ex: troco quebrado, sangria, suprimento…"
              value={fDescription}
              onChange={(e) => setFDescription(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#555] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setView('main'); setError(null); resetForms() }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-[#8A8A8A] active:opacity-60">
              Cancelar
            </button>
            <button onClick={handleEntry} disabled={busy}
              className={`flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40 active:opacity-70 ${
                fEntryType === 'in' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
              {busy ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: CLOSE REGISTER
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'close') {
    const previewCounted = parseBrl(fCountedAmount)
    const previewDiff = previewCounted !== null ? previewCounted - expected : null

    return (
      <div className="flex flex-col gap-4">
        {ErrorBanner}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 flex flex-col gap-5">
          <p className="text-base font-bold text-[#F5F0E8]">Fechar caixa</p>

          {/* Expected summary */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-4 py-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A8A8A]">Fundo inicial</span>
              <span className="text-[#F5F0E8]">{session ? brl(session.openingAmount) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A8A8A]">Entradas</span>
              <span className="text-green-400">+ {brl(totalIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A8A8A]">Saídas</span>
              <span className="text-red-400">− {brl(totalOut)}</span>
            </div>
            <div className="flex justify-between border-t border-[#1e1e1e] pt-2 font-bold">
              <span className="text-[#8A8A8A]">Total esperado</span>
              <span className="text-[#C9A84C]">{brl(expected)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8A8A] uppercase tracking-wide">Valor contado (R$)</label>
            <input
              ref={amountRef}
              type="text" inputMode="decimal"
              placeholder="0,00"
              value={fCountedAmount}
              onChange={(e) => setFCountedAmount(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-xl font-bold text-[#F5F0E8] placeholder:text-[#333] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          {/* Live difference preview */}
          {previewDiff !== null && (
            <div className={`flex justify-between items-center px-4 py-3 rounded-lg border ${
              previewDiff === 0
                ? 'bg-green-950 border-green-700'
                : previewDiff > 0
                ? 'bg-blue-950 border-blue-700'
                : 'bg-red-950 border-red-700'
            }`}>
              <span className="text-sm font-semibold text-[#F5F0E8]">Diferença</span>
              <span className={`text-lg font-black ${
                previewDiff === 0 ? 'text-green-400' : previewDiff > 0 ? 'text-blue-300' : 'text-red-400'
              }`}>
                {previewDiff > 0 ? '+' : ''}{brl(previewDiff)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8A8A] uppercase tracking-wide">Observação (opcional)</label>
            <input
              type="text"
              placeholder="Motivo de diferença, responsável…"
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#555] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setView('main'); setError(null); resetForms() }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-[#8A8A8A] active:opacity-60">
              Cancelar
            </button>
            <button onClick={handleClose} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-600 text-white disabled:opacity-40 active:opacity-70">
              {busy ? 'Fechando…' : 'Fechar caixa'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: MAIN (no session or session open/closed)
  // ══════════════════════════════════════════════════════════════════════════

  const isClosed = session?.closedAt != null

  return (
    <div className="flex flex-col gap-4">
      {ErrorBanner}

      {/* ── No session ────────────────────────────────────────────────── */}
      {!session && (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-[#8A8A8A] text-sm">Nenhum caixa aberto</p>
          <button onClick={() => { setError(null); setView('open') }}
            className="w-full py-4 rounded-xl text-base font-bold bg-green-600 text-white active:opacity-70">
            Abrir caixa
          </button>
        </div>
      )}

      {/* ── Session info ──────────────────────────────────────────────── */}
      {session && (
        <>
          {/* Status banner */}
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
            isClosed ? 'bg-[#1a1a1a] border border-[#2a2a2a]' : 'bg-green-950 border border-green-800'
          }`}>
            <div>
              <p className={`text-sm font-bold ${isClosed ? 'text-[#8A8A8A]' : 'text-green-300'}`}>
                {isClosed ? 'Caixa fechado' : 'Caixa aberto'}
              </p>
              <p className="text-xs text-[#555] mt-0.5">
                Aberto {dtShort(session.openedAt)}
                {session.closedAt && ` · Fechado ${dtShort(session.closedAt)}`}
              </p>
            </div>
            <button onClick={fetchCash} disabled={loading}
              className="text-xs text-[#C9A84C] border border-[#C9A84C] rounded px-2 py-1 active:opacity-60 disabled:opacity-40">
              ↻
            </button>
          </div>

          {/* Totals card */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            {[
              { label: 'Fundo inicial',   value: brl(session.openingAmount), color: 'text-[#F5F0E8]' },
              { label: 'Entradas',        value: `+ ${brl(totalIn)}`,        color: 'text-green-400' },
              { label: 'Saídas',          value: `− ${brl(totalOut)}`,       color: 'text-red-400' },
              { label: 'Total esperado',  value: brl(expected),              color: 'text-[#C9A84C] font-bold' },
            ].map(({ label, value, color }, i) => (
              <div key={label} className={`flex justify-between items-center px-4 py-3 ${i > 0 ? 'border-t border-[#1a1a1a]' : ''}`}>
                <span className="text-sm text-[#8A8A8A]">{label}</span>
                <span className={`text-sm ${color}`}>{value}</span>
              </div>
            ))}

            {/* Counted + difference — only after close */}
            {session.countedAmount != null && (
              <>
                <div className="flex justify-between items-center px-4 py-3 border-t border-[#1a1a1a]">
                  <span className="text-sm text-[#8A8A8A]">Contado</span>
                  <span className="text-sm text-[#F5F0E8]">{brl(session.countedAmount)}</span>
                </div>
                <div className={`flex justify-between items-center px-4 py-3 border-t border-[#1a1a1a] ${
                  difference === 0 ? '' : difference! > 0 ? 'bg-blue-950/40' : 'bg-red-950/40'
                }`}>
                  <span className="text-sm font-semibold text-[#F5F0E8]">Diferença</span>
                  <span className={`text-base font-black ${
                    difference === 0 ? 'text-green-400' : difference! > 0 ? 'text-blue-300' : 'text-red-400'
                  }`}>
                    {difference! > 0 ? '+' : ''}{brl(difference!)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Entries list */}
          {entries.length > 0 && (
            <>
              <SectionTitle>Lançamentos</SectionTitle>
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
                {entries.map((e, i) => (
                  <div key={e.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#1a1a1a]' : ''}`}>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      e.type === 'in' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                    }`}>
                      {e.type === 'in' ? 'entrada' : 'saída'}
                    </span>
                    <p className="flex-1 text-sm text-[#D0C9BC] truncate">{e.description}</p>
                    <span className={`text-sm font-bold shrink-0 ${e.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                      {e.type === 'in' ? '+' : '−'}{brl(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Action buttons — only when open */}
          {!isClosed && (
            <div className="flex flex-col gap-3 mt-1">
              <button onClick={() => { setError(null); setView('entry') }}
                className="w-full py-4 rounded-xl text-base font-bold bg-[#111] border border-[#C9A84C] text-[#C9A84C] active:opacity-60">
                + Lançamento manual
              </button>
              <button onClick={() => { setError(null); setView('close') }}
                className="w-full py-4 rounded-xl text-base font-bold bg-red-700 text-white active:opacity-70">
                Fechar caixa
              </button>
            </div>
          )}

          {/* Reopen — only when closed */}
          {isClosed && (
            <button onClick={() => { setError(null); setView('open') }}
              className="w-full py-4 rounded-xl text-base font-bold bg-green-600 text-white active:opacity-70 mt-1">
              Abrir novo caixa
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function FinancePage() {
  const [tab, setTab] = useState<AppTab>('summary')

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-[#1a1a1a] px-4 py-3">
        <h1 className="text-xl font-black tracking-wide">Financeiro</h1>

        {/* Top-level tabs */}
        <div className="flex gap-2 mt-3">
          {([
            { key: 'summary' as AppTab, label: 'Resumo' },
            { key: 'cash'    as AppTab, label: 'Caixa' },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                tab === key ? 'bg-[#C9A84C] text-black' : 'bg-[#111] text-[#8A8A8A] border border-[#1e1e1e]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pb-8 pt-4">
        {tab === 'summary' ? <SummaryTab /> : <CashTab />}
      </main>
    </div>
  )
}
