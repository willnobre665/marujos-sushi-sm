'use client'

import { useEffect, useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import { useCheckout } from '@/hooks/useCheckout'
import { formatarPreco } from '@/utils/currency'
import { CheckoutUpsell } from './CheckoutUpsell'
import type { FormaPagamento } from '@/types/order'

// ─── Types ───────────────────────────────────────────────────────────────────

type FormState = {
  // restaurant
  mesa: string
  // shared
  nome: string
  telefone: string
  consentWhatsApp: boolean
  pagamento: FormaPagamento | ''
  troco: string
  observacoes: string
  // delivery
  logradouro: string
  numero: string
  bairro: string
  referencia: string
}

type Errors = Partial<Record<keyof FormState, string>>

// ─── Payment options ──────────────────────────────────────────────────────────

const PAGAMENTOS_RESTAURANTE: { id: FormaPagamento; label: string; descricao: string; icone: string }[] = [
  { id: 'pix',      label: 'PIX',     descricao: 'Pague pelo app do banco',   icone: '⚡' },
  { id: 'credito',  label: 'Cartão',  descricao: 'Crédito ou débito na mesa', icone: '💳' },
  { id: 'dinheiro', label: 'Dinheiro', descricao: 'Pague em espécie',          icone: '💵' },
]

const PAGAMENTOS_DELIVERY: { id: FormaPagamento; label: string; descricao: string; icone: string }[] = [
  { id: 'pix',      label: 'PIX',     descricao: 'Pague pelo app do banco',        icone: '⚡' },
  { id: 'credito',  label: 'Cartão',  descricao: 'Maquininha na entrega',          icone: '💳' },
  { id: 'dinheiro', label: 'Dinheiro', descricao: 'Pague em espécie na entrega',   icone: '💵' },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  backgroundColor: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '12px',
  color: '#F5F0E8',
  fontSize: '15px',
  padding: '14px 16px',
  width: '100%',
  outline: 'none',
  WebkitAppearance: 'none',
  fontFamily: 'inherit',
}

const inputError: React.CSSProperties = {
  ...inputBase,
  borderColor: 'rgba(255,80,80,0.50)',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  color: 'rgba(245,240,232,0.40)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  marginBottom: '6px',
  display: 'block',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(245,240,232,0.55)',
  fontFamily: 'inherit',
  marginBottom: '8px',
  display: 'block',
  fontWeight: 500,
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="font-sans mt-1.5" style={{ fontSize: '12px', color: 'rgba(255,80,80,0.80)' }}>
      {msg}
    </p>
  )
}

function HintMsg({ msg }: { msg: string }) {
  return (
    <p className="font-sans mt-1.5" style={{ fontSize: '11px', color: 'rgba(245,240,232,0.28)' }}>
      {msg}
    </p>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  total: number
}

export function CheckoutForm({ total }: Props) {
  const mesaSessao = useSessionStore((s) => s.mesa)
  const isRestaurante = Boolean(mesaSessao)
  const { confirmarPedido, loading, error } = useCheckout()

  const [form, setFormState] = useState<FormState>({
    mesa: '',
    nome: '',
    telefone: '',
    consentWhatsApp: false,
    pagamento: '',
    troco: '',
    observacoes: '',
    logradouro: '',
    numero: '',
    bairro: '',
    referencia: '',
  })
  const [errors, setErrors] = useState<Errors>({})

  // Prefill mesa from session (set by QR Code scan or URL param)
  useEffect(() => {
    if (mesaSessao) setFormState((prev) => ({ ...prev, mesa: mesaSessao }))
  }, [mesaSessao])

  function set(field: keyof FormState, value: string) {
    setFormState((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function toggleConsent() {
    setFormState((prev) => ({ ...prev, consentWhatsApp: !prev.consentWhatsApp }))
  }

  function validar(): { ok: boolean; erros: Errors } {
    const e: Errors = {}

    if (isRestaurante) {
      if (!form.mesa.trim()) e.mesa = 'Informe o número da mesa'
    } else {
      if (!form.logradouro.trim())  e.logradouro = 'Informe a rua ou avenida'
      if (!form.numero.trim())      e.numero    = 'Informe o número'
      if (!form.bairro.trim())      e.bairro    = 'Informe o bairro'
    }

    if (!form.nome.trim())      e.nome     = 'Informe seu nome'
    if (!form.telefone.trim())  e.telefone = 'Informe seu telefone'
    if (!form.pagamento)        e.pagamento = 'Escolha a forma de pagamento'

    setErrors(e)
    return { ok: Object.keys(e).length === 0, erros: e }
  }

  async function handleSubmit() {
    console.log('[checkout] REAL submit path hit — form:', { nome: form.nome, telefone: form.telefone, pagamento: form.pagamento, mesa: form.mesa, isRestaurante })
    const { ok, erros } = validar()
    console.log('[checkout] validar() =', ok, '— validation errors:', erros)
    if (!ok) return

    const trocoPara = form.pagamento === 'dinheiro' && form.troco
      ? Math.round(parseFloat(form.troco.replace(',', '.')) * 100)
      : undefined

    const cliente = {
      nome: form.nome.trim(),
      telefone: form.telefone.replace(/\D/g, ''),
      consentWhatsApp: form.consentWhatsApp,
    }
    console.log('[checkout] calling confirmarPedido — cliente:', cliente)

    const endereco = isRestaurante ? undefined : {
      logradouro: form.logradouro.trim(),
      numero:     form.numero.trim(),
      bairro:     form.bairro.trim(),
      referencia: form.referencia.trim() || undefined,
    }

    await confirmarPedido(
      cliente,
      isRestaurante ? form.mesa.trim() : undefined,
      form.pagamento as FormaPagamento,
      trocoPara,
      form.observacoes.trim() || undefined,
      endereco,
    )
  }

  const pagamentos = isRestaurante ? PAGAMENTOS_RESTAURANTE : PAGAMENTOS_DELIVERY

  return (
    <div className="px-5 pt-5 pb-36 flex flex-col gap-5">

      {/* ── Mesa (restaurante) ───────────────────────────────────────────── */}
      {isRestaurante && (
        <section>
          <p className="font-sans font-semibold mb-4" style={fieldLabel}>Mesa</p>
          <div>
            <label className="font-sans" style={sectionLabel}>Número da mesa</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 5"
              value={form.mesa}
              onChange={(e) => set('mesa', e.target.value)}
              style={errors.mesa ? inputError : inputBase}
            />
            {errors.mesa
              ? <ErrorMsg msg={errors.mesa} />
              : <HintMsg msg={form.mesa ? `Mesa ${form.mesa} confirmada` : 'Verifique o número no canto da sua mesa'} />
            }
          </div>
        </section>
      )}

      {/* ── Identificação ────────────────────────────────────────────────── */}
      <section>
        <p className="font-sans font-semibold mb-4" style={fieldLabel}>
          {isRestaurante ? 'Seus dados' : 'Seus dados'}
        </p>
        <div className="flex flex-col gap-3">

          {/* Nome */}
          <div>
            <label className="font-sans" style={sectionLabel}>Nome</label>
            <input
              type="text"
              placeholder="Como prefere ser chamado?"
              autoComplete="name"
              autoCapitalize="words"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              style={errors.nome ? inputError : inputBase}
            />
            {errors.nome && <ErrorMsg msg={errors.nome} />}
          </div>

          {/* Telefone — all contexts */}
          <div>
            <label className="font-sans" style={sectionLabel}>Telefone / WhatsApp</label>
            <input
              type="tel"
              inputMode="tel"
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              style={errors.telefone ? inputError : inputBase}
            />
            {errors.telefone
              ? <ErrorMsg msg={errors.telefone} />
              : <HintMsg msg={isRestaurante ? 'Para avisar quando seu pedido estiver pronto' : 'Para confirmar seu pedido pelo WhatsApp'} />
            }
          </div>

          {/* WhatsApp consent */}
          <button
            type="button"
            onClick={toggleConsent}
            className="flex items-start gap-3 w-full text-left"
          >
            <span
              className="flex-shrink-0 flex items-center justify-center rounded"
              style={{
                width: '20px',
                height: '20px',
                marginTop: '1px',
                backgroundColor: form.consentWhatsApp ? '#C9A84C' : 'transparent',
                border: `1.5px solid ${form.consentWhatsApp ? '#C9A84C' : 'rgba(255,255,255,0.25)'}`,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              {form.consentWhatsApp && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 6l3 3 5-5" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="font-sans" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.50)', lineHeight: '1.5' }}>
              Quero receber atualizações do meu pedido e ofertas do Marujos Sushi via WhatsApp
            </span>
          </button>
        </div>
      </section>

      {/* ── Endereço (delivery) ───────────────────────────────────────────── */}
      {!isRestaurante && (
        <section>
          <p className="font-sans font-semibold mb-4" style={fieldLabel}>Endereço de entrega</p>
          <div className="flex flex-col gap-3">

            {/* Logradouro */}
            <div>
              <label className="font-sans" style={sectionLabel}>Rua / Avenida</label>
              <input
                type="text"
                placeholder="Ex: Rua das Flores"
                autoComplete="street-address"
                autoCapitalize="words"
                value={form.logradouro}
                onChange={(e) => set('logradouro', e.target.value)}
                style={errors.logradouro ? inputError : inputBase}
              />
              {errors.logradouro && <ErrorMsg msg={errors.logradouro} />}
            </div>

            {/* Número + Bairro side by side */}
            <div className="flex gap-3">
              <div style={{ flex: '0 0 100px' }}>
                <label className="font-sans" style={sectionLabel}>Número</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 42"
                  value={form.numero}
                  onChange={(e) => set('numero', e.target.value)}
                  style={errors.numero ? inputError : inputBase}
                />
                {errors.numero && <ErrorMsg msg={errors.numero} />}
              </div>
              <div style={{ flex: 1 }}>
                <label className="font-sans" style={sectionLabel}>Bairro</label>
                <input
                  type="text"
                  placeholder="Ex: Centro"
                  autoCapitalize="words"
                  value={form.bairro}
                  onChange={(e) => set('bairro', e.target.value)}
                  style={errors.bairro ? inputError : inputBase}
                />
                {errors.bairro && <ErrorMsg msg={errors.bairro} />}
              </div>
            </div>

            {/* Referência */}
            <div>
              <label className="font-sans" style={sectionLabel}>
                Referência <span style={{ opacity: 0.45 }}>(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Próximo ao mercado, portão azul..."
                autoCapitalize="sentences"
                value={form.referencia}
                onChange={(e) => set('referencia', e.target.value)}
                style={inputBase}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Pagamento ────────────────────────────────────────────────────── */}
      <section>
        <p className="font-sans font-semibold mb-4" style={fieldLabel}>Forma de pagamento</p>
        <div className="flex flex-col gap-2.5">
          {pagamentos.map((op) => {
            const selected = form.pagamento === op.id
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => set('pagamento', op.id)}
                className="flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all duration-150 active:scale-[0.985]"
                style={{
                  backgroundColor: selected ? 'rgba(201,168,76,0.09)' : '#1A1A1A',
                  border: selected
                    ? '1px solid rgba(201,168,76,0.45)'
                    : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>{op.icone}</span>

                <div className="flex-1 min-w-0">
                  <p
                    className="font-sans font-semibold leading-tight"
                    style={{ fontSize: '14px', color: selected ? '#C9A84C' : 'rgba(245,240,232,0.90)' }}
                  >
                    {op.label}
                  </p>
                  <p
                    className="font-sans mt-0.5"
                    style={{ fontSize: '11px', color: 'rgba(245,240,232,0.35)' }}
                  >
                    {op.descricao}
                  </p>
                </div>

                <span
                  className="flex-shrink-0 rounded-full border flex items-center justify-center"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderColor: selected ? '#C9A84C' : 'rgba(255,255,255,0.18)',
                    backgroundColor: selected ? '#C9A84C' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selected && (
                    <span style={{
                      width: '8px', height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#0A0A0A',
                      display: 'block',
                    }} />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {errors.pagamento && <ErrorMsg msg={errors.pagamento} />}

        {/* Troco — only when dinheiro is selected */}
        {form.pagamento === 'dinheiro' && (
          <div className="mt-3">
            <label className="font-sans" style={sectionLabel}>
              Troco para <span style={{ opacity: 0.45 }}>(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: 50,00"
              inputMode="decimal"
              value={form.troco}
              onChange={(e) => set('troco', e.target.value)}
              style={inputBase}
            />
          </div>
        )}
      </section>

      {/* ── Observações ──────────────────────────────────────────────────── */}
      <section>
        <p className="font-sans font-semibold mb-4" style={fieldLabel}>
          Observações <span className="font-normal" style={{ color: 'rgba(245,240,232,0.35)' }}>(opcional)</span>
        </p>
        <div>
          <label className="font-sans" style={sectionLabel}>Alguma preferência ou alergia?</label>
          <textarea
            placeholder="Ex: Sem wasabi, alergia a camarão, ponto de arroz mais firme..."
            rows={3}
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            style={{ ...inputBase, resize: 'none', lineHeight: '1.5' }}
          />
        </div>
      </section>

      {/* ── Add-ons rápidos ──────────────────────────────────────────────── */}
      <CheckoutUpsell />

      {/* ── Error from hook ───────────────────────────────────────────────── */}
      {error && (
        <p className="font-sans text-center" style={{ fontSize: '13px', color: 'rgba(255,80,80,0.80)' }}>
          {error.message}
        </p>
      )}

      {/* ── Soft closing line ────────────────────────────────────────────── */}
      <p
        className="font-sans text-center"
        style={{ fontSize: '13px', color: 'rgba(245,240,232,0.40)' }}
      >
        Seu pedido já está quase completo...
      </p>

      {/* ── Sticky CTA ───────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 px-5 pt-3"
        style={{
          backgroundColor: 'rgba(10,10,10,0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          zIndex: 50,
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center rounded-2xl py-4 font-sans font-bold active:scale-[0.98] transition-all duration-150"
          style={{
            fontSize: '15px',
            backgroundColor: loading ? 'rgba(201,168,76,0.50)' : '#C9A84C',
            color: '#0A0A0A',
          }}
        >
          {loading
            ? (isRestaurante ? 'Enviando pedido...' : 'Finalizando pedido...')
            : (isRestaurante
                ? `Enviar pedido para a cozinha · ${formatarPreco(total)}`
                : `Finalizar pedido · ${formatarPreco(total)}`
              )
          }
        </button>

        <p
          className="font-sans text-center mt-2"
          style={{ fontSize: '11px', color: 'rgba(245,240,232,0.32)' }}
        >
          {isRestaurante
            ? '🍣 Preparo imediato · atendimento na mesa'
            : '🚚 Entrega após confirmação'
          }
        </p>
      </div>

    </div>
  )
}
