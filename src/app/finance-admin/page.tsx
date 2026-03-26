'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CostCategory, OwnerCost } from '@/app/api/finance-admin/costs/route'
import type { FinanceGoal } from '@/app/api/finance-admin/goals/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function brlCompact(centavos: number) {
  const v = centavos / 100
  if (v >= 1000) return `R$\u00a0${(v / 1000).toFixed(1)}k`
  return (v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(value: number) {
  return `${value.toFixed(1)}%`
}

function parseBrl(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriod(p: string): string {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function periodShort(p: string): string {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminData {
  period: string
  rangeStart: string
  rangeEnd: string
  overview: {
    grossRevenue: number
    netRevenue: number
    estimatedProfit: number
    cmvPct: number
    avgTicket: number
    totalOrders: number
    totalCmvCost: number
  }
  costs: {
    fixed: number; variable: number; prolabore: number
    tax: number; platform: number; discount: number; other: number
    totalCosts: number
  }
  results: {
    grossMargin: number; grossMarginPct: number
    netMargin: number; netMarginPct: number
  }
  byChannel: {
    channel: string; orders: number; revenue: number; avgTicket: number; sharePct: number
  }[]
  byCampaign: {
    campaign: string; orders: number; revenue: number
    cmvCost: number; contribution: number
  }[]
  byPayment: { method: string; orders: number; revenue: number }[]
  dailyRevenue: { date: string; revenue: number }[]
  topProducts: {
    productId: string; name: string; qty: number; revenue: number; cmvCost: number
  }[]
}

// ─── Cost config ──────────────────────────────────────────────────────────────

const COST_LABELS: Record<CostCategory, string> = {
  fixed: 'Fixos', variable: 'Variáveis', prolabore: 'Pró-labore',
  tax: 'Impostos', platform: 'Plataforma', discount: 'Descontos', other: 'Outros',
}

const COST_BAR_COLORS: Record<CostCategory, string> = {
  fixed: '#60a5fa', variable: '#facc15', prolabore: '#c084fc',
  tax: '#f87171', platform: '#fb923c', discount: '#f472b6', other: '#8A8A8A',
}

const COST_TEXT_COLORS: Record<CostCategory, string> = {
  fixed: 'text-blue-400', variable: 'text-yellow-400', prolabore: 'text-purple-400',
  tax: 'text-red-400', platform: 'text-orange-400', discount: 'text-pink-400', other: 'text-[#8A8A8A]',
}

const CATEGORIES: CostCategory[] = ['fixed', 'variable', 'prolabore', 'tax', 'platform', 'discount', 'other']

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX', credito: 'Crédito', debito: 'Débito',
  dinheiro: 'Dinheiro', vr: 'VR', va: 'VA', desconhecido: 'Outros',
}

const PAYMENT_COLORS: Record<string, string> = {
  pix: '#4ade80', credito: '#60a5fa', debito: '#818cf8',
  dinheiro: '#facc15', vr: '#fb923c', va: '#f472b6', desconhecido: '#555',
}

// Channel display config — label + accent color for the bar
const CHANNEL_CFG: Record<string, { label: string; color: string }> = {
  instagram:  { label: 'Instagram',  color: '#e1306c' },
  whatsapp:   { label: 'WhatsApp',   color: '#25d366' },
  google:     { label: 'Google',     color: '#4285f4' },
  facebook:   { label: 'Facebook',   color: '#1877f2' },
  tiktok:     { label: 'TikTok',     color: '#69c9d0' },
  email:      { label: 'E-mail',     color: '#a78bfa' },
  social:     { label: 'Social',     color: '#f472b6' },
  pago:       { label: 'Pago',       color: '#fb923c' },
  'salão':    { label: 'Salão / QR', color: '#C9A84C' },
  retirada:   { label: 'Retirada',   color: '#94a3b8' },
  delivery:   { label: 'Delivery',   color: '#f97316' },
  '(direto)': { label: 'Direto',     color: '#4a4a4a' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE AREA CHART — smooth bezier, gradient fill, comparison line, toggles
// ═══════════════════════════════════════════════════════════════════════════════

type ChartRange = 'today' | '7d' | '30d'

interface ChartPoint { label: string; value: number }

interface ChartData {
  range: ChartRange
  rangeLabel: string
  compareLabel: string
  current: ChartPoint[]
  compare: ChartPoint[]
  total: number
  compareTotal: number
}

/** Smooth bezier path through points (Catmull-Rom → cubic bezier) */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function RevenueAreaChart({ chartData, loading }: { chartData: ChartData | null; loading: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [showCompare, setShowCompare] = useState(true)

  if (loading || !chartData) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
      </div>
    )
  }

  const pts = chartData.current
  if (pts.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-[#333] text-xs">
        Sem dados para o período
      </div>
    )
  }

  const W = 340, H = 140, padL = 4, padR = 4, padTop = 20, padBot = 32
  const innerW = W - padL - padR
  const innerH = H - padTop - padBot

  const allVals = [
    ...pts.map((p) => p.value),
    ...(showCompare ? chartData.compare.map((p) => p.value) : []),
  ]
  const maxVal = Math.max(...allVals, 1)
  const minVal = 0  // always anchor to zero for area charts

  function px(i: number) { return padL + (i / (pts.length - 1)) * innerW }
  function py(v: number) { return padTop + (1 - (v - minVal) / (maxVal - minVal)) * innerH }

  const currentPts: [number, number][] = pts.map((p, i) => [px(i), py(p.value)])
  const comparePts: [number, number][] = chartData.compare.map((_, i) => [px(i), py(chartData.compare[i].value)])

  const linePath  = smoothPath(currentPts)
  const cmpPath   = smoothPath(comparePts)

  // Area fill: close below the line
  const areaPath = linePath
    + ` L${px(pts.length - 1).toFixed(1)},${(padTop + innerH).toFixed(1)}`
    + ` L${px(0).toFixed(1)},${(padTop + innerH).toFixed(1)} Z`

  // X-axis label positions: sparse for readability
  const labelIdxs = new Set<number>()
  labelIdxs.add(0)
  labelIdxs.add(pts.length - 1)
  if (pts.length >= 7) {
    const step = pts.length <= 10 ? 2 : pts.length <= 15 ? 3 : Math.floor(pts.length / 5)
    for (let i = step; i < pts.length - 1; i += step) labelIdxs.add(i)
  } else if (pts.length >= 4) {
    labelIdxs.add(Math.floor(pts.length / 2))
  }

  // Y-axis guide values
  const guides = [0.33, 0.67, 1.0].map((f) => Math.round(maxVal * f))

  const delta = chartData.compareTotal > 0
    ? ((chartData.total - chartData.compareTotal) / chartData.compareTotal) * 100
    : null

  function handlePointerMove(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = (clientX - rect.left) / rect.width * W
    const i = Math.round(((relX - padL) / innerW) * (pts.length - 1))
    setHoverIdx(Math.max(0, Math.min(pts.length - 1, i)))
  }

  return (
    <div>
      {/* Header row: total + delta + compare toggle */}
      <div className="flex items-end justify-between px-4 pb-3">
        <div>
          <p className="text-2xl font-black text-[#F5F0E8] leading-none tabular-nums">
            {brlCompact(chartData.total)}
          </p>
          {delta !== null && (
            <p className={`text-xs font-bold mt-0.5 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs {chartData.compareLabel.toLowerCase()}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCompare((v) => !v)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
            showCompare
              ? 'border-[#8A8A8A]/40 text-[#8A8A8A] bg-[#1a1a1a]'
              : 'border-[#2a2a2a] text-[#333] bg-transparent'
          }`}
        >
          vs {chartData.compareLabel}
        </button>
      </div>

      {/* SVG chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H, touchAction: 'none' }}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e.touches[0].clientX) }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="rac-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#C9A84C" stopOpacity="0.28" />
            <stop offset="70%"  stopColor="#C9A84C" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rac-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#C9A84C" stopOpacity="0.4" />
            <stop offset="40%"  stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Y-axis guide lines + labels */}
        {guides.map((v, gi) => {
          const gy = py(v)
          return (
            <g key={gi}>
              <line x1={padL} y1={gy.toFixed(1)} x2={W - padR} y2={gy.toFixed(1)}
                stroke="#181818" strokeWidth="1" />
              <text x={padL + 2} y={(gy - 3).toFixed(1)}
                fill="#2e2e2e" fontSize="8" fontFamily="Inter,system-ui,sans-serif">
                {brlCompact(v)}
              </text>
            </g>
          )
        })}

        {/* Comparison line */}
        {showCompare && chartData.compare.length >= 2 && (
          <path d={cmpPath} fill="none"
            stroke="#8A8A8A" strokeWidth="1.2" strokeDasharray="4 3"
            strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Area fill */}
        <path d={areaPath} fill="url(#rac-fill)" />

        {/* Main line */}
        <path d={linePath} fill="none"
          stroke="url(#rac-line)" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover crosshair */}
        {hoverIdx !== null && (
          <>
            <line
              x1={px(hoverIdx).toFixed(1)} y1={padTop}
              x2={px(hoverIdx).toFixed(1)} y2={padTop + innerH}
              stroke="#C9A84C" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.5"
            />
            {/* Compare dot */}
            {showCompare && chartData.compare[hoverIdx] !== undefined && (
              <circle
                cx={px(hoverIdx).toFixed(1)}
                cy={py(chartData.compare[hoverIdx].value).toFixed(1)}
                r="3" fill="#555" stroke="#0A0A0A" strokeWidth="1.5"
              />
            )}
            {/* Current dot */}
            <circle
              cx={px(hoverIdx).toFixed(1)}
              cy={py(pts[hoverIdx].value).toFixed(1)}
              r="4.5" fill="#C9A84C" stroke="#0A0A0A" strokeWidth="2"
            />
            {/* Tooltip */}
            {(() => {
              const tx = px(hoverIdx)
              const ty = py(pts[hoverIdx].value)
              const cmpVal = chartData.compare[hoverIdx]?.value
              const tipW = cmpVal !== undefined ? 96 : 80
              const tipH = cmpVal !== undefined ? 44 : 30
              const tipX = Math.min(Math.max(tx - tipW / 2, padL), W - padR - tipW)
              const tipY = ty - tipH - 10 < padTop ? ty + 12 : ty - tipH - 10
              return (
                <g>
                  <rect x={tipX} y={tipY} width={tipW} height={tipH}
                    rx="6" fill="#141414" stroke="#2a2a2a" strokeWidth="1" />
                  <text x={tipX + tipW / 2} y={tipY + 12}
                    textAnchor="middle" fill="#8A8A8A" fontSize="8.5"
                    fontFamily="Inter,system-ui,sans-serif" fontWeight="600">
                    {pts[hoverIdx].label}
                  </text>
                  <text x={tipX + tipW / 2} y={tipY + 26}
                    textAnchor="middle" fill="#F5F0E8" fontSize="11"
                    fontFamily="Inter,system-ui,sans-serif" fontWeight="900">
                    {brlCompact(pts[hoverIdx].value)}
                  </text>
                  {cmpVal !== undefined && (
                    <text x={tipX + tipW / 2} y={tipY + 38}
                      textAnchor="middle" fill="#555" fontSize="8.5"
                      fontFamily="Inter,system-ui,sans-serif">
                      ant: {brlCompact(cmpVal)}
                    </text>
                  )}
                </g>
              )
            })()}
          </>
        )}

        {/* X-axis labels */}
        {Array.from(labelIdxs).map((i) => (
          <text key={i} x={px(i).toFixed(1)} y={H - 8}
            textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
            fill="#383838" fontSize="9"
            fontFamily="Inter,system-ui,sans-serif">
            {pts[i].label}
          </text>
        ))}

        {/* Live dot on last point (when not hovering) */}
        {hoverIdx === null && (
          <circle
            cx={px(pts.length - 1).toFixed(1)}
            cy={py(pts[pts.length - 1].value).toFixed(1)}
            r="3.5" fill="#C9A84C" stroke="#0A0A0A" strokeWidth="1.5"
          />
        )}
      </svg>
    </div>
  )
}

// ─── Chart section with range toggles ─────────────────────────────────────────

const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: '7d',    label: '7 dias' },
  { id: '30d',   label: '30 dias' },
]

function ChartSection() {
  const [range, setRange]         = useState<ChartRange>('today')
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading]     = useState(true)

  const fetchChart = useCallback(async (r: ChartRange) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance-admin/chart?range=${r}`, { cache: 'no-store' })
      if (res.ok) setChartData(await res.json() as ChartData)
    } catch {
      // soft-fail: chart stays empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChart(range) }, [range, fetchChart])

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
      {/* Range toggle strip */}
      <div className="flex gap-1.5 px-4 pt-4 pb-3">
        {CHART_RANGES.map(({ id, label }) => (
          <button key={id} onClick={() => setRange(id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
              range === id
                ? 'bg-[#C9A84C] text-black shadow-md shadow-[#C9A84C]/20'
                : 'bg-[#161616] text-[#555] border border-[#1e1e1e]'
            }`}>
            {label}
          </button>
        ))}
        {chartData && (
          <span className="ml-auto text-[10px] text-[#333] self-center truncate">
            {chartData.rangeLabel}
          </span>
        )}
      </div>

      <RevenueAreaChart chartData={chartData} loading={loading} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI BAR CHART (horizontal, for products / channels)
// ═══════════════════════════════════════════════════════════════════════════════

function MiniBarChart({ items, color = '#C9A84C' }: {
  items: { label: string; value: number; sub?: string; badge?: string; badgeColor?: string }[]
  color?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="flex flex-col gap-0">
      {items.map(({ label, value, sub, badge, badgeColor }, i) => (
        <div key={label} className={`px-4 py-3 ${i > 0 ? 'border-t border-[#141414]' : ''}`}>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-[#E0D9CC] truncate">{label}</span>
              {badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ color: badgeColor ?? '#8A8A8A', backgroundColor: `${badgeColor ?? '#8A8A8A'}18`, border: `1px solid ${badgeColor ?? '#8A8A8A'}30` }}>
                  {badge}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[#F5F0E8]">{brl(value)}</span>
              {sub && <p className="text-[10px] text-[#555]">{sub}</p>}
            </div>
          </div>
          <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DONUT CHART (pure SVG)
// ═══════════════════════════════════════════════════════════════════════════════

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) return null

  const R = 52, r = 34, cx = 64, cy = 64
  let angle = -Math.PI / 2

  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * 2 * Math.PI
      const x1 = cx + R * Math.cos(angle)
      const y1 = cy + R * Math.sin(angle)
      angle += sweep
      const x2 = cx + R * Math.cos(angle)
      const y2 = cy + R * Math.sin(angle)
      const large = sweep > Math.PI ? 1 : 0

      const ix1 = cx + r * Math.cos(angle - sweep)
      const iy1 = cy + r * Math.sin(angle - sweep)
      const ix2 = cx + r * Math.cos(angle)
      const iy2 = cy + r * Math.sin(angle)

      return {
        d: `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${r},${r} 0 ${large},0 ${ix1.toFixed(2)},${iy1.toFixed(2)} Z`,
        color: s.color,
        pct: Math.round((s.value / total) * 100),
        label: s.label,
      }
    })

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 128 128" className="w-28 h-28 shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity="0.9" />
        ))}
        <circle cx={cx} cy={cy} r={r - 2} fill="#0d0d0d" />
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-xs text-[#8A8A8A] truncate">{p.label}</span>
            <span className="text-xs font-bold text-[#F5F0E8] ml-auto shrink-0">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOAL RING (circular progress)
// ═══════════════════════════════════════════════════════════════════════════════

function GoalRing({ pct: goalPct, label, value, target, met }: {
  pct: number; label: string; value: string; target: string; met: boolean
}) {
  const R = 28, circ = 2 * Math.PI * R
  const dash = Math.min(goalPct / 100, 1) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
          <circle cx="36" cy="36" r={R} fill="none" stroke="#1a1a1a" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={R} fill="none"
            stroke={met ? '#4ade80' : '#C9A84C'} strokeWidth="6"
            strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-black ${met ? 'text-green-400' : 'text-[#C9A84C]'}`}>
            {Math.round(goalPct)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-[#555] uppercase tracking-wide">{label}</p>
        <p className="text-sm font-black text-[#F5F0E8] leading-none mt-0.5">{value}</p>
        <p className="text-[10px] text-[#444] mt-0.5">meta {target}</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT CARD — expandable with actionable recommendations
// ═══════════════════════════════════════════════════════════════════════════════

interface Alert {
  type:    'danger' | 'warning' | 'info'
  title:   string
  detail:  string
  actions: string[]
}

function AlertCard({ type, title, detail, actions }: Alert) {
  const [open, setOpen] = useState(false)

  const cfg = {
    danger:  {
      bg: 'bg-red-950/50',   border: 'border-red-800/40',
      icon: '↑',             iconColor: 'text-red-400',
      titleColor: 'text-red-200',   detailColor: 'text-red-400/70',
      actBg: 'bg-red-950/60', actBorder: 'border-red-900/50',
      chevronColor: 'text-red-700',
    },
    warning: {
      bg: 'bg-amber-950/40', border: 'border-amber-800/40',
      icon: '!',             iconColor: 'text-amber-400',
      titleColor: 'text-amber-200', detailColor: 'text-amber-400/70',
      actBg: 'bg-amber-950/60', actBorder: 'border-amber-900/50',
      chevronColor: 'text-amber-700',
    },
    info:    {
      bg: 'bg-blue-950/40',  border: 'border-blue-800/40',
      icon: '↓',             iconColor: 'text-blue-400',
      titleColor: 'text-blue-200',  detailColor: 'text-blue-400/70',
      actBg: 'bg-blue-950/60', actBorder: 'border-blue-900/50',
      chevronColor: 'text-blue-700',
    },
  }[type]

  const hasActions = actions.length > 0

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-2xl overflow-hidden`}>
      {/* Header row — always visible, tappable */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:opacity-70"
        onClick={() => hasActions && setOpen((v) => !v)}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* Severity icon */}
        <span className={`${cfg.iconColor} text-xs font-black mt-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded-full border ${cfg.border}`}>
          {cfg.icon}
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${cfg.titleColor} leading-snug`}>{title}</p>
          <p className={`text-xs ${cfg.detailColor} mt-0.5`}>{detail}</p>
        </div>

        {/* Expand chevron */}
        {hasActions && (
          <span className={`${cfg.chevronColor} text-base shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            ›
          </span>
        )}
      </button>

      {/* Expanded: recommended actions */}
      {open && hasActions && (
        <div className={`border-t ${cfg.actBorder} px-4 pb-4 pt-3`}>
          <p className="text-[9px] font-bold text-[#444] uppercase tracking-widest mb-2.5">
            Ações recomendadas
          </p>
          <div className="flex flex-col gap-1.5">
            {actions.map((action, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${cfg.actBg} border ${cfg.actBorder} rounded-xl px-3 py-2.5`}>
                <span className={`${cfg.iconColor} text-[10px] font-black shrink-0 mt-0.5`}>→</span>
                <span className="text-xs text-[#C8C2B4] leading-snug">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIOD SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

function PeriodSelector({ period, onChange }: { period: string; onChange: (p: string) => void }) {
  function shift(months: number) {
    const [y, m] = period.split('-').map(Number)
    const d = new Date(y, m - 1 + months)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1a1a] text-[#8A8A8A] text-lg active:opacity-60 shrink-0">
        ‹
      </button>
      <span className="text-sm font-semibold text-[#F5F0E8] capitalize">
        {formatPeriod(period)}
      </span>
      <button onClick={() => shift(1)} disabled={period >= currentPeriod()}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1a1a] text-[#8A8A8A] text-lg active:opacity-60 disabled:opacity-20 shrink-0">
        ›
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════════

function Section({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-bold text-[#444] uppercase tracking-widest">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ data, goal }: { data: AdminData; goal: FinanceGoal }) {
  const { overview, results, topProducts, byChannel, byCampaign, byPayment } = data

  const revenueGoalPct = goal.revenueTarget && goal.revenueTarget > 0
    ? (overview.grossRevenue / goal.revenueTarget) * 100 : null
  const ticketGoalPct = goal.avgTicketTarget && goal.avgTicketTarget > 0
    ? (overview.avgTicket / goal.avgTicketTarget) * 100 : null

  const cmvAlert    = goal.maxCmvPct !== null && overview.cmvPct > goal.maxCmvPct
  const marginAlert = goal.minNetMargin !== null && results.netMarginPct < goal.minNetMargin
  const lowRevenue  = goal.revenueTarget && revenueGoalPct !== null && revenueGoalPct < 70
  const lowTicket   = goal.avgTicketTarget && ticketGoalPct !== null && ticketGoalPct < 80

  const alerts: Alert[] = [
    cmvAlert && {
      type:   'danger' as const,
      title:  'CMV acima da meta',
      detail: `Atual ${pct(overview.cmvPct)} · Meta ≤ ${pct(goal.maxCmvPct!)}`,
      actions: [
        'Reduza o foco em itens de alto custo de matéria-prima',
        'Destaque produtos com maior margem no cardápio',
        'Revise o controle de desperdício na cozinha',
        'Negocie melhores preços com fornecedores de insumos críticos',
      ],
    },
    marginAlert && {
      type:   'warning' as const,
      title:  'Margem líquida abaixo da meta',
      detail: `Atual ${pct(results.netMarginPct)} · Meta ≥ ${pct(goal.minNetMargin!)}`,
      actions: [
        'Revise custos fixos — identifique o que pode ser cortado',
        'Aumente o ticket médio via upsell de bebidas e combos premium',
        'Reduza descontos concedidos neste período',
        'Avalie se pró-labore está calibrado para o faturamento atual',
      ],
    },
    lowRevenue && {
      type:   'warning' as const,
      title:  'Receita abaixo do esperado',
      detail: `${pct(revenueGoalPct!)} da meta atingido`,
      actions: [
        'Dispare campanha WhatsApp para clientes inativos dos últimos 30 dias',
        'Publique um combo especial no Instagram com call-to-action direto',
        'Crie um cupom de desconto leve para reativar demanda',
        'Reforce upsell no atendimento presencial durante o pico',
      ],
    },
    lowTicket && {
      type:   'info' as const,
      title:  'Ticket médio abaixo da meta',
      detail: `Atual ${brl(overview.avgTicket)} · Meta ${brl(goal.avgTicketTarget!)}`,
      actions: [
        'Treine atendentes para sugerir bebida ou sobremesa em todo pedido',
        'Crie combos que agreguem valor acima do item individual',
        'Destaque itens premium no cardápio digital com foto e descrição',
        'Ofereça upgrade de tamanho com diferença de preço simbólica',
      ],
    },
  ].filter(Boolean) as Alert[]

  const paymentSlices = byPayment.slice(0, 5).map(({ method, revenue }) => ({
    label: PAYMENT_LABELS[method] ?? method,
    value: revenue,
    color: PAYMENT_COLORS[method] ?? '#555',
  }))

  return (
    <div className="flex flex-col gap-7">

      {/* Alerts */}
      {alerts.length > 0 && (
        <Section title={`${alerts.length} alerta${alerts.length > 1 ? 's' : ''}`}>
          <div className="flex flex-col gap-2">
            {alerts.map((a, i) => <AlertCard key={i} {...a} />)}
          </div>
        </Section>
      )}

      {/* Revenue chart — primary visual element */}
      <Section title="Receita">
        <ChartSection />
      </Section>

      {/* KPI grid */}
      <Section title="Resumo">
        <div className="grid grid-cols-2 gap-3">
          {/* Revenue — large card spanning full width */}
          <div className="col-span-2 bg-gradient-to-br from-[#1a1200] to-[#0d0d0d] border border-[#C9A84C]/25 rounded-2xl p-5">
            <p className="text-[10px] font-bold text-[#C9A84C]/70 uppercase tracking-widest mb-1">Receita bruta</p>
            <p className="text-4xl font-black tracking-tight text-[#F5F0E8] leading-none">
              {brl(overview.grossRevenue)}
            </p>
            {revenueGoalPct !== null && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#555]">Meta: {brl(goal.revenueTarget!)}</span>
                  <span className={revenueGoalPct >= 100 ? 'text-green-400' : 'text-[#C9A84C]'}>
                    {pct(revenueGoalPct)}
                  </span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${revenueGoalPct >= 100 ? 'bg-green-500' : 'bg-[#C9A84C]'}`}
                    style={{ width: `${Math.min(revenueGoalPct, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-4">
            <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">Pedidos</p>
            <p className="text-3xl font-black text-[#F5F0E8] leading-none">{overview.totalOrders}</p>
          </div>

          {/* Avg ticket */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-4">
            <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">Ticket médio</p>
            <p className="text-3xl font-black text-[#F5F0E8] leading-none">{brlCompact(overview.avgTicket)}</p>
            {ticketGoalPct !== null && (
              <div className="mt-2">
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ticketGoalPct >= 100 ? 'bg-green-500' : 'bg-[#C9A84C]'}`}
                    style={{ width: `${Math.min(ticketGoalPct, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* CMV */}
          <div className={`bg-[#111] border rounded-2xl p-4 ${cmvAlert ? 'border-red-800/50' : 'border-[#1e1e1e]'}`}>
            <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">CMV</p>
            <p className={`text-3xl font-black leading-none ${cmvAlert ? 'text-red-400' : 'text-[#F5F0E8]'}`}>
              {pct(overview.cmvPct)}
            </p>
            <p className="text-[10px] text-[#444] mt-1">{brl(overview.totalCmvCost)}</p>
          </div>

          {/* Profit */}
          <div className={`bg-[#111] border rounded-2xl p-4 ${
            overview.estimatedProfit < 0 ? 'border-red-800/50' : 'border-[#1e1e1e]'
          }`}>
            <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">Lucro estimado</p>
            <p className={`text-3xl font-black leading-none ${
              overview.estimatedProfit < 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {brlCompact(overview.estimatedProfit)}
            </p>
            <p className="text-[10px] text-[#444] mt-1">{pct(results.netMarginPct)} margem</p>
          </div>
        </div>
      </Section>

      {/* Goal rings (only when goals are configured) */}
      {(goal.revenueTarget || goal.avgTicketTarget) && (
        <Section title="Metas do mês">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl px-4 py-5">
            <div className="flex justify-around">
              {goal.revenueTarget && goal.revenueTarget > 0 && (
                <GoalRing
                  pct={(overview.grossRevenue / goal.revenueTarget) * 100}
                  label="Receita"
                  value={brlCompact(overview.grossRevenue)}
                  target={brlCompact(goal.revenueTarget)}
                  met={overview.grossRevenue >= goal.revenueTarget}
                />
              )}
              {goal.avgTicketTarget && goal.avgTicketTarget > 0 && (
                <GoalRing
                  pct={(overview.avgTicket / goal.avgTicketTarget) * 100}
                  label="Ticket médio"
                  value={brlCompact(overview.avgTicket)}
                  target={brlCompact(goal.avgTicketTarget)}
                  met={overview.avgTicket >= goal.avgTicketTarget}
                />
              )}
              {goal.minNetMargin && goal.minNetMargin > 0 && (
                <GoalRing
                  pct={(results.netMarginPct / goal.minNetMargin) * 100}
                  label="Margem"
                  value={pct(results.netMarginPct)}
                  target={pct(goal.minNetMargin)}
                  met={results.netMarginPct >= goal.minNetMargin}
                />
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <Section title="Top produtos">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
            <MiniBarChart
              items={topProducts.slice(0, 6).map((p, i) => ({
                label: p.name,
                value: p.revenue,
                sub: `${p.qty}× vendido`,
                badge: `#${i + 1}`,
                badgeColor: i === 0 ? '#C9A84C' : i === 1 ? '#8A8A8A' : i === 2 ? '#b87333' : undefined,
              }))}
            />
          </div>
        </Section>
      )}

      {/* Channels — macro view */}
      {byChannel.length > 0 && (
        <Section title="Canais">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
            {byChannel.slice(0, 8).map((ch, i) => {
              const cfg   = CHANNEL_CFG[ch.channel] ?? { label: ch.channel, color: '#4a4a4a' }
              const maxRev = byChannel[0].revenue || 1
              return (
                <div key={ch.channel} className={`px-4 py-3 ${i > 0 ? 'border-t border-[#141414]' : ''}`}>
                  {/* Row 1: channel name + revenue */}
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Color dot */}
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="text-sm font-semibold text-[#E0D9CC] truncate">{cfg.label}</span>
                    </div>
                    <span className="text-sm font-bold text-[#F5F0E8] shrink-0 tabular-nums">
                      {brl(ch.revenue)}
                    </span>
                  </div>
                  {/* Bar */}
                  <div className="h-1 bg-[#161616] rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(ch.revenue / maxRev) * 100}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                  {/* Row 2: stats */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#555]">{ch.orders} ped</span>
                    <span className="text-[10px] text-[#444]">·</span>
                    <span className="text-[10px] text-[#555]">ticket {brlCompact(ch.avgTicket)}</span>
                    <span className="text-[10px] text-[#444]">·</span>
                    <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                      {ch.sharePct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Campaigns — utm_campaign breakdown */}
      {byCampaign.length > 0 && (
        <Section title="Campanhas">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
            <MiniBarChart
              color="#818cf8"
              items={byCampaign.slice(0, 6).map((c) => {
                const share = overview.grossRevenue > 0
                  ? ((c.revenue / overview.grossRevenue) * 100).toFixed(1) : '0'
                return {
                  label: c.campaign,
                  value: c.revenue,
                  sub:   `${c.orders} ped · ${share}%`,
                }
              })}
            />
          </div>
        </Section>
      )}

      {/* Payment breakdown donut */}
      {paymentSlices.length > 0 && (
        <Section title="Formas de pagamento">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl px-4 py-5">
            <DonutChart slices={paymentSlices} />
          </div>
        </Section>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: RESULTS (DRE)
// ═══════════════════════════════════════════════════════════════════════════════

function ResultsTab({ data, goal }: { data: AdminData; goal: FinanceGoal }) {
  const { overview, costs, results } = data

  const breakdown = [
    { label: 'Receita bruta',               value: overview.grossRevenue,   kind: 'positive' as const },
    { label: '− Descontos concedidos',       value: -costs.discount,         kind: 'negative' as const },
    { label: '= Receita líquida',            value: overview.netRevenue,     kind: 'subtotal' as const },
    { label: '− CMV (custo de mercadoria)',  value: -overview.totalCmvCost,  kind: 'negative' as const },
    { label: '= Margem bruta',               value: results.grossMargin,     kind: 'subtotal' as const, pctVal: results.grossMarginPct },
    { label: '− Custos fixos',               value: -costs.fixed,            kind: 'negative' as const },
    { label: '− Custos variáveis',           value: -costs.variable,         kind: 'negative' as const },
    { label: '− Pró-labore',                 value: -costs.prolabore,        kind: 'negative' as const },
    { label: '− Impostos / taxas',           value: -costs.tax,              kind: 'negative' as const },
    { label: '− Taxas de plataforma',        value: -costs.platform,         kind: 'negative' as const },
    { label: '− Outros',                     value: -costs.other,            kind: 'negative' as const },
    { label: '= Lucro estimado',             value: results.netMargin,       kind: 'total' as const, pctVal: results.netMarginPct },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Section title={`DRE — ${formatPeriod(data.period)}`}>
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          {breakdown.map(({ label, value, kind, pctVal }, i) => {
            if (value === 0 && kind === 'negative') return null
            const isTotal    = kind === 'total'
            const isSubtotal = kind === 'subtotal'
            const valueColor = isTotal
              ? value < 0 ? 'text-red-400' : 'text-green-400'
              : isSubtotal ? 'text-[#F5F0E8]'
              : kind === 'positive' ? 'text-[#F5F0E8]'
              : value === 0 ? 'text-[#555]' : 'text-red-400'

            return (
              <div key={label} className={`flex justify-between items-center px-4 py-3 ${
                i > 0 ? 'border-t border-[#131313]' : ''
              } ${isTotal ? 'bg-[#111]' : ''}`}>
                <span className={`text-sm ${
                  isTotal || isSubtotal ? 'font-bold text-[#E0D9CC]' : 'text-[#666]'
                }`}>{label}</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${valueColor}`}>
                    {value < 0 ? '−\u00a0' : ''}{brl(Math.abs(value))}
                  </span>
                  {pctVal !== undefined && (
                    <p className="text-[10px] text-[#555]">{pct(pctVal)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Indicadores vs metas">
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Margem bruta',
              value: pct(results.grossMarginPct),
              sub: brl(results.grossMargin),
              ok: results.grossMargin >= 0,
            },
            {
              label: 'Margem líquida',
              value: pct(results.netMarginPct),
              sub: goal.minNetMargin !== null ? `meta ≥ ${pct(goal.minNetMargin)}` : brl(results.netMargin),
              ok: goal.minNetMargin === null || results.netMarginPct >= goal.minNetMargin,
            },
            {
              label: 'CMV',
              value: pct(overview.cmvPct),
              sub: goal.maxCmvPct !== null ? `meta ≤ ${pct(goal.maxCmvPct)}` : brl(overview.totalCmvCost),
              ok: goal.maxCmvPct === null || overview.cmvPct <= goal.maxCmvPct,
            },
            {
              label: 'Custos / receita',
              value: overview.netRevenue > 0 ? pct((data.costs.totalCosts / overview.netRevenue) * 100) : '—',
              sub: brl(data.costs.totalCosts),
              ok: true,
            },
          ].map(({ label, value, sub, ok }) => (
            <div key={label} className={`bg-[#111] border rounded-2xl p-4 ${ok ? 'border-[#1e1e1e]' : 'border-red-800/50'}`}>
              <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-2xl font-black leading-none ${!ok ? 'text-red-400' : 'text-[#F5F0E8]'}`}>{value}</p>
              <p className="text-[10px] text-[#444] mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: COSTS
// ═══════════════════════════════════════════════════════════════════════════════

function CostsTab({ data, period, onRefresh }: { data: AdminData; period: string; onRefresh: () => void }) {
  const [costs, setCosts]           = useState<OwnerCost[]>([])
  const [loadingCosts, setLoading]  = useState(true)
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [fLabel, setFLabel]         = useState('')
  const [fCategory, setFCategory]   = useState<CostCategory>('fixed')
  const [fAmount, setFAmount]       = useState('')
  const [showForm, setShowForm]     = useState(false)

  const fetchCosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance-admin/costs?period=${period}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { costs: OwnerCost[] }
      setCosts(json.costs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar custos')
    } finally { setLoading(false) }
  }, [period])

  useEffect(() => { fetchCosts() }, [fetchCosts])

  async function handleAdd() {
    const amount = parseBrl(fAmount)
    if (!fLabel.trim()) { setError('Descrição obrigatória'); return }
    if (amount === null) { setError('Valor inválido'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/finance-admin/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: fLabel.trim(), category: fCategory, amount, period }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setFLabel(''); setFAmount(''); setFCategory('fixed'); setShowForm(false)
      await fetchCosts(); onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function handleDelete(id: string) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/finance-admin/costs?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchCosts(); onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const { costs: ct } = data
  const maxCost = Math.max(...CATEGORIES.map((c) => ct[c]), 1)

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-2xl px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <Section title="Por categoria">
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          {CATEGORIES.filter((c) => ct[c] > 0).length === 0 ? (
            <p className="text-sm text-[#333] text-center py-8">Nenhum custo lançado</p>
          ) : (
            <>
              {CATEGORIES.map((cat, i) => {
                if (ct[cat] === 0) return null
                return (
                  <div key={cat} className={`px-4 py-3 ${i > 0 ? 'border-t border-[#131313]' : ''}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-xs font-semibold ${COST_TEXT_COLORS[cat]}`}>{COST_LABELS[cat]}</span>
                      <span className="text-sm font-bold text-[#F5F0E8]">{brl(ct[cat])}</span>
                    </div>
                    <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(ct[cat] / maxCost) * 100}%`, backgroundColor: COST_BAR_COLORS[cat] }} />
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-between items-center px-4 py-3 border-t border-[#222] bg-[#111]">
                <span className="text-xs font-bold text-[#8A8A8A]">Total</span>
                <span className="text-base font-black text-[#C9A84C]">{brl(ct.totalCosts)}</span>
              </div>
            </>
          )}
        </div>
      </Section>

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full py-4 rounded-2xl text-sm font-bold bg-[#111] border border-[#C9A84C]/40 text-[#C9A84C] active:opacity-60">
          + Lançar custo
        </button>
      ) : (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-sm font-bold text-[#F5F0E8]">Novo custo — {periodShort(period)}</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#555] uppercase tracking-wide">Categoria</label>
            <select value={fCategory} onChange={(e) => setFCategory(e.target.value as CostCategory)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-[#F5F0E8] focus:outline-none focus:border-[#C9A84C]">
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{COST_LABELS[cat]}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#555] uppercase tracking-wide">Descrição</label>
            <input type="text" placeholder="Ex: Aluguel, Gás…" value={fLabel} onChange={(e) => setFLabel(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#333] focus:outline-none focus:border-[#C9A84C]" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#555] uppercase tracking-wide">Valor (R$)</label>
            <input type="text" inputMode="decimal" placeholder="0,00" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-2xl font-black text-[#F5F0E8] placeholder:text-[#333] focus:outline-none focus:border-[#C9A84C]" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(null) }}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-[#8A8A8A] active:opacity-60">
              Cancelar
            </button>
            <button onClick={handleAdd} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#C9A84C] text-black disabled:opacity-40 active:opacity-70">
              {busy ? 'Salvando…' : 'Lançar'}
            </button>
          </div>
        </div>
      )}

      {!loadingCosts && costs.length > 0 && (
        <Section title="Lançamentos">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
            {costs.map((c, i) => (
              <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#131313]' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#E0D9CC] truncate">{c.label}</p>
                  <p className={`text-xs ${COST_TEXT_COLORS[c.category]}`}>{COST_LABELS[c.category]}</p>
                </div>
                <span className="text-sm font-bold text-[#F5F0E8] shrink-0">{brl(c.amount)}</span>
                <button onClick={() => handleDelete(c.id)} disabled={busy}
                  className="w-7 h-7 flex items-center justify-center text-xs text-red-500 border border-red-900/60 rounded-lg active:opacity-60 disabled:opacity-40 shrink-0">
                  ×
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GOALS
// ═══════════════════════════════════════════════════════════════════════════════

function GoalsTab({ period, goal, onSaved }: { period: string; goal: FinanceGoal; onSaved: (g: FinanceGoal) => void }) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [fRevenue,   setFRevenue]   = useState(goal.revenueTarget   != null ? (goal.revenueTarget / 100).toFixed(2).replace('.', ',')   : '')
  const [fCmv,       setFCmv]       = useState(goal.maxCmvPct       != null ? String(goal.maxCmvPct)       : '')
  const [fMargin,    setFMargin]    = useState(goal.minNetMargin     != null ? String(goal.minNetMargin)    : '')
  const [fAvgTicket, setFAvgTicket] = useState(goal.avgTicketTarget  != null ? (goal.avgTicketTarget / 100).toFixed(2).replace('.', ',') : '')

  async function handleSave() {
    setBusy(true); setError(null); setSaved(false)
    try {
      const revenueTarget   = fRevenue.trim()   ? parseBrl(fRevenue)                          : null
      const maxCmvPct       = fCmv.trim()       ? parseFloat(fCmv.replace(',', '.'))          : null
      const minNetMargin    = fMargin.trim()     ? parseFloat(fMargin.replace(',', '.'))       : null
      const avgTicketTarget = fAvgTicket.trim()  ? parseBrl(fAvgTicket)                       : null

      const res = await fetch(`/api/finance-admin/goals?period=${period}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revenueTarget, maxCmvPct, minNetMargin, avgTicketTarget }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      onSaved(json.goal as FinanceGoal)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-[#444] px-1">
        Defina as metas mensais. Os alertas e indicadores visuais serão calculados automaticamente.
      </p>

      {error && <div className="bg-red-900/40 border border-red-700/50 rounded-2xl px-4 py-3 text-sm text-red-200">{error}</div>}
      {saved && <div className="bg-green-900/30 border border-green-800/40 rounded-2xl px-4 py-3 text-sm text-green-300">Metas salvas.</div>}

      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        {[
          { key: 'revenue',   label: 'Meta de receita bruta',     placeholder: '0,00', unit: 'R$',   value: fRevenue,   onChange: setFRevenue,   hint: 'Receita bruta no mês' },
          { key: 'cmv',       label: 'CMV máximo',                placeholder: '35',   unit: '%',    value: fCmv,       onChange: setFCmv,       hint: 'Alerta quando CMV superar este %' },
          { key: 'margin',    label: 'Margem líquida mínima',     placeholder: '15',   unit: '%',    value: fMargin,    onChange: setFMargin,    hint: 'Alerta quando margem ficar abaixo' },
          { key: 'ticket',    label: 'Ticket médio alvo',         placeholder: '0,00', unit: 'R$',   value: fAvgTicket, onChange: setFAvgTicket, hint: 'Ticket médio por pedido' },
        ].map(({ key, label, placeholder, unit, value, onChange, hint }, i) => (
          <div key={key} className={`px-4 py-4 ${i > 0 ? 'border-t border-[#131313]' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#8A8A8A]">{label}</label>
              <span className="text-[10px] text-[#444] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{unit}</span>
            </div>
            <input
              type="text" inputMode="decimal"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-[#161616] border border-[#222] rounded-xl px-4 py-3 text-xl font-black text-[#F5F0E8] placeholder:text-[#2a2a2a] focus:outline-none focus:border-[#C9A84C]"
            />
            <p className="text-[10px] text-[#333] mt-1.5">{hint}</p>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={busy}
        className="w-full py-4 rounded-2xl text-sm font-bold bg-[#C9A84C] text-black disabled:opacity-40 active:opacity-70">
        {busy ? 'Salvando…' : `Salvar metas de ${periodShort(period)}`}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type Tab = 'overview' | 'results' | 'costs' | 'goals'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Dashboard' },
  { id: 'results',      label: 'DRE' },
  { id: 'costs',  label: 'Custos' },
  { id: 'goals',  label: 'Metas' },
]

export default function FinanceAdminPage() {
  const [tab, setTab]         = useState<Tab>('overview')
  const [period, setPeriod]   = useState<string>(currentPeriod())
  const [data, setData]       = useState<AdminData | null>(null)
  const [goal, setGoal]       = useState<FinanceGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async (p: string) => {
    setLoading(true); setError(null)
    try {
      const [dataRes, goalRes] = await Promise.all([
        fetch(`/api/finance-admin?period=${p}`, { cache: 'no-store' }),
        fetch(`/api/finance-admin/goals?period=${p}`, { cache: 'no-store' }),
      ])
      if (!dataRes.ok) {
        const body = await dataRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${dataRes.status}`)
      }
      const [adminJson, goalJson] = await Promise.all([
        dataRes.json() as Promise<AdminData>,
        goalRes.json() as Promise<{ goal: FinanceGoal }>,
      ])
      setData(adminJson)
      setGoal(goalJson.goal)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8] font-[Inter,system-ui,sans-serif]">

      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-[#141414]">

        {/* Top bar: title + period + refresh */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest leading-none mb-0.5">
              Financeiro
            </p>
            <PeriodSelector period={period} onChange={setPeriod} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data && (
              <div className="text-right">
                <p className="text-xs text-[#555]">Receita</p>
                <p className="text-sm font-black text-[#C9A84C] leading-none">
                  {brlCompact(data.overview.grossRevenue)}
                </p>
              </div>
            )}
            <button onClick={() => fetchData(period)} disabled={loading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#111] border border-[#1e1e1e] text-[#C9A84C] text-base active:opacity-60 disabled:opacity-30">
              {loading ? '·' : '↻'}
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex overflow-x-auto no-scrollbar px-4 pb-3 gap-2">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === id
                  ? 'bg-[#C9A84C] text-black shadow-lg shadow-[#C9A84C]/20'
                  : 'bg-[#111] text-[#8A8A8A] border border-[#1e1e1e]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pb-12 pt-5">
        {error && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-2xl px-4 py-3 text-sm text-red-200 mb-5">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
            <p className="text-xs text-[#444]">Carregando dados…</p>
          </div>
        )}

        {data && goal && (
          <>
            {tab === 'overview' && <OverviewTab  data={data} goal={goal} />}
            {tab === 'results'  && <ResultsTab   data={data} goal={goal} />}
            {tab === 'costs'    && <CostsTab     data={data} period={period} onRefresh={() => fetchData(period)} />}
            {tab === 'goals'    && <GoalsTab     period={period} goal={goal} onSaved={(g) => setGoal(g)} />}
          </>
        )}
      </main>
    </div>
  )
}
