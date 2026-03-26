'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AutomationFlow   = 'at_risk' | 'new_customer' | 'vip' | 'low_sales'
type AutomationStatus = 'pending' | 'sent' | 'skipped' | 'failed'

interface AutomationEntry {
  id:            string
  flow:          AutomationFlow
  customerPhone: string | null
  customerName:  string | null
  messageText:   string
  status:        AutomationStatus
  skipReason:    string | null
  triggerData:   Record<string, unknown>
  triggeredAt:   string
  sentAt:        string | null
  attemptCount?: number
  lastError?:    string | null
  recoveredAt?:              string | null
  recoveredRevenueCentavos?: number | null
}

interface AutomationLog {
  entries: AutomationEntry[]
  total:   number
}

interface RunResult {
  total: { triggered: number; skipped: number; errors: number }
}

interface SendingSettings {
  is_enabled:    boolean
  batch_limit:   number
  daily_cap:     number
  lunch_window:  string
  dinner_window: string
  timezone:      string
}

interface Metrics {
  pending:                      number
  sent_today:                   number
  failed_today:                 number
  send_rate_today:              number
  potential_revenue_pending:    number
  potential_revenue_sent_today: number
  recovered_today:              number
  recovered_revenue_today:      number
  recovery_rate:                number
}

// ─── Config ────────────────────────────────────────────────────────────────────

const FLOW_CFG: Record<AutomationFlow, { label: string; color: string; emoji: string }> = {
  at_risk:      { label: 'Em risco',      color: '#f87171', emoji: '⚠️' },
  new_customer: { label: 'Novo cliente',  color: '#4ade80', emoji: '🎉' },
  vip:          { label: 'VIP',           color: '#C9A84C', emoji: '⭐' },
  low_sales:    { label: 'Vendas baixas', color: '#60a5fa', emoji: '📢' },
}

const STATUS_CFG: Record<AutomationStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: '#facc15' },
  sent:    { label: 'Enviado',  color: '#4ade80' },
  skipped: { label: 'Ignorado', color: '#555'    },
  failed:  { label: 'Falhou',   color: '#f87171' },
}

const CRM_TABS = [
  { id: 'clientes',   label: 'Clientes',   href: '/manager' },
  { id: 'kanban',     label: 'Kanban',     href: '/crm-kanban' },
  { id: 'campanhas',  label: 'Campanhas',  href: '/campaigns' },
  { id: 'automacoes', label: 'Automações', href: '/crm-automacoes' },
]

function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

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
    padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  } as React.CSSProperties,

  tabBar: {
    display: 'flex', gap: 4, marginBottom: 0,
    borderBottom: '1px solid #1e1e1e', paddingBottom: 0,
    paddingLeft: 24,
    backgroundColor: '#111',
  } as React.CSSProperties,

  body: {
    padding: '16px 24px',
    maxWidth: 900,
    margin: '0 auto',
  } as React.CSSProperties,

  card: {
    backgroundColor: '#111', border: '1px solid #1e1e1e',
    borderRadius: 10, padding: 14, marginBottom: 8,
  } as React.CSSProperties,

  secTitle: {
    fontSize: 10, color: '#444',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    marginBottom: 6, fontWeight: 600,
  } as React.CSSProperties,

  btn: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 7, color: '#ccc', fontSize: 12,
    padding: '5px 12px', cursor: 'pointer',
  } as React.CSSProperties,

  btnPrimary: {
    backgroundColor: '#C9A84C', border: 'none',
    borderRadius: 7, color: '#0A0A0A', fontWeight: 700,
    fontSize: 12, padding: '6px 14px', cursor: 'pointer',
  } as React.CSSProperties,

  btnDanger: {
    backgroundColor: 'transparent', border: '1px solid #3a1a1a',
    borderRadius: 7, color: '#f87171', fontSize: 12,
    padding: '5px 12px', cursor: 'pointer',
  } as React.CSSProperties,

  select: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 7, color: '#F5F0E8', fontSize: 12,
    padding: '5px 10px', cursor: 'pointer', outline: 'none',
  } as React.CSSProperties,
}

// ─── Sending Rules Panel ───────────────────────────────────────────────────────

const TZ_OPTIONS = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza',
  'America/Belem', 'America/Recife', 'America/Bahia', 'UTC',
]

function SendingRulesPanel() {
  const [open, setOpen]       = useState(false)
  const [form, setForm]       = useState<SendingSettings | null>(null)
  const [saving, setSaving]   = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showFb(ok: boolean, msg: string) {
    if (fbTimer.current) clearTimeout(fbTimer.current)
    setFeedback({ ok, msg })
    fbTimer.current = setTimeout(() => setFeedback(null), 4000)
  }

  useEffect(() => {
    if (!open || form !== null) return
    fetch('/api/crm/automations/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: SendingSettings) => setForm({
        is_enabled:    d.is_enabled,
        batch_limit:   d.batch_limit,
        daily_cap:     d.daily_cap,
        lunch_window:  d.lunch_window,
        dinner_window: d.dinner_window,
        timezone:      d.timezone,
      }))
      .catch(() => showFb(false, 'Erro ao carregar configurações'))
  }, [open, form])

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const res  = await fetch('/api/crm/automations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json() as { error?: string }
      if (json.error) showFb(false, json.error)
      else showFb(true, 'Configurações salvas')
    } catch {
      showFb(false, 'Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  function field(label: string, node: React.ReactNode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </label>
        {node}
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: '#111', border: '1px solid #1e1e1e',
      borderRadius: 10, marginBottom: 16, overflow: 'hidden',
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        <span style={{ fontSize: 11, color: '#555' }}>⚙</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Regras de envio</span>
        {form && (
          <span style={{
            fontSize: 10, padding: '1px 8px', borderRadius: 100,
            color: form.is_enabled ? '#4ade80' : '#f87171',
            backgroundColor: form.is_enabled ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            marginLeft: 4,
          }}>
            {form.is_enabled ? 'ativo' : 'desativado'}
          </span>
        )}
        <span style={{
          marginLeft: 'auto', color: '#333', fontSize: 10,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          borderTop: '1px solid #1a1a1a',
          padding: '14px 14px 12px',
        }}>
          {!form ? (
            <div style={{ fontSize: 12, color: '#444', textAlign: 'center', padding: '12px 0' }}>Carregando…</div>
          ) : (
            <>
              {/* Row 1: enable toggle + timezone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {field('Status', (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => setForm((f) => f ? { ...f, is_enabled: !f.is_enabled } : f)}
                      style={{
                        width: 36, height: 20, borderRadius: 10,
                        border: 'none', cursor: 'pointer',
                        backgroundColor: form.is_enabled ? '#4ade80' : '#2a2a2a',
                        position: 'relative', transition: 'background 0.15s',
                      }}>
                      <span style={{
                        position: 'absolute', top: 2,
                        left: form.is_enabled ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%',
                        backgroundColor: '#fff', transition: 'left 0.15s',
                      }} />
                    </button>
                    <span style={{ fontSize: 12, color: form.is_enabled ? '#4ade80' : '#555' }}>
                      {form.is_enabled ? 'Envios ativos' : 'Envios pausados'}
                    </span>
                  </div>
                ))}
                {field('Fuso horário', (
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm((f) => f ? { ...f, timezone: e.target.value } : f)}
                    style={{ ...S.select, fontSize: 12 }}>
                    {TZ_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                ))}
              </div>

              {/* Row 2: batch + daily cap */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {field('Envios por execução', (
                  <input
                    type="number" min={1} max={50}
                    value={form.batch_limit}
                    onChange={(e) => setForm((f) => f ? { ...f, batch_limit: parseInt(e.target.value, 10) || 1 } : f)}
                    style={{ ...S.select, fontSize: 12, width: '100%', boxSizing: 'border-box' as const }}
                  />
                ))}
                {field('Limite diário', (
                  <input
                    type="number" min={1} max={500}
                    value={form.daily_cap}
                    onChange={(e) => setForm((f) => f ? { ...f, daily_cap: parseInt(e.target.value, 10) || 1 } : f)}
                    style={{ ...S.select, fontSize: 12, width: '100%', boxSizing: 'border-box' as const }}
                  />
                ))}
              </div>

              {/* Row 3: windows */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {field('Janela almoço (HH:MM-HH:MM)', (
                  <input
                    type="text" placeholder="11:00-14:00"
                    value={form.lunch_window}
                    onChange={(e) => setForm((f) => f ? { ...f, lunch_window: e.target.value } : f)}
                    style={{ ...S.select, fontSize: 12, width: '100%', boxSizing: 'border-box' as const }}
                  />
                ))}
                {field('Janela jantar (HH:MM-HH:MM)', (
                  <input
                    type="text" placeholder="18:00-22:00"
                    value={form.dinner_window}
                    onChange={(e) => setForm((f) => f ? { ...f, dinner_window: e.target.value } : f)}
                    style={{ ...S.select, fontSize: 12, width: '100%', boxSizing: 'border-box' as const }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                {feedback && (
                  <span style={{ fontSize: 11, color: feedback.ok ? '#4ade80' : '#f87171' }}>
                    {feedback.ok ? '✓' : '✕'} {feedback.msg}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CRM Tab bar ───────────────────────────────────────────────────────────────

function CrmTabBar() {
  return (
    <div style={S.tabBar}>
      {CRM_TABS.map(({ id, label, href }) => {
        const isActive = id === 'automacoes'
        return (
          <a key={id} href={href} style={{
            textDecoration: 'none',
            fontSize: 13, fontWeight: isActive ? 600 : 400,
            color: isActive ? '#F5F0E8' : '#555',
            padding: '10px 4px',
            borderBottom: `2px solid ${isActive ? '#C9A84C' : 'transparent'}`,
            transition: 'color 0.12s',
            display: 'inline-block',
            marginRight: 20,
          }}>
            {label}
          </a>
        )
      })}
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, color = '#444', accent, right }: {
  title:  string
  count:  number
  color?: string
  accent?: string
  right?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 8, marginTop: 2,
    }}>
      <div style={{
        width: 3, height: 16, borderRadius: 2,
        backgroundColor: accent ?? '#2a2a2a', flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F0E8', letterSpacing: '-0.01em' }}>
        {title}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color, backgroundColor: `${color}18`,
        padding: '1px 7px', borderRadius: 100,
      }}>
        {count}
      </span>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  )
}

// ─── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  expandedId,
  setExpandedId,
  sendingId,
  sendErrors,
  onSend,
  formatTs,
}: {
  entry:         AutomationEntry
  expandedId:    string | null
  setExpandedId: (id: string | null) => void
  sendingId:     string | null
  sendErrors:    Record<string, string>
  onSend:        (id: string) => void
  formatTs:      (ts: string | null | undefined) => string
}) {
  const flow   = FLOW_CFG[entry.flow]   ?? { label: entry.flow ?? 'Desconhecido', color: '#555', emoji: '?' }
  const status = STATUS_CFG[entry.status] ?? { label: entry.status ?? 'Desconhecido', color: '#555' }
  const open   = expandedId === entry.id

  return (
    <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>

      {/* Row header */}
      <button
        onClick={() => setExpandedId(open ? null : entry.id)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '9px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{flow.emoji}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: flow.color }}>{flow.label}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: '1px 7px', borderRadius: 100,
              color: status.color, backgroundColor: `${status.color}18`,
            }}>
              {status.label}
            </span>
            {entry.recoveredAt && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                padding: '1px 7px', borderRadius: 100,
                color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.12)',
              }}>
                💰 Recuperado
              </span>
            )}
            {(entry.attemptCount ?? 0) > 0 && (
              <span style={{ fontSize: 10, color: '#444' }}>
                #{entry.attemptCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 1 }}>
            {entry.customerName && (
              <span style={{ fontSize: 12, color: '#F5F0E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {entry.customerName}
              </span>
            )}
            {entry.customerPhone && (
              <span style={{ fontSize: 11, color: '#444' }}>{entry.customerPhone}</span>
            )}
            <span style={{ fontSize: 10, color: '#333' }}>{formatTs(entry.triggeredAt)}</span>
          </div>
        </div>

        {entry.recoveredRevenueCentavos != null && (
          <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 6 }}>
            <div style={{ fontSize: 9, color: '#5a4f7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recuperado</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa', lineHeight: 1.2 }}>
              {fmtBRL(entry.recoveredRevenueCentavos)}
            </div>
          </div>
        )}

        <span style={{
          color: '#333', fontSize: 10, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }}>▼</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{
          borderTop: '1px solid #1a1a1a',
          padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <div style={S.secTitle}>Mensagem</div>
            <div style={{
              fontSize: 12, color: '#F5F0E8', lineHeight: 1.5,
              backgroundColor: '#0d0d0d', borderRadius: 7, padding: '8px 12px',
            }}>
              {entry.messageText}
            </div>
          </div>

          {entry.status === 'pending' && entry.customerPhone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => onSend(entry.id)}
                disabled={sendingId === entry.id}
                style={{
                  ...S.btnPrimary,
                  opacity: sendingId === entry.id ? 0.5 : 1,
                  cursor:  sendingId === entry.id ? 'not-allowed' : 'pointer',
                }}>
                {sendingId === entry.id ? 'Enviando…' : '📤 Enviar agora'}
              </button>
              {sendErrors[entry.id] && (
                <span style={{ fontSize: 11, color: '#f87171' }}>{sendErrors[entry.id]}</span>
              )}
            </div>
          )}

          <div>
            <div style={S.secTitle}>Dados do gatilho</div>
            <pre style={{
              fontSize: 10, color: '#8A8A8A', lineHeight: 1.5,
              backgroundColor: '#0d0d0d', borderRadius: 7, padding: '8px 12px',
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0,
            }}>
              {JSON.stringify(entry.triggerData, null, 2)}
            </pre>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {entry.sentAt && (
              <div>
                <div style={S.secTitle}>Enviado em</div>
                <div style={{ fontSize: 11, color: '#8A8A8A' }}>{formatTs(entry.sentAt)}</div>
              </div>
            )}
            {entry.recoveredAt && (
              <div>
                <div style={S.secTitle}>Recuperado em</div>
                <div style={{ fontSize: 11, color: '#a78bfa' }}>{formatTs(entry.recoveredAt)}</div>
              </div>
            )}
            {entry.recoveredRevenueCentavos != null && (
              <div>
                <div style={S.secTitle}>Receita recuperada</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
                  {fmtBRL(entry.recoveredRevenueCentavos)}
                </div>
              </div>
            )}
          </div>

          {entry.skipReason && (
            <div style={{ fontSize: 11, color: '#f87171' }}>
              Motivo do skip: {entry.skipReason}
            </div>
          )}
          {entry.lastError && (
            <div style={{ fontSize: 11, color: '#f87171' }}>
              Último erro: {entry.lastError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmBar({ message, onConfirm, onCancel }: {
  message:   string
  onConfirm: () => void
  onCancel:  () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '7px 12px',
      backgroundColor: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
      borderRadius: 8, marginTop: 6,
    }}>
      <span style={{ fontSize: 12, color: '#f87171', flex: 1 }}>{message}</span>
      <button onClick={onCancel} style={{ ...S.btn, fontSize: 11 }}>Cancelar</button>
      <button onClick={onConfirm} style={{ ...S.btnDanger, fontSize: 11 }}>Confirmar</button>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CrmAutomacoesPage() {
  const [entries, setEntries]           = useState<AutomationEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [running, setRunning]           = useState(false)
  const [runResult, setRunResult]       = useState<RunResult | null>(null)
  const [runError, setRunError]         = useState<string | null>(null)
  const [filterFlow, setFilterFlow]     = useState<AutomationFlow | ''>('')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [sendingId, setSendingId]       = useState<string | null>(null)
  const [sendErrors, setSendErrors]     = useState<Record<string, string>>({})
  const [metrics, setMetrics]           = useState<Metrics | null>(null)
  const [bulkLoading, setBulkLoading]   = useState<'send_pending' | 'reprocess_failed' | 'cancel_pending' | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState<{ action: string; msg: string; ok: boolean } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Clear bulk feedback after 4s
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showFeedback(action: string, msg: string, ok: boolean) {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setBulkFeedback({ action, msg, ok })
    feedbackTimer.current = setTimeout(() => setBulkFeedback(null), 4000)
  }

  const fetchLog = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (filterFlow) params.set('flow', filterFlow)
    try {
      const res  = await fetch(`/api/crm/automations?${params}`, { cache: 'no-store' })
      const json = await res.json() as AutomationLog
      setEntries(json.entries ?? [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [filterFlow])

  const fetchMetrics = useCallback(async () => {
    try {
      const res  = await fetch('/api/crm/automations/metrics', { cache: 'no-store' })
      const json = await res.json() as Metrics
      setMetrics(json)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    fetchLog()
    fetchMetrics()
  }, [fetchLog, fetchMetrics])

  // ── Section derivation — single source of truth ─────────────────────────────

  const oportunidades = entries
    .filter((e) => e.status === 'pending' && (!filterFlow || e.flow === filterFlow))
    .sort((a, b) => {
      const scoreA = (a.triggerData?.priorityScore as number) ?? 0
      const scoreB = (b.triggerData?.priorityScore as number) ?? 0
      return scoreB - scoreA
    })

  const execucao = entries
    .filter((e) =>
      (e.status === 'sent' || e.status === 'failed' || (e.status as string) === 'processing') &&
      (!filterFlow || e.flow === filterFlow)
    )
    .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())

  const recuperados = entries
    .filter((e) => e.recoveredAt != null && (!filterFlow || e.flow === filterFlow))
    .sort((a, b) => (b.recoveredRevenueCentavos ?? 0) - (a.recoveredRevenueCentavos ?? 0))

  const failedVisible = execucao.filter((e) => e.status === 'failed')

  // ── Mutations on local state ─────────────────────────────────────────────────

  function markEntriesSent(ids: Set<string>) {
    const now = new Date().toISOString()
    setEntries((prev) =>
      prev.map((e) => ids.has(e.id) ? { ...e, status: 'sent' as AutomationStatus, sentAt: now } : e)
    )
  }

  function markEntriesPending(ids: Set<string>) {
    setEntries((prev) =>
      prev.map((e) => ids.has(e.id) ? { ...e, status: 'pending' as AutomationStatus, lastError: null } : e)
    )
  }

  function markEntriesSkipped(ids: Set<string>) {
    setEntries((prev) =>
      prev.map((e) => ids.has(e.id) ? { ...e, status: 'skipped' as AutomationStatus, skipReason: 'manually cancelled' } : e)
    )
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function triggerRun() {
    setRunning(true); setRunResult(null); setRunError(null)
    try {
      const res  = await fetch('/api/crm/automations/run', { method: 'POST', cache: 'no-store' })
      const json = await res.json() as RunResult & { error?: string }
      if (json.error) setRunError(json.error)
      else setRunResult(json)
      await Promise.all([fetchLog(), fetchMetrics()])
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setRunning(false)
    }
  }

  async function sendEntry(id: string) {
    setSendingId(id)
    setSendErrors((prev) => { const n = { ...prev }; delete n[id]; return n })
    try {
      const res  = await fetch('/api/crm/automations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: id }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (json.success) {
        markEntriesSent(new Set([id]))
        fetchMetrics()
      } else {
        setSendErrors((prev) => ({ ...prev, [id]: json.error ?? 'Falha ao enviar' }))
      }
    } catch {
      setSendErrors((prev) => ({ ...prev, [id]: 'Erro de conexão' }))
    } finally {
      setSendingId(null)
    }
  }

  async function sendAllPending() {
    setBulkLoading('send_pending')
    const targetIds = new Set(oportunidades.map((e) => e.id))
    try {
      const res  = await fetch('/api/crm/automations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_pending' }),
      })
      const json = await res.json() as { affected?: number; detail?: string; error?: string }
      if (json.error) {
        showFeedback('send_pending', `Erro: ${json.error}`, false)
      } else {
        markEntriesSent(targetIds)
        showFeedback('send_pending', `${json.affected ?? targetIds.size} enviados`, true)
        fetchMetrics()
      }
    } catch {
      showFeedback('send_pending', 'Erro de conexão', false)
    } finally {
      setBulkLoading(null)
    }
  }

  async function reprocessFailed() {
    setBulkLoading('reprocess_failed')
    const targetIds = new Set(failedVisible.map((e) => e.id))
    try {
      const res  = await fetch('/api/crm/automations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprocess_failed' }),
      })
      const json = await res.json() as { affected?: number; error?: string }
      if (json.error) {
        showFeedback('reprocess_failed', `Erro: ${json.error}`, false)
      } else {
        markEntriesPending(targetIds)
        showFeedback('reprocess_failed', `${json.affected ?? targetIds.size} reprocessados`, true)
        fetchMetrics()
      }
    } catch {
      showFeedback('reprocess_failed', 'Erro de conexão', false)
    } finally {
      setBulkLoading(null)
    }
  }

  async function cancelPending() {
    setBulkLoading('cancel_pending')
    setConfirmCancel(false)
    const targetIds = new Set(oportunidades.map((e) => e.id))
    try {
      const res  = await fetch('/api/crm/automations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_pending' }),
      })
      const json = await res.json() as { affected?: number; error?: string }
      if (json.error) {
        showFeedback('cancel_pending', `Erro: ${json.error}`, false)
      } else {
        markEntriesSkipped(targetIds)
        showFeedback('cancel_pending', `${json.affected ?? targetIds.size} cancelados`, true)
        fetchMetrics()
      }
    } catch {
      showFeedback('cancel_pending', 'Erro de conexão', false)
    } finally {
      setBulkLoading(null)
    }
  }

  function formatTs(ts: string | null | undefined) {
    if (!ts) return '—'
    const d = new Date(ts)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(d)
  }

  const cardProps = { expandedId, setExpandedId, sendingId, sendErrors, onSend: sendEntry, formatTs }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>
            CRM — Marujos Sushi
          </span>
          <span style={{ marginLeft: 10, color: '#333', fontSize: 11 }}>painel interno</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { fetchLog(); fetchMetrics() }}
            disabled={loading}
            style={{ ...S.btn, opacity: loading ? 0.4 : 1 }}>
            ↻ Atualizar
          </button>
          <button
            onClick={triggerRun}
            disabled={running}
            style={{ ...S.btnPrimary, opacity: running ? 0.4 : 1 }}>
            {running ? 'Executando…' : '▶ Executar agora'}
          </button>
        </div>
      </div>

      <CrmTabBar />

      <div style={S.body}>

        <SendingRulesPanel />

        {/* Banners */}
        {runResult && (
          <div style={{
            backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <span style={{ color: '#C9A84C', fontWeight: 600 }}>Execução concluída</span>
            <span style={{ color: '#4ade80' }}>✓ {runResult.total.triggered} disparados</span>
            <span style={{ color: '#555' }}>{runResult.total.skipped} ignorados</span>
            {runResult.total.errors > 0 && <span style={{ color: '#f87171' }}>{runResult.total.errors} erros</span>}
          </div>
        )}
        {runError && (
          <div style={{
            backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 8, padding: '8px 14px', marginBottom: 12,
            color: '#f87171', fontSize: 12,
          }}>
            Erro: {runError}
          </div>
        )}

        {/* Metrics strip */}
        {metrics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {[
                { label: 'Pendentes',        value: metrics.pending,                              color: '#facc15' },
                { label: 'Enviados hoje',     value: metrics.sent_today,                           color: '#4ade80' },
                { label: 'Falhas hoje',       value: metrics.failed_today,                         color: '#f87171' },
                { label: 'Taxa de envio',     value: `${metrics.send_rate_today}%`,                color: '#60a5fa' },
                { label: 'Receita potencial', value: fmtBRL(metrics.potential_revenue_pending),    color: '#C9A84C' },
                { label: 'Receita enviada',   value: fmtBRL(metrics.potential_revenue_sent_today), color: '#4ade80' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  backgroundColor: '#111', border: '1px solid #1e1e1e',
                  borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: '#444', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'Recuperados hoje',    value: metrics.recovered_today },
                { label: 'Receita recuperada',  value: fmtBRL(metrics.recovered_revenue_today) },
                { label: 'Taxa de recuperação', value: `${metrics.recovery_rate}%` },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  backgroundColor: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)',
                  borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: '#5a4f7a', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flow filter — global */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: '#444' }}>Fluxo:</span>
          <select
            value={filterFlow}
            onChange={(e) => setFilterFlow(e.target.value as AutomationFlow | '')}
            style={S.select}>
            <option value="">Todos</option>
            {(Object.entries(FLOW_CFG) as [AutomationFlow, typeof FLOW_CFG[AutomationFlow]][]).map(([flow, cfg]) => (
              <option key={flow} value={flow}>{cfg.emoji} {cfg.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: 13 }}>Carregando…</div>
        ) : (
          <>
            {/* ── Seção 1: Oportunidades ──────────────────────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <SectionHeader
                title="Oportunidades"
                count={oportunidades.length}
                color={oportunidades.length > 0 ? '#facc15' : '#333'}
                accent={oportunidades.length > 0 ? '#facc15' : '#222'}
              />

              {oportunidades.length === 0 ? (
                /* Empty state — no bulk bar, clear guidance */
                <div style={{
                  ...S.card,
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderColor: '#181818',
                }}>
                  <span style={{ fontSize: 18, opacity: 0.3 }}>📭</span>
                  <div>
                    <div style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>
                      Nenhuma oportunidade no momento
                    </div>
                    <div style={{ fontSize: 11, color: '#2e2e2e', marginTop: 2 }}>
                      Execute as automações para gerar novas oportunidades
                    </div>
                  </div>
                  {/* Reprocess failed still available when there are failed entries */}
                  {failedVisible.length > 0 && (
                    <button
                      onClick={reprocessFailed}
                      disabled={bulkLoading !== null}
                      style={{
                        ...S.btn, marginLeft: 'auto', flexShrink: 0,
                        opacity: bulkLoading === 'reprocess_failed' ? 0.5 : 1,
                      }}>
                      {bulkLoading === 'reprocess_failed' ? 'Reprocessando…' : `↺ Reprocessar falhas (${failedVisible.length})`}
                    </button>
                  )}
                  {bulkFeedback?.action === 'reprocess_failed' && (
                    <span style={{ fontSize: 11, color: bulkFeedback.ok ? '#4ade80' : '#f87171' }}>
                      {bulkFeedback.ok ? '✓' : '✕'} {bulkFeedback.msg}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {/* Bulk action bar — only shown when entries exist */}
                  <div style={{
                    ...S.card,
                    padding: '8px 12px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={sendAllPending}
                      disabled={bulkLoading !== null}
                      style={{
                        ...S.btnPrimary,
                        opacity: bulkLoading !== null ? 0.5 : 1,
                        cursor:  bulkLoading !== null ? 'not-allowed' : 'pointer',
                      }}>
                      {bulkLoading === 'send_pending' ? 'Enviando…' : `📤 Enviar todos (${oportunidades.length})`}
                    </button>

                    {failedVisible.length > 0 && (
                      <button
                        onClick={reprocessFailed}
                        disabled={bulkLoading !== null}
                        style={{
                          ...S.btn,
                          opacity: bulkLoading === 'reprocess_failed' ? 0.5 : 1,
                          cursor:  bulkLoading !== null ? 'not-allowed' : 'pointer',
                        }}>
                        {bulkLoading === 'reprocess_failed' ? 'Reprocessando…' : `↺ Reprocessar falhas (${failedVisible.length})`}
                      </button>
                    )}

                    <button
                      onClick={() => setConfirmCancel(true)}
                      disabled={bulkLoading !== null || confirmCancel}
                      style={{
                        ...S.btnDanger,
                        opacity: bulkLoading !== null ? 0.5 : 1,
                        cursor:  bulkLoading !== null ? 'not-allowed' : 'pointer',
                      }}>
                      {bulkLoading === 'cancel_pending' ? 'Cancelando…' : '✕ Cancelar pendentes'}
                    </button>

                    {bulkFeedback && (
                      <span style={{
                        fontSize: 11,
                        color: bulkFeedback.ok ? '#4ade80' : '#f87171',
                        marginLeft: 4,
                      }}>
                        {bulkFeedback.ok ? '✓' : '✕'} {bulkFeedback.msg}
                      </span>
                    )}
                  </div>

                  {/* Confirm cancel inline */}
                  {confirmCancel && (
                    <ConfirmBar
                      message={`Cancelar ${oportunidades.length} mensagem(ns) pendente(s)? Esta ação não pode ser desfeita.`}
                      onConfirm={cancelPending}
                      onCancel={() => setConfirmCancel(false)}
                    />
                  )}

                  {oportunidades.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} {...cardProps} />
                  ))}
                </>
              )}
            </div>

            {/* ── Seção 2: Execução ───────────────────────────────────────────── */}
            <div style={{ marginBottom: 28 }}>
              <SectionHeader
                title="Execução"
                count={execucao.length}
                color={execucao.length > 0 ? '#4ade80' : '#2a2a2a'}
                accent={execucao.length > 0 ? '#4ade80' : '#1e1e1e'}
              />
              {execucao.length === 0 ? (
                <div style={{
                  padding: '8px 2px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 10, color: '#2a2a2a' }}>●</span>
                  <span style={{ fontSize: 11, color: '#2e2e2e' }}>Nenhuma mensagem enviada ainda.</span>
                </div>
              ) : (
                execucao.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} {...cardProps} />
                ))
              )}
            </div>

            {/* ── Seção 3: Recuperados ────────────────────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
              <SectionHeader
                title="Recuperados"
                count={recuperados.length}
                color={recuperados.length > 0 ? '#a78bfa' : '#2a2a2a'}
                accent={recuperados.length > 0 ? '#a78bfa' : '#1e1e1e'}
                right={recuperados.length > 0 ? (
                  <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
                    Total: {fmtBRL(recuperados.reduce((s, e) => s + (e.recoveredRevenueCentavos ?? 0), 0))}
                  </span>
                ) : undefined}
              />
              {recuperados.length === 0 ? (
                <div style={{
                  padding: '8px 2px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 10, color: '#2a2a2a' }}>●</span>
                  <span style={{ fontSize: 11, color: '#2e2e2e' }}>Nenhuma receita atribuída ainda.</span>
                </div>
              ) : (
                recuperados.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} {...cardProps} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
