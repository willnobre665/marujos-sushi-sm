/**
 * crmStore — Customer identity + session context.
 *
 * Persisted to localStorage under 'marujos-crm'.
 * This store is the client-side mirror of what will eventually live in Supabase.
 * It owns identity and consent state for the current browser session so the
 * checkout form can pre-fill known fields on return visits.
 *
 * Consent is always stored with a timestamp and source — never as a bare boolean.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CrmCliente,
  CrmSession,
  ComunicacaoPreferencias,
  ConsentRecord,
  EntrySource,
  OrderContext,
} from '@/types/crm'
import { gerarUUID } from '@/utils/uuid'
import { calcSegments } from '@/utils/crmSegmentation'

interface CrmState {
  /** Stable random ID for this browser — scopes analytics, never tied to customer identity. */
  sessionId: string

  /** Session context — hydrated from URL params on boot by SessionHydrator. */
  session: CrmSession

  /** Customer identity — populated at checkout, merged on return visits. */
  cliente: CrmCliente | null

  // ── Actions ────────────────────────────────────────────────────────────────

  setSession: (partial: Partial<CrmSession>) => void
  setTableId: (tableId: string) => void

  /**
   * Upsert customer identity from checkout form data.
   * Consent is built here from the checkbox values and timestamped at call time.
   * Existing consent records are preserved if the new checkout omits them —
   * consent withdrawal requires an explicit opt-out action, not just a missing checkbox.
   */
  saveCliente: (data: {
    phone: string
    name: string
    email?: string
    /** Whether the customer checked the "receive order updates on WhatsApp" checkbox. */
    consentOrderUpdates: boolean
    /** Whether the customer checked the "receive promotions on WhatsApp" checkbox. */
    consentPromotional: boolean
  }) => void

  clearCliente: () => void
}

export const useCrmStore = create<CrmState>()(
  persist(
    (set, get) => ({
      sessionId: gerarUUID(),

      session: {
        entrySource: 'direct',
        orderContext: 'dine_in',
        tableId: undefined,
      },

      cliente: null,

      setSession(partial) {
        set((state) => ({ session: { ...state.session, ...partial } }))
      },

      setTableId(tableId) {
        set((state) => ({ session: { ...state.session, tableId } }))
      },

      saveCliente(data) {
        const now = new Date().toISOString()
        const existing = get().cliente

        // Build consent records — only overwrite if explicitly provided.
        // A returning customer who doesn't re-check a box keeps their prior consent.
        const existingPrefs = existing?.preferencias

        const orderUpdatesRecord: ConsentRecord = {
          granted: data.consentOrderUpdates,
          grantedAt: now,
          source: 'checkout_form',
        }

        // Promotional consent: only write a new record if customer explicitly
        // interacted with the checkbox. If no prior promotional consent exists
        // and current value is false, leave it absent (not the same as refusal).
        const promotionalRecord: ConsentRecord | undefined =
          data.consentPromotional || existingPrefs?.promotional
            ? {
                granted: data.consentPromotional,
                grantedAt: now,
                source: 'checkout_form',
              }
            : undefined

        const preferencias: ComunicacaoPreferencias = {
          channel: 'whatsapp', // default channel — customer always has phone
          orderUpdates: orderUpdatesRecord,
          relational: existingPrefs?.relational,  // never overwritten from checkout
          promotional: promotionalRecord ?? existingPrefs?.promotional,
        }

        // Compute rolling 30-day order count.
        // The current checkout is the new order, so increment from the stored value.
        // If the last order was more than 30 days ago, the rolling window resets to 1.
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const previousOrdersInWindow =
          existing?.lastOrderAt && existing.lastOrderAt >= thirtyDaysAgo
            ? (existing.ordersLast30Days ?? 0)
            : 0
        const ordersLast30Days = previousOrdersInWindow + 1

        const updated: CrmCliente = {
          phone: data.phone,
          name: data.name,
          email: data.email ?? existing?.email,
          birthday: existing?.birthday,           // never overwritten from checkout
          preferencias,
          orderCount: (existing?.orderCount ?? 0) + 1,
          totalSpentCentavos: existing?.totalSpentCentavos ?? 0, // updated in useCheckout
          firstSeenAt: existing?.firstSeenAt ?? now,
          lastSeenAt: now,
          lastOrderAt: now,
          ordersLast30Days,
          ...calcSegments(now, ordersLast30Days),
        }

        set({ cliente: updated })
      },

      clearCliente() {
        set({ cliente: null })
      },
    }),
    {
      name: 'marujos-crm',
      partialize: (state) => ({
        sessionId: state.sessionId,
        session: state.session,
        cliente: state.cliente,
      }),
    }
  )
)

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectSessionId = (s: CrmState) => s.sessionId
export const selectSession   = (s: CrmState) => s.session
export const selectCliente   = (s: CrmState) => s.cliente

// ─── URL param inference ──────────────────────────────────────────────────────

/** Map a ?utm_source= value to a typed EntrySource. */
export function inferEntrySource(utmSource?: string | null): EntrySource {
  switch (utmSource) {
    case 'qr':        return 'qr'
    case 'instagram': return 'instagram'
    case 'google':    return 'google'
    case 'whatsapp':  return 'whatsapp'
    default:          return 'direct'
  }
}

/** Infer OrderContext from URL params present at session start. */
export function inferOrderContext(params: {
  mesa?: string | null
  contexto?: string | null
}): OrderContext {
  if (params.contexto === 'pickup')   return 'pickup'
  if (params.contexto === 'delivery') return 'delivery'
  return 'dine_in' // default — this is an in-restaurant menu
}
