'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CmvIngredient } from '@/app/api/cmv/ingredients/route'
import type { StockCategory } from '@/lib/stockCategories'
import { STOCK_CATEGORIES, STOCK_CATEGORY_LABELS } from '@/lib/stockCategories'
import type { SheetLine, SheetSummary } from '@/app/api/cmv/sheets/route'
import type { CmvSummaryResponse, CmvProductLine } from '@/app/api/cmv/summary/route'
import type { StockMovement } from '@/app/api/cmv/stock/route'
import { products } from '@/data/products'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(centavos: number): string {
  return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ',')
}

function pct(value: number, decimals = 1): string {
  return value.toFixed(decimals) + '%'
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

  tabBar: {
    display: 'flex', gap: 4, marginBottom: 24,
    borderBottom: '1px solid #1e1e1e',
  } as React.CSSProperties,

  body: {
    padding: '20px 24px',
    maxWidth: 1200,
    margin: '0 auto',
  } as React.CSSProperties,

  card: {
    backgroundColor: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 12,
    padding: 16,
  } as React.CSSProperties,

  btn: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#ccc', fontSize: 13,
    padding: '7px 14px', cursor: 'pointer',
  } as React.CSSProperties,

  btnPrimary: {
    backgroundColor: '#C9A84C', border: 'none',
    borderRadius: 8, color: '#0A0A0A', fontWeight: 700,
    fontSize: 13, padding: '7px 16px', cursor: 'pointer',
  } as React.CSSProperties,

  btnDanger: {
    backgroundColor: 'transparent', border: '1px solid #333',
    borderRadius: 8, color: '#f87171', fontSize: 12,
    padding: '5px 10px', cursor: 'pointer',
  } as React.CSSProperties,

  input: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '7px 10px', outline: 'none', width: '100%',
  } as React.CSSProperties,

  select: {
    backgroundColor: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#F5F0E8', fontSize: 13,
    padding: '7px 10px', outline: 'none', cursor: 'pointer', width: '100%',
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
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  label: {
    fontSize: 11, color: '#555',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    marginBottom: 4, display: 'block',
  } as React.CSSProperties,

  secTitle: {
    fontSize: 12, fontWeight: 700, color: '#555',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    marginBottom: 14,
  } as React.CSSProperties,

  errorBanner: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.3)',
    color: '#f87171', fontSize: 13,
    padding: '10px 14px', borderRadius: 8, marginBottom: 16,
  } as React.CSSProperties,
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'ingredients' | 'sheets' | 'summary' | 'stock'
const TAB_LABELS: Record<Tab, string> = {
  ingredients: 'Itens de estoque',
  sheets:      'Fichas Técnicas',
  summary:     'Resumo CMV',
  stock:       'Estoque',
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={S.tabBar}>
      {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
        const isActive = t === active
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#F5F0E8' : '#555',
              padding: '0 4px 12px',
              borderBottom: `2px solid ${isActive ? '#C9A84C' : 'transparent'}`,
              transition: 'all 0.12s',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        )
      })}
    </div>
  )
}

// ─── Ingredients tab ──────────────────────────────────────────────────────────

const EMPTY_ING_FORM = { name: '', supplierName: '', category: '' as StockCategory | '', purchaseUnit: '', usageUnit: '', purchaseQty: '', purchaseCost: '' }

function IngredientsTab() {
  const [ingredients, setIngredients] = useState<CmvIngredient[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState(EMPTY_ING_FORM)
  const [saving, setSaving]           = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetch('/api/cmv/ingredients', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setIngredients(j.ingredients) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function startNew() { setEditingId('new'); setForm(EMPTY_ING_FORM) }
  function startEdit(ing: CmvIngredient) {
    setEditingId(ing.id)
    setForm({
      name:         ing.name,
      supplierName: ing.supplierName ?? '',
      category:     ing.category ?? '',
      purchaseUnit: ing.purchaseUnit,
      usageUnit:    ing.usageUnit,
      purchaseQty:  String(ing.purchaseQty),
      purchaseCost: String(ing.purchaseCost),
    })
  }
  function cancelEdit() { setEditingId(null); setForm(EMPTY_ING_FORM) }

  async function save() {
    setSaving(true); setError(null)
    const payload = {
      name:         form.name,
      supplierName: form.supplierName || null,
      category:     form.category || null,
      purchaseUnit: form.purchaseUnit,
      usageUnit:    form.usageUnit,
      purchaseQty:  Number(form.purchaseQty),
      purchaseCost: Number(form.purchaseCost),
    }
    const url    = editingId === 'new' ? '/api/cmv/ingredients' : `/api/cmv/ingredients/${editingId}`
    const method = editingId === 'new' ? 'POST' : 'PUT'

    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      cancelEdit(); load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Desativar este item de estoque?')) return
    const res  = await fetch(`/api/cmv/ingredients/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.error) setError(json.error)
    else load()
  }

  // Auto-calculate unit cost preview
  const qty  = Number(form.purchaseQty)
  const cost = Number(form.purchaseCost)
  const unitCostPreview = qty > 0 && cost >= 0 ? cost / qty : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={S.secTitle}>Itens de estoque</div>
        {editingId === null && (
          <button style={S.btnPrimary} onClick={startNew}>+ Novo item</button>
        )}
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {/* Form */}
      {editingId !== null && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#F5F0E8' }}>
            {editingId === 'new' ? 'Novo item de estoque' : 'Editar item de estoque'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={S.label}>Nome</label>
              <input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Salmão, Arroz, Luva..." />
            </div>
            <div>
              <label style={S.label}>Categoria</label>
              <select style={S.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as StockCategory | '' })}>
                <option value="">Sem categoria</option>
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{STOCK_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Fornecedor (opcional)</label>
              <input style={S.input} value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} placeholder="Nome do fornecedor..." />
            </div>
            <div>
              <label style={S.label}>Unidade de compra</label>
              <input style={S.input} value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} placeholder="kg, L, pacote..." />
            </div>
            <div>
              <label style={S.label}>Unidade de uso</label>
              <input style={S.input} value={form.usageUnit} onChange={(e) => setForm({ ...form, usageUnit: e.target.value })} placeholder="g, ml, unidade..." />
            </div>
            <div>
              <label style={S.label}>Qtd por compra (unid. de uso)</label>
              <input style={S.input} type="number" value={form.purchaseQty} onChange={(e) => setForm({ ...form, purchaseQty: e.target.value })} placeholder="1000" />
            </div>
            <div>
              <label style={S.label}>Custo da compra (centavos)</label>
              <input style={S.input} type="number" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} placeholder="2500" />
            </div>
            {unitCostPreview !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={S.label}>Custo por unid. de uso</label>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A84C', padding: '7px 0' }}>
                  R$ {(unitCostPreview / 100).toFixed(4)}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button style={S.btnPrimary} onClick={save} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button style={S.btn} onClick={cancelEdit}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: '#444', padding: '20px 0' }}>Carregando…</div>
      ) : ingredients.length === 0 ? (
        <div style={{ color: '#444', padding: '20px 0' }}>Nenhum item de estoque cadastrado.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Nome</th>
                <th style={S.th}>Categoria</th>
                <th style={S.th}>Fornecedor</th>
                <th style={S.th}>Unid. compra</th>
                <th style={S.th}>Unid. uso</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd / compra</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Custo compra</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Custo / unid.</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id}>
                  <td style={{ ...S.td, fontWeight: 500 }}>{ing.name}</td>
                  <td style={{ ...S.td, color: '#888' }}>{ing.category ? STOCK_CATEGORY_LABELS[ing.category] : '—'}</td>
                  <td style={{ ...S.td, color: '#888' }}>{ing.supplierName ?? '—'}</td>
                  <td style={{ ...S.td, color: '#888' }}>{ing.purchaseUnit}</td>
                  <td style={{ ...S.td, color: '#888' }}>{ing.usageUnit}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{ing.purchaseQty}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{brl(ing.purchaseCost)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#C9A84C', fontWeight: 600 }}>
                    R$ {(ing.unitCost / 100).toFixed(4)}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button style={S.btn} onClick={() => startEdit(ing)}>Editar</button>
                      <button style={S.btnDanger} onClick={() => remove(ing.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Technical sheets tab ─────────────────────────────────────────────────────

function SheetsTab() {
  const [summaries, setSummaries]     = useState<SheetSummary[]>([])
  const [ingredients, setIngredients] = useState<CmvIngredient[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selectedPid, setSelectedPid] = useState<string>('')
  const [sheetLines, setSheetLines]   = useState<SheetLine[]>([])
  const [sheetLoading, setSheetLoading] = useState(false)
  const [editLines, setEditLines]     = useState<{ ingredientId: string; quantityUsed: string }[]>([])
  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)

  const loadBase = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([
      fetch('/api/cmv/sheets', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/cmv/ingredients', { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([sh, ing]) => {
        if (sh.error)  throw new Error(sh.error)
        if (ing.error) throw new Error(ing.error)
        setSummaries(sh.summaries ?? [])
        setIngredients(ing.ingredients ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadBase() }, [loadBase])

  function loadSheet(pid: string) {
    setSelectedPid(pid); setSheetLoading(true); setEditing(false)
    fetch(`/api/cmv/sheets?productId=${encodeURIComponent(pid)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setSheetLines(j.lines ?? []) })
      .catch((e) => setError(String(e)))
      .finally(() => setSheetLoading(false))
  }

  function startEdit() {
    setEditLines(
      sheetLines.length > 0
        ? sheetLines.map((l) => ({ ingredientId: l.ingredientId, quantityUsed: String(l.quantityUsed) }))
        : [{ ingredientId: '', quantityUsed: '' }]
    )
    setEditing(true)
  }

  function addLine() {
    setEditLines((prev) => [...prev, { ingredientId: '', quantityUsed: '' }])
  }

  function removeLine(i: number) {
    setEditLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function saveSheet() {
    if (!selectedPid) return
    const lines = editLines
      .filter((l) => l.ingredientId && l.quantityUsed)
      .map((l) => ({ ingredientId: l.ingredientId, quantityUsed: Number(l.quantityUsed) }))
    if (lines.length === 0) return setError('Adicione pelo menos um item de estoque')

    setSaving(true); setError(null)
    try {
      const res  = await fetch('/api/cmv/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedPid, lines }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEditing(false); loadSheet(selectedPid); loadBase()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedPid)
  const hasSheet = summaries.some((s) => s.productId === selectedPid)
  const sheetTotalCost = sheetLines.reduce((s, l) => s + l.lineCost, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
      {/* Product picker */}
      <div>
        <div style={S.secTitle}>Produtos</div>
        {error && <div style={S.errorBanner}>{error}</div>}
        {loading ? (
          <div style={{ color: '#444' }}>Carregando…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {products.filter((p) => p.disponivel).map((p) => {
              const hasSh = summaries.some((s) => s.productId === p.id)
              const isActive = p.id === selectedPid
              return (
                <button
                  key={p.id}
                  onClick={() => loadSheet(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    backgroundColor: isActive ? '#1a1a1a' : 'transparent',
                    borderLeft: `3px solid ${isActive ? '#C9A84C' : 'transparent'}`,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 13, color: isActive ? '#F5F0E8' : '#888', lineHeight: 1.3 }}>
                    {p.nome}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: hasSh ? '#4ade80' : '#333',
                    marginLeft: 6, flexShrink: 0,
                  }}>
                    {hasSh ? '✓' : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sheet detail */}
      <div>
        {!selectedPid ? (
          <div style={{ color: '#444', paddingTop: 8 }}>Selecione um produto para ver ou editar a ficha técnica.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#F5F0E8' }}>{selectedProduct?.nome}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                  Preço de venda: {selectedProduct ? brl(selectedProduct.preco) : '—'}
                </div>
              </div>
              {!editing && (
                <button style={S.btnPrimary} onClick={startEdit}>
                  {hasSheet ? 'Editar ficha' : 'Criar ficha'}
                </button>
              )}
            </div>

            {sheetLoading ? (
              <div style={{ color: '#444' }}>Carregando ficha…</div>
            ) : editing ? (
              <div style={S.card}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Itens de estoque da ficha</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {editLines.map((line, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8, alignItems: 'center' }}>
                      <select
                        style={S.select}
                        value={line.ingredientId}
                        onChange={(e) => setEditLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ingredientId: e.target.value } : l))}
                      >
                        <option value="">Selecionar item…</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.usageUnit})</option>
                        ))}
                      </select>
                      <input
                        style={S.input}
                        type="number"
                        placeholder="Quantidade"
                        value={line.quantityUsed}
                        onChange={(e) => setEditLines((prev) => prev.map((l, idx) => idx === i ? { ...l, quantityUsed: e.target.value } : l))}
                      />
                      <button style={S.btnDanger} onClick={() => removeLine(i)}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button style={S.btn} onClick={addLine}>+ Linha</button>
                  <button style={S.btnPrimary} onClick={saveSheet} disabled={saving}>{saving ? 'Salvando…' : 'Salvar ficha'}</button>
                  <button style={S.btn} onClick={() => setEditing(false)}>Cancelar</button>
                </div>
              </div>
            ) : sheetLines.length === 0 ? (
              <div style={{ color: '#555' }}>Nenhuma ficha técnica cadastrada para este produto.</div>
            ) : (
              <div style={S.card}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Ingrediente</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Quantidade</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Custo unit.</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Custo linha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetLines.map((l) => (
                      <tr key={l.id}>
                        <td style={{ ...S.td }}>{l.ingredientName}</td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#888' }}>
                          {l.quantityUsed} {l.usageUnit}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#888' }}>
                          R$ {(l.unitCost / 100).toFixed(4)}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right' }}>
                          {brl(Math.round(l.lineCost))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ ...S.td, color: '#888', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>
                        Custo total da ficha
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#C9A84C', fontWeight: 700, fontSize: 15 }}>
                        {brl(Math.round(sheetTotalCost))}
                      </td>
                    </tr>
                    {selectedProduct && (
                      <tr>
                        <td colSpan={3} style={{ ...S.td, color: '#888', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>
                          CMV teórico
                        </td>
                        <td style={{
                          ...S.td, textAlign: 'right', fontWeight: 700, fontSize: 15,
                          color: (sheetTotalCost / selectedProduct.preco * 100) > 40 ? '#f87171' : '#4ade80',
                        }}>
                          {pct(sheetTotalCost / selectedProduct.preco * 100)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Summary tab ──────────────────────────────────────────────────────────────

type Range = 'today' | 'week' | 'month'

const RANGE_LABELS: Record<Range, string> = { today: 'Hoje', week: '7 dias', month: '30 dias' }

function cmvColor(pctVal: number): string {
  if (pctVal <= 30) return '#4ade80'
  if (pctVal <= 40) return '#facc15'
  return '#f87171'
}

function SummaryTab() {
  const [range, setRange]   = useState<Range>('today')
  const [data, setData]     = useState<CmvSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback((r: Range) => {
    setLoading(true); setError(null)
    fetch(`/api/cmv/summary?range=${r}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((j) => { if (j.error) throw new Error(j.error); setData(j) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(range) }, [range, load])

  return (
    <div>
      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              ...S.btn,
              backgroundColor: range === r ? '#C9A84C' : '#161616',
              color: range === r ? '#0A0A0A' : '#ccc',
              fontWeight: range === r ? 700 : 400,
              border: range === r ? 'none' : '1px solid #2a2a2a',
            }}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {loading ? (
        <div style={{ color: '#444' }}>Carregando…</div>
      ) : !data || data.lines.length === 0 ? (
        <div style={{ color: '#555' }}>Nenhuma venda encontrada no período.</div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label="Faturamento" value={brl(data.totalRevenue)} />
            <KpiCard label="Custo total (CMV)" value={brl(data.totalCost)} />
            <KpiCard
              label="CMV Blended"
              value={pct(data.blendedCmvPct)}
              valueColor={cmvColor(data.blendedCmvPct)}
            />
            <KpiCard
              label="Cobertura fichas"
              value={pct(data.coveredRevenuePct)}
              sub={data.coveredRevenuePct < 100 ? 'Produtos sem ficha excluídos do CMV' : undefined}
              valueColor={data.coveredRevenuePct >= 80 ? '#4ade80' : '#facc15'}
            />
          </div>

          {/* Per-product table */}
          <div style={S.secTitle}>Por produto</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Produto</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Vendidos</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Preço médio</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Custo unit.</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Faturamento</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Custo total</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Margem</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>CMV %</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <ProductLine key={l.productId} line={l} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ProductLine({ line: l }: { line: CmvProductLine }) {
  const cmvC = l.hasSheet ? cmvColor(l.cmvPct) : '#555'
  return (
    <tr>
      <td style={S.td}>
        <div style={{ fontWeight: 500 }}>{l.productName}</div>
        {!l.hasSheet && (
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>sem ficha técnica</div>
        )}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>{l.qtySold}</td>
      <td style={{ ...S.td, textAlign: 'right', color: '#888' }}>{brl(l.avgSalePrice)}</td>
      <td style={{ ...S.td, textAlign: 'right', color: l.hasSheet ? '#ccc' : '#333' }}>
        {l.hasSheet ? brl(l.unitCost) : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>{brl(l.totalRevenue)}</td>
      <td style={{ ...S.td, textAlign: 'right', color: l.hasSheet ? '#ccc' : '#333' }}>
        {l.hasSheet ? brl(l.totalCost) : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'right', color: l.hasSheet ? '#4ade80' : '#333' }}>
        {l.hasSheet ? brl(l.grossMargin) : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: cmvC }}>
        {l.hasSheet ? pct(l.cmvPct) : '—'}
      </td>
    </tr>
  )
}

function KpiCard({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <div style={S.card}>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? '#F5F0E8' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Stock tab ────────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  in:         'Entrada',
  out:        'Saída (pedido)',
  adjustment: 'Ajuste',
  loss:       'Baixa',
}

const MOVEMENT_TYPE_COLOR: Record<string, string> = {
  in:         '#4ade80',
  out:        '#f87171',
  adjustment: '#facc15',
  loss:       '#f87171',
}

const EMPTY_ACTION_FORM = { ingredientId: '', quantity: '', reason: '' }

function StockTab() {
  const [ingredients, setIngredients]   = useState<CmvIngredient[]>([])
  const [movements, setMovements]       = useState<StockMovement[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [actionType, setActionType]     = useState<'in' | 'loss' | null>(null)
  const [form, setForm]                 = useState(EMPTY_ACTION_FORM)
  const [saving, setSaving]             = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    Promise.all([
      fetch('/api/cmv/ingredients', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/cmv/stock',       { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([ing, mv]) => {
        if (ing.error) throw new Error(ing.error)
        if (mv.error)  throw new Error(mv.error)
        setIngredients(ing.ingredients ?? [])
        setMovements(mv.movements ?? [])
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openAction(type: 'in' | 'loss') {
    setActionType(type)
    setForm(EMPTY_ACTION_FORM)
    setError(null)
  }
  function cancelAction() { setActionType(null); setForm(EMPTY_ACTION_FORM) }

  async function submitAction() {
    if (!actionType) return
    if (!form.ingredientId) return setError('Selecione um item de estoque')
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty <= 0) return setError('Quantidade deve ser positiva')

    setSaving(true); setError(null)
    try {
      const res  = await fetch('/api/cmv/stock', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ingredientId: form.ingredientId, type: actionType, quantity: qty, reason: form.reason || null }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      cancelAction()
      load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const lowStock = ingredients.filter((i) => i.minimumStock > 0 && i.currentStock <= i.minimumStock)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {error && <div style={S.errorBanner}>{error}</div>}

      {/* ── Low-stock alert banner ─────────────────────────────────────── */}
      {!loading && lowStock.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(248,113,113,0.07)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <span style={{ fontSize: 13, color: '#f87171' }}>
            <strong>{lowStock.length}</strong> item{lowStock.length > 1 ? 'ns' : ''} de estoque abaixo do mínimo:{' '}
            {lowStock.map((i) => i.name).join(', ')}
          </span>
        </div>
      )}

      {/* ── Section 1: Overview ───────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={S.secTitle}>Visão geral do estoque</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btnPrimary} onClick={() => openAction('in')}>+ Entrada</button>
            <button style={{ ...S.btn, color: '#f87171', borderColor: '#333' }} onClick={() => openAction('loss')}>− Baixa</button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: '#444' }}>Carregando…</div>
        ) : ingredients.length === 0 ? (
          <div style={{ color: '#444' }}>Nenhum item de estoque cadastrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Item</th>
                  <th style={S.th}>Unid.</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Estoque atual</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Mínimo</th>
                  <th style={{ ...S.th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => {
                  const isLow = ing.minimumStock > 0 && ing.currentStock <= ing.minimumStock
                  const isOk  = ing.minimumStock > 0 && ing.currentStock > ing.minimumStock
                  return (
                    <tr key={ing.id}>
                      <td style={{ ...S.td, fontWeight: 500 }}>{ing.name}</td>
                      <td style={{ ...S.td, color: '#888' }}>{ing.usageUnit}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: isLow ? '#f87171' : '#F5F0E8' }}>
                        {ing.currentStock}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#555' }}>
                        {ing.minimumStock > 0 ? ing.minimumStock : '—'}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {isLow ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', padding: '3px 8px', borderRadius: 20 }}>
                            BAIXO
                          </span>
                        ) : isOk ? (
                          <span style={{ fontSize: 11, color: '#4ade80', backgroundColor: 'rgba(74,222,128,0.08)', padding: '3px 8px', borderRadius: 20 }}>
                            OK
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#555' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Action form (entrada / baixa) ──────────────────── */}
      {actionType !== null && (
        <div style={{ ...S.card, border: `1px solid ${actionType === 'in' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: actionType === 'in' ? '#4ade80' : '#f87171' }}>
            {actionType === 'in' ? 'Entrada de estoque' : 'Baixa manual'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={S.label}>Item de estoque</label>
              <select
                style={S.select}
                value={form.ingredientId}
                onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}
              >
                <option value="">Selecionar…</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} (estoque: {ing.currentStock} {ing.usageUnit})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Quantidade ({form.ingredientId ? (ingredients.find((i) => i.id === form.ingredientId)?.usageUnit ?? 'unid.') : 'unid.'})</label>
              <input
                style={S.input}
                type="number"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <label style={S.label}>Motivo (opcional)</label>
              <input
                style={S.input}
                type="text"
                placeholder={actionType === 'in' ? 'Compra, reposição…' : 'Vencimento, quebra…'}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              style={actionType === 'in' ? S.btnPrimary : { ...S.btnPrimary, backgroundColor: '#f87171' }}
              onClick={submitAction}
              disabled={saving}
            >
              {saving ? 'Salvando…' : actionType === 'in' ? 'Confirmar entrada' : 'Confirmar baixa'}
            </button>
            <button style={S.btn} onClick={cancelAction}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Section 3: Movements history ──────────────────────────────── */}
      <div>
        <div style={{ ...S.secTitle, marginBottom: 14 }}>Histórico de movimentações</div>
        {loading ? (
          <div style={{ color: '#444' }}>Carregando…</div>
        ) : movements.length === 0 ? (
          <div style={{ color: '#444' }}>Nenhuma movimentação registrada.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Item</th>
                  <th style={S.th}>Tipo</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Quantidade</th>
                  <th style={S.th}>Motivo</th>
                  <th style={S.th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mv) => (
                  <tr key={mv.id}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{mv.ingredientName}</td>
                    <td style={S.td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: MOVEMENT_TYPE_COLOR[mv.type] ?? '#888',
                        backgroundColor: `${MOVEMENT_TYPE_COLOR[mv.type] ?? '#888'}18`,
                        padding: '2px 8px', borderRadius: 20,
                      }}>
                        {MOVEMENT_TYPE_LABEL[mv.type] ?? mv.type}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', color: MOVEMENT_TYPE_COLOR[mv.type] ?? '#888', fontWeight: 600 }}>
                      {mv.type === 'out' || mv.type === 'loss' || mv.type === 'adjustment' ? '−' : '+'}{mv.quantity}
                    </td>
                    <td style={{ ...S.td, color: '#666' }}>{mv.reason ?? '—'}</td>
                    <td style={{ ...S.td, color: '#555', whiteSpace: 'nowrap' }}>
                      {new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      }).format(new Date(mv.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CmvPanel() {
  const [tab, setTab] = useState<Tab>('ingredients')

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>
            CMV — Estoque & Fichas
          </span>
          <span style={{ marginLeft: 10, color: '#333', fontSize: 12 }}>painel interno</span>
        </div>
        <a
          href="/finance"
          style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}
        >
          ← Financeiro
        </a>
      </div>

      <div style={S.body}>
        <TabBar active={tab} onChange={setTab} />
        {tab === 'ingredients' && <IngredientsTab />}
        {tab === 'sheets'      && <SheetsTab />}
        {tab === 'summary'     && <SummaryTab />}
        {tab === 'stock'       && <StockTab />}
      </div>
    </div>
  )
}
