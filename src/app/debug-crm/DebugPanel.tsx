'use client'

import { useState, useCallback, useEffect } from 'react'
import { drainQueue, queueSize, clearQueue } from '@/utils/eventQueue'
import { syncEvents, setSyncLogCallback } from '@/utils/eventSync'
import { clearCrmEventBuffer } from '@/utils/crmEvents'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebugData {
  configError: boolean
  message?: string
  hint?: string
  meta: { generatedAt: string; counts: Record<string, number> }
  events: Array<{ id: string; ts: string; session_id: string; event_name: string; received_at: string }>
  clientes: Array<{
    phone: string; name: string; email: string | null
    order_count: number; total_spent_centavos: number
    consent_order_updates: boolean | null; consent_promotional: boolean | null
    segment_tags: string[]; last_order_at: string | null; updated_at: string
  }>
  pedidos: Array<{
    id: string; customer_phone: string; total: number
    status: string; context: string; source: string; created_at: string
  }>
  consentLogs: Array<{
    id: number; customer_phone: string; category: string
    granted: boolean; granted_at: string; source: string; event_id: string | null
  }>
  errors: Record<string, string | null | undefined>
}

// Safe accessor — returns empty array if the field is missing or not an array.
function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centavosToReal(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`
}

function ts(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function DebugPanel() {
  const [data, setData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [localQueue, setLocalQueue] = useState(() => drainQueue())
  const [syncLog, setSyncLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) =>
    setSyncLog((prev) => [`${new Date().toLocaleTimeString('pt-BR')} — ${msg}`, ...prev.slice(0, 29)]),
  [])

  // Wire the sync engine's log output into the panel.
  useEffect(() => {
    setSyncLogCallback(addLog)
    return () => setSyncLogCallback(null)
  }, [addLog])

  const refreshQueue = useCallback(() => {
    setLocalQueue(drainQueue())
  }, [])

  const fetchDebugData = useCallback(async () => {
    console.log('[DebugPanel] fetchDebugData called')
    setLoading(true)
    setFetchError(null)
    const url = '/api/crm/debug'
    console.log('[DebugPanel] fetching', url)
    try {
      const res = await fetch(url)
      console.log('[DebugPanel] response status', res.status)
      // Always parse JSON — even 503 returns a JSON body now.
      const json = await res.json()
      console.log('[DebugPanel] response body', json)
      setData(json)
      refreshQueue()
      if (json.configError) {
        addLog(`⚠️ Supabase not configured: ${json.message}`)
      } else {
        addLog('Supabase snapshot refreshed')
      }
    } catch (err) {
      // Network-level failure (server crashed, no response at all).
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[DebugPanel] fetch error', err)
      setFetchError(`Cannot reach /api/crm/debug: ${msg}. Is the dev server running?`)
      addLog(`⚠️ fetch error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [addLog, refreshQueue])

  const handleForceSend = async () => {
    const before = queueSize()
    addLog(`Force sync triggered — queue size: ${before}`)
    await syncEvents()
    refreshQueue()
    const after = queueSize()
    if (after === before && before > 0) {
      addLog(`⚠️ Queue unchanged after sync (${after} events). See log above for reason.`)
    }
    await fetchDebugData()
  }

  const handleClearQueue = () => {
    clearQueue()
    clearCrmEventBuffer()
    setLocalQueue([])
    addLog('Local queue cleared')
  }

  // Safely extract arrays so the panel never crashes on partial/error responses.
  const events      = safeArray<DebugData['events'][number]>(data?.events)
  const clientes    = safeArray<DebugData['clientes'][number]>(data?.clientes)
  const pedidos     = safeArray<DebugData['pedidos'][number]>(data?.pedidos)
  const consentLogs = safeArray<DebugData['consentLogs'][number]>(data?.consentLogs)
  const errors      = data?.errors ?? {}

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13, padding: 24, background: '#0a0a0a', minHeight: '100vh', color: '#f5f0e8' }}>
      <h1 style={{ color: '#C9A84C', marginBottom: 4 }}>CRM Pipeline Debug</h1>
      <p style={{ color: '#888', marginBottom: 20 }}>
        Dev only — blocked in production.
        &nbsp;Supabase: {!data ? '—' : data.configError ? '❌ not configured' : '✅ connected'}
      </p>

      {/* ── Config error banner ── */}
      {data?.configError && (
        <div style={{ background: '#1a1000', border: '1px solid #aa6600', padding: 12, marginBottom: 20, borderRadius: 8, lineHeight: 1.6 }}>
          <strong style={{ color: '#ffaa00' }}>⚠️ Supabase not configured</strong>
          <br />{data.message}
          {data.hint && <><br /><span style={{ color: '#888' }}>{data.hint}</span></>}
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <Btn onClick={fetchDebugData} disabled={loading}>
          {loading ? 'Loading…' : '🔄 Refresh Supabase snapshot'}
        </Btn>
        <Btn onClick={handleForceSend}>⬆️ Force sync now</Btn>
        <Btn onClick={handleClearQueue} danger>🗑️ Clear local queue</Btn>
      </div>

      {fetchError && (
        <div style={{ background: '#3a0000', border: '1px solid #aa0000', padding: 12, marginBottom: 20, borderRadius: 8 }}>
          ❌ {fetchError}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Local queue */}
        <Section title={`Local Queue (${localQueue.length} unsent)`}>
          {localQueue.length === 0
            ? <Muted>Queue is empty — all events synced.</Muted>
            : localQueue.map((e) => (
                <Row key={e.id}>
                  <span style={{ color: '#C9A84C' }}>{e.payload.event}</span>
                  <Muted>{ts(e.ts)}</Muted>
                  <Muted style={{ fontSize: 11 }}>{e.id.slice(0, 8)}…</Muted>
                </Row>
              ))
          }
        </Section>

        {/* Sync log */}
        <Section title="Sync Log">
          {syncLog.length === 0
            ? <Muted>No activity yet. Click Force sync now or place an order.</Muted>
            : syncLog.map((line, i) => <div key={i} style={{ color: '#aaa', marginBottom: 2 }}>{line}</div>)
          }
        </Section>

        {/* Raw events */}
        <Section title={`crm_events_raw (last ${events.length})`}>
          {!data ? <Muted>Click Refresh.</Muted>
            : errors.events ? <Err>{String(errors.events)}</Err>
            : events.length === 0 ? <Muted>No events yet.</Muted>
            : events.map((e) => (
                <Row key={e.id}>
                  <span style={{ color: '#C9A84C' }}>{e.event_name}</span>
                  <Muted>{ts(e.ts)}</Muted>
                </Row>
              ))
          }
        </Section>

        {/* Customers */}
        <Section title={`crm_clientes (last ${clientes.length})`}>
          {!data ? <Muted>Click Refresh.</Muted>
            : errors.clientes ? <Err>{String(errors.clientes)}</Err>
            : clientes.length === 0 ? <Muted>No customers yet.</Muted>
            : clientes.map((c) => (
                <Row key={c.phone}>
                  <strong>{c.name}</strong>
                  <Muted>{c.phone}</Muted>
                  <span>{c.order_count} orders · {centavosToReal(c.total_spent_centavos)}</span>
                  <span>transact: {c.consent_order_updates === null ? '—' : c.consent_order_updates ? '✅' : '❌'}
                    &nbsp;promo: {c.consent_promotional === null ? '—' : c.consent_promotional ? '✅' : '❌'}
                  </span>
                  <Muted>{ts(c.updated_at)}</Muted>
                </Row>
              ))
          }
        </Section>

        {/* Orders */}
        <Section title={`crm_pedidos (last ${pedidos.length})`}>
          {!data ? <Muted>Click Refresh.</Muted>
            : errors.pedidos ? <Err>{String(errors.pedidos)}</Err>
            : pedidos.length === 0 ? <Muted>No orders yet.</Muted>
            : pedidos.map((p) => (
                <Row key={p.id}>
                  <span style={{ color: '#C9A84C' }}>{centavosToReal(p.total)}</span>
                  <Muted>{p.customer_phone}</Muted>
                  <span>{p.context} · {p.source} · <Tag>{p.status}</Tag></span>
                  <Muted>{ts(p.created_at)}</Muted>
                </Row>
              ))
          }
        </Section>

        {/* Consent logs */}
        <Section title={`crm_consent_logs (last ${consentLogs.length})`}>
          {!data ? <Muted>Click Refresh.</Muted>
            : errors.consentLogs ? <Err>{String(errors.consentLogs)}</Err>
            : consentLogs.length === 0 ? <Muted>No consent records yet.</Muted>
            : consentLogs.map((l) => (
                <Row key={l.id}>
                  <span>{l.customer_phone}</span>
                  <span>{l.category} → {l.granted ? '✅ granted' : '❌ revoked'}</span>
                  <Muted>{l.source}</Muted>
                  <Muted>{ts(l.granted_at)}</Muted>
                </Row>
              ))
          }
        </Section>

      </div>

      {data && !data.configError && (
        <p style={{ marginTop: 20, color: '#555', fontSize: 11 }}>
          Snapshot generated at {ts(data.meta.generatedAt)}
        </p>
      )}
    </div>
  )
}

// ─── Mini components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16 }}>
      <h3 style={{ color: '#C9A84C', margin: '0 0 12px', fontSize: 13 }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {children}
    </div>
  )
}

function Muted({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ color: '#666', ...style }}>{children}</span>
}

function Err({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#ff6666' }}>⚠️ {children}</span>
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
      {children}
    </span>
  )
}

function Btn({
  children, onClick, disabled, danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: danger ? '#3a0000' : '#1e1e1e',
        color: danger ? '#ff9999' : '#f5f0e8',
        border: `1px solid ${danger ? '#aa0000' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 8,
        padding: '8px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'monospace',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  )
}
