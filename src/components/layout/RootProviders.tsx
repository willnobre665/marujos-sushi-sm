'use client'

import { type ReactNode, Suspense } from 'react'
import { FloatingCartBar } from './FloatingCartBar'
import { SessionHydrator } from '@/components/crm/SessionHydrator'
import { EventSyncBootstrap } from '@/components/crm/EventSyncBootstrap'

interface RootProvidersProps {
  children: ReactNode
}

/**
 * Wrapper de providers globais do app.
 * FloatingCartBar is mounted here — outside all page transitions — so that
 * position:fixed is never inside a composited Framer Motion ancestor, which
 * would break hit-testing on iOS Safari.
 *
 * SessionHydrator reads URL search params (requires Suspense in App Router)
 * and hydrates the CRM store with entry source + table context on first load.
 * It renders null — zero UI impact.
 */
export function RootProviders({ children }: RootProvidersProps) {
  return (
    <>
      <EventSyncBootstrap />
      <Suspense fallback={null}>
        <SessionHydrator />
      </Suspense>
      {children}
      <FloatingCartBar />
    </>
  )
}
