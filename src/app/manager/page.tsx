'use client'

export default function ManagerPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', color: '#F5F0E8', fontFamily: 'Inter, system-ui, sans-serif', padding: '48px 32px' }}>
      <p style={{ color: '#3a3a3a', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
        Painel Interno
      </p>
      <h1 style={{ color: '#C9A84C', fontFamily: 'var(--font-playfair, serif)', fontSize: 24, fontWeight: 700, marginBottom: 40 }}>
        Marujos Sushi
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, maxWidth: 900 }}>
        {[
          { label: 'CRM — Clientes',    href: '/manager/crm' },
          { label: 'Kanban',             href: '/crm-kanban' },
          { label: 'Campanhas',          href: '/campaigns' },
          { label: 'Automações',         href: '/crm-automacoes' },
          { label: 'CMV',                href: '/cmv' },
          { label: 'Financeiro',         href: '/finance' },
          { label: 'Produção',           href: '/production' },
        ].map(({ label, href }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'block',
              padding: '18px 20px',
              backgroundColor: '#0d0d0d',
              border: '1px solid #1a1a1a',
              borderRadius: 12,
              color: '#F5F0E8',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </a>
        ))}
      </div>

      <div style={{ marginTop: 48 }}>
        <button
          onClick={() => {
            document.cookie = 'sb-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
            window.location.href = '/login'
          }}
          style={{ background: 'none', border: '1px solid #1e1e1e', borderRadius: 8, color: '#444', fontSize: 12, cursor: 'pointer', padding: '6px 14px' }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}
