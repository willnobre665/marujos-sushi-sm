'use client'

import { useEffect } from 'react'
import { registerSyncListeners, syncEvents } from '@/utils/eventSync'

/**
 * EventSyncBootstrap — mounts once at app root.
 *
 * Responsibilities:
 * 1. Register browser lifecycle listeners (visibility, online, pagehide).
 * 2. Attempt to drain any events that survived a previous page refresh.
 *
 * Renders nothing — zero UI impact.
 */
export function EventSyncBootstrap() {
  useEffect(() => {
    registerSyncListeners()
    // Flush events that were queued in a previous session and never sent.
    syncEvents()
  }, [])

  return null
}
