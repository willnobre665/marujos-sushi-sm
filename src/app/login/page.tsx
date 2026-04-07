'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        alert(error.message)
      } else {
        // Set the session cookie via a server response (Set-Cookie header) so it
        // is reliably committed before navigation — avoids the document.cookie
        // race on mobile Safari.
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresAt: data.session?.expires_at }),
        })
        const from = new URLSearchParams(window.location.search).get('from')
        window.location.href = from && from.startsWith('/') ? from : '/manager'
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300 }}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #333', backgroundColor: '#161616', color: '#fff', fontSize: 14 }}
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #333', backgroundColor: '#161616', color: '#fff', fontSize: 14 }}
        />
        <button
          onClick={handleClick}
          disabled={loading}
          style={{ padding: 12, borderRadius: 8, border: 'none', backgroundColor: '#C9A84C', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
