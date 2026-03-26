# CRM Pipeline — End-to-End Validation Checklist

Use this document to manually verify that every stage of the event pipeline
works correctly from menu interaction through to Supabase persistence.

---

## Setup

### 1. Confirm environment

```bash
# .env.local must have:
NEXT_PUBLIC_CRM_EVENTS_ENDPOINT=/api/crm/events
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Run Supabase SQL schema

Paste `supabase_schema.sql` into the Supabase SQL Editor and execute.
Confirm these tables exist: `crm_clientes`, `crm_pedidos`, `crm_events_raw`,
`crm_consent_logs`, `crm_mensagens`, `crm_campanhas`.

### 3. Enable debug logging (browser console)

```js
localStorage.setItem('crm_debug', '1')
```

This activates `[CRM sync]` log lines in the console. Remove with
`localStorage.removeItem('crm_debug')` when done.

### 4. Open the debug panel

In a second browser tab: `http://localhost:3000/debug-crm`

Click **Refresh** after each test to see the updated Supabase snapshot.

---

## Tests

### T-01 — add_to_cart (combo product)

**Action:** Click "Adicionar" on any combo card on the menu.

**Expected event emitted:**
```json
{ "event": "add_to_cart", "data": { "productId": "...", "withUpsell": true } }
```

**Expected queue behavior:**
- Event appears in the Local Queue section of the debug panel immediately.
- Within ~1 second, `[CRM sync] syncing 1 event(s) ["add_to_cart"]` appears in console.
- Queue empties after sync.

**Expected Supabase:**
- `crm_events_raw` → 1 new row with `event_name = 'add_to_cart'`.
- `crm_clientes` → no change (behavioral signal, no customer identity yet).
- `crm_pedidos` → no change.
- `crm_consent_logs` → no change.

---

### T-02 — add_to_cart (non-combo product, from product detail page)

**Action:** Open any non-combo product → select options → click "Adicionar ao pedido".

**Expected event emitted:**
```json
{ "event": "add_to_cart", "data": { "productId": "...", "withUpsell": false } }
```
(withUpsell is true only when the upsell toggle is ON)

**Expected Supabase:**
- `crm_events_raw` → 1 new row with `event_name = 'add_to_cart'`.

---

### T-03 — upsell_clicked (accept)

**Action:** On a product detail page that shows a upsell suggestion, toggle the upsell ON.

**Expected event emitted:**
```json
{ "event": "upsell_clicked", "data": { "accepted": true } }
```

**Expected Supabase:**
- `crm_events_raw` → 1 row with `event_name = 'upsell_clicked'`.

**Action:** Toggle upsell OFF.

**Expected event:** same event with `"accepted": false`.

---

### T-04 — Full checkout (customer_identified + customer_opt_in + order_completed)

This is the most important test. It exercises all three identity/order events in sequence.

**Action:**
1. Add at least one item to the cart.
2. Proceed to checkout.
3. Fill in:
   - Nome: `Teste Validação`
   - Telefone: `(11) 98765-4321`
   - Check the "Receber atualizações via WhatsApp" checkbox.
4. Select payment method, confirm the order.

**Expected events emitted (in order):**
```
customer_identified  → phone: "5511987654321", consentOrderUpdates: true
customer_opt_in      → category: "transactional"
order_completed      → orderId, orderNumber, items[], total
```

**Expected console output:**
```
[CRM sync] syncing 3 event(s) ["customer_identified", "customer_opt_in", "order_completed"]
[CRM sync] batch of 3 acknowledged — queue remaining: 0
[CRM sync] sync complete ✓
```

**Expected Supabase — crm_events_raw:**
- 3 new rows: `customer_identified`, `customer_opt_in`, `order_completed`.

**Expected Supabase — crm_clientes:**
- 1 new row (or updated if phone already exists):
  - `phone = '5511987654321'`
  - `name = 'Teste Validação'`
  - `order_count = 1`
  - `total_spent_centavos = <order total>`
  - `consent_order_updates = true`
  - `consent_promotional = null` (not collected)
  - `first_seen_at` and `last_seen_at` set to order time
  - `last_order_at` set to order time

**Expected Supabase — crm_pedidos:**
- 1 new row:
  - `customer_phone = '5511987654321'`
  - `status = 'confirmed'`
  - `context = 'dine_in'` (or `'pickup'` depending on session)
  - `items` JSONB contains the ordered products
  - `total` matches the order total

**Expected Supabase — crm_consent_logs:**
- 1 new row:
  - `category = 'transactional'`
  - `granted = true`
  - `source = 'checkout_form'`
  - `event_id` matches the `customer_opt_in` event UUID in `crm_events_raw`

---

### T-05 — Checkout WITHOUT WhatsApp consent

**Action:** Same as T-04 but leave the "Receber atualizações" checkbox UNCHECKED.

**Expected events emitted:**
```
customer_identified  → consentOrderUpdates: false
(NO customer_opt_in)
order_completed
```

**Expected Supabase — crm_clientes:**
- `consent_order_updates = false`

**Expected Supabase — crm_consent_logs:**
- 0 new rows (opt-in event is only emitted when the box is checked).

---

### T-06 — Repeat order (same phone)

**Action:** Place a second order with the same phone number used in T-04.

**Expected Supabase — crm_clientes:**
- `order_count = 2`
- `total_spent_centavos = <T-04 total> + <T-06 total>`
- `last_order_at` updated to T-06 order time
- `first_seen_at` unchanged (still T-04)

**Expected Supabase — crm_pedidos:**
- 2 rows for this phone.

---

## Reliability Tests

### R-01 — Duplicate event prevention

**Setup:** Open browser DevTools → Application → Local Storage.

**Action:**
1. Enable debug: `localStorage.setItem('crm_debug', '1')`.
2. Add an item to cart. Note the event UUID in the Local Queue section of the debug panel.
3. Manually copy the `marujos_crm_queue` value from localStorage.
4. After the sync succeeds, paste the same JSON back into `marujos_crm_queue`.
5. Click **Force sync now** on the debug panel.

**Expected behavior:**
- Console shows `syncing 1 event(s)`.
- Supabase `crm_events_raw` does NOT get a duplicate row (same UUID ignored by `ON CONFLICT DO NOTHING`).
- Queue empties again.

---

### R-02 — Offline → online sync

**Action:**
1. In DevTools Network tab, set throttling to **Offline**.
2. Add a product to cart (triggers an `add_to_cart` event).
3. In the debug panel, observe the event is queued but sync fails.
4. Console shows retry backoff: `retry scheduled in 2000ms`.
5. Re-enable network (set throttling back to **No throttling**).
6. Wait up to 2 seconds, or click **Force sync now**.

**Expected behavior:**
- After network restoration, the `window.online` listener fires.
- `_failCount` resets, sync runs immediately.
- Event appears in `crm_events_raw`.

---

### R-03 — Page refresh (queue survives)

**Action:**
1. Set network to **Offline**.
2. Add a product to cart.
3. Hard-refresh the page (Cmd+Shift+R / Ctrl+Shift+R).
4. Re-enable network.

**Expected behavior:**
- On page load, `EventSyncBootstrap` calls `syncEvents()`.
- The queue is rehydrated from `marujos_crm_queue` in localStorage.
- Event is synced to Supabase.
- Console shows `[CRM sync] syncing 1 event(s)` on startup.

---

### R-04 — Malformed payload rejection

**Action:** Open browser console and run:
```js
await fetch('/api/crm/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ events: [{ id: 'not-a-uuid', ts: 'bad', sessionId: 's', payload: { event: 'add_to_cart', data: {} } }] })
})
```

**Expected response:**
```json
{ "error": "Validation failed", "details": { ... } }
```
HTTP 400. Nothing written to Supabase.

---

### R-05 — Batch delivery

**Action:**
1. Set network to **Offline**.
2. Add 5 different items to cart (or trigger 5 checkout events across multiple test orders).
3. Re-enable network.
4. Click **Force sync now** or wait for auto-sync.

**Expected behavior:**
- All 5 events sent in a single POST batch.
- Console: `[CRM sync] syncing 5 event(s) [...]`.
- 5 rows appear in `crm_events_raw`.
- Queue is empty after sync.

---

## Verification Queries (Supabase SQL Editor)

Run these to confirm the data shape directly:

```sql
-- Last 10 events received
SELECT id, event_name, ts, received_at
FROM crm_events_raw
ORDER BY received_at DESC
LIMIT 10;

-- Customer profile after checkout
SELECT phone, name, order_count, total_spent_centavos,
       consent_order_updates, consent_promotional,
       first_seen_at, last_order_at
FROM crm_clientes
ORDER BY updated_at DESC
LIMIT 5;

-- Orders
SELECT id, customer_phone, total, status, context, source, created_at
FROM crm_pedidos
ORDER BY created_at DESC
LIMIT 10;

-- Consent history for a specific phone
SELECT category, granted, granted_at, source
FROM crm_consent_logs
WHERE customer_phone = '5511987654321'
ORDER BY granted_at ASC;

-- Count duplicates (should always be 0)
SELECT id, COUNT(*) FROM crm_events_raw GROUP BY id HAVING COUNT(*) > 1;
SELECT id, COUNT(*) FROM crm_pedidos GROUP BY id HAVING COUNT(*) > 1;
```

---

## Pass/Fail Criteria

| Check | Pass condition |
|---|---|
| `crm_events_raw` receives events | Row count increases after each interaction |
| No duplicate rows | Duplicate query returns 0 rows |
| `crm_clientes` upserted correctly | order_count, total_spent, consent fields accurate |
| `crm_pedidos` linked to customer | customer_phone matches crm_clientes.phone |
| `crm_consent_logs` append-only | New row per opt-in/opt-out, old rows never modified |
| Offline queue persistence | Events survive page refresh and sync on reconnect |
| Retry backoff | Console shows scheduled delay on network failure |
| Malformed payload rejected | POST returns 400, Supabase untouched |
| Batch delivery | Multiple queued events sent in one POST |
