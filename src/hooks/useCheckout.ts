'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { orderService } from '@/services/orderService'
import { useCartStore } from '@/store/cartStore'
import { useSessionStore } from '@/store/sessionStore'
import { useCrmStore } from '@/store/crmStore'
import { track } from '@/utils/analytics'
import { sendEventToCRM } from '@/utils/crmEvents'
import { normalizePhone } from '@/utils/phone'
import { getNormalizedAttribution } from '@/utils/attribution'
import type { FormaPagamento } from '@/types/order'
import type { DadosCliente, EnderecoEntrega } from '@/types/customer'

export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  const itens = useCartStore((s) => s.itens)
  const limparCarrinho = useCartStore((s) => s.limparCarrinho)
  const setCliente = useSessionStore((s) => s.setCliente)
  const setPedidoAtualId = useSessionStore((s) => s.setPedidoAtualId)

  const saveCliente = useCrmStore((s) => s.saveCliente)
  const crmSession = useCrmStore((s) => s.session)
  const sessionId = useCrmStore((s) => s.sessionId)

  const confirmarPedido = async (
    cliente: DadosCliente,
    mesa: string | undefined,
    formaPagamento: FormaPagamento,
    trocoPara?: number,
    observacaoGeral?: string,
    endereco?: EnderecoEntrega,
  ) => {
    console.log('[useCheckout] confirmarPedido called — cliente:', cliente, 'mesa:', mesa)
    setLoading(true)
    setError(null)

    track('checkout_start', sessionId, {
      itemCount: itens.length,
      subtotal: itens.reduce((a, i) => a + i.precoTotal, 0),
    })

    try {
      const pedido = await orderService.criarPedido({
        itens,
        mesa,
        endereco,
        cliente,
        formaPagamento,
        trocoPara,
        observacaoGeral,
      })

      // ── CRM: emit events for persistence pipeline ─────────────────────────
      // order_completed always fires — phone guard only protects phone-dependent events.
      const phone = cliente.telefone ? normalizePhone(cliente.telefone) : null
      const consentOrderUpdates = cliente.consentWhatsApp ?? false
      const attribution = getNormalizedAttribution()
      console.log('[useCheckout] CRM block — phone:', phone, 'consent:', consentOrderUpdates, 'attribution:', attribution)

      if (phone) {
        // 1. Emit customer_identified
        console.log('[useCheckout] sending customer_identified')
        sendEventToCRM(sessionId, {
          event: 'customer_identified',
          data: {
            customer: {
              phone,
              name: cliente.nome,
              email: cliente.email,
              consentOrderUpdates,
              consentPromotional: false,
              consentSource: 'checkout_form',
            },
          },
        })

        // 2. Emit customer_opt_in for transactional consent if granted
        if (consentOrderUpdates) {
          console.log('[useCheckout] sending customer_opt_in (transactional)')
          sendEventToCRM(sessionId, {
            event: 'customer_opt_in',
            data: {
              customer: {
                phone,
                name: cliente.nome,
                email: cliente.email,
                consentOrderUpdates,
                consentSource: 'checkout_form',
              },
              category: 'transactional',
            },
          })
        }
      } else {
        console.warn('[useCheckout] phone missing — customer_identified and customer_opt_in skipped')
      }

      // 3. Emit order_completed — always fires regardless of phone
      console.log('[useCheckout] order_completed attribution payload:', JSON.stringify(attribution, null, 2))
      console.log('[useCheckout] sending order_completed — orderId:', pedido.id, 'total:', pedido.total, 'items:', itens.length)
      sendEventToCRM(sessionId, {
        event: 'order_completed',
        data: {
          orderId: pedido.id,
          orderNumber: pedido.numeroPedido,
          customer: {
            phone: phone ?? '',
            name: cliente.nome,
            email: cliente.email,
            consentOrderUpdates,
            consentPromotional: false,
            consentSource: 'checkout_form',
          },
          context: crmSession.orderContext,
          tableId: mesa ?? crmSession.tableId,
          source: crmSession.entrySource,
          items: itens.map((i) => ({
            productId: i.produto.id,
            productName: i.produto.nome,
            categoryId: i.produto.categoriaId,
            unitPrice: i.precoUnitario,
            quantity: i.quantidade,
            total: i.precoTotal,
            variations: i.variacoesSelecionadas.map((v) => v.opcaoLabel).join(', ') || undefined,
          })),
          total: pedido.total,
          paymentMethod: pedido.formaPagamento,
          attribution,
        },
      })

      // 4. Update the client-side CRM store (pre-fills form on next visit).
      if (phone) {
        saveCliente({
          phone,
          name: cliente.nome,
          email: cliente.email,
          consentOrderUpdates,
          consentPromotional: false,
        })
      }

      // ── Analytics: checkout complete ──────────────────────────────────────
      track('checkout_complete', sessionId, {
        orderId: pedido.id,
        total: pedido.total,
        itemCount: pedido.itens.length,
        source: crmSession.entrySource,
        context: crmSession.orderContext,
        ...(mesa ? { tableId: mesa } : {}),
      })

      // ── Existing session store + cart cleanup (unchanged) ─────────────────
      setCliente(cliente)
      setPedidoAtualId(pedido.id)
      limparCarrinho()
      router.push(`/confirmacao/${pedido.id}`)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao confirmar pedido'))
    } finally {
      setLoading(false)
    }
  }

  return { confirmarPedido, loading, error }
}
