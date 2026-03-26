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
        const expiresAt = data.session?.expires_at
        const expires = expiresAt ? new Date(expiresAt * 1000).toUTCString() : ''
        const secure = location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `sb-session=1; path=/; SameSite=Lax${secure}${expires ? `; expires=${expires}` : ''}`
        window.location.href = '/manager'
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
