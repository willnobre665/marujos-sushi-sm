'use client'

/**
 * SessionHydrator — Invisible component. Renders null. Zero UI.
 *
 * Reads URL search params on first mount and hydrates the CRM store
 * with session context (entry source, table ID, order context).
 * Also fires the 'view_menu' analytics event.
 *
 * Why a component instead of middleware or a hook on the root layout?
 * - Next.js App Router layouts are server components; URL params must be
 *   read client-side via useSearchParams (requires Suspense boundary).
 * - Mounting here keeps all CRM boot logic in one place, away from page components.
 * - The `useEffect` with an empty dep array guarantees it runs exactly once per
 *   full page load (not on soft navigations).
 */

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCrmStore, inferEntrySource, inferOrderContext } from '@/store/crmStore'
import { track } from '@/utils/analytics'
import { captureAttribution } from '@/utils/attribution'

export function SessionHydrator() {
  const searchParams = useSearchParams()
  const setSession = useCrmStore((s) => s.setSession)
  const sessionId = useCrmStore((s) => s.sessionId)

  useEffect(() => {
    const mesa       = searchParams.get('mesa')
    const utmSource  = searchParams.get('utm_source')
    const contexto   = searchParams.get('contexto')

    const entrySource  = inferEntrySource(utmSource)
    const orderContext = inferOrderContext({ mesa, contexto })

    setSession({
      entrySource,
      orderContext,
      // Only overwrite tableId if the URL explicitly carries one.
      // Preserves manually selected table between refreshes.
      ...(mesa ? { tableId: mesa } : {}),
    })

    // Capture UTM / click-ID / referrer attribution for conversion tracking.
    // Writes first-touch (once) and last-touch (always) to localStorage.
    captureAttribution()

    track('view_menu', sessionId, {
      entrySource,
      orderContext,
      ...(mesa ? { tableId: mesa } : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  return null
}
