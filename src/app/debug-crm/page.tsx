/**
 * /debug-crm — CRM pipeline validation page.
 *
 * BLOCKED in production (redirects to /). Use only during development.
 *
 * What this page shows:
 * 1. Local queue state (events waiting to be synced)
 * 2. Last POST /api/crm/events response
 * 3. Supabase snapshot: recent events, customers, orders, consent logs
 *
 * How to use:
 *   1. Open http://localhost:3000/debug-crm in a second tab.
 *   2. Interact with the menu (add to cart, checkout, etc.) in the first tab.
 *   3. Click "Refresh" to see the updated pipeline state.
 */

import { redirect } from 'next/navigation'
import { DebugPanel } from './DebugPanel'

export const metadata = { title: 'CRM Debug — Marujos' }

export default function DebugCrmPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/')
  }
  return <DebugPanel />
}
