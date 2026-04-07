'use client'

export type Unit = {
  city: string
  state: string
  hours: string
  note: string
  whatsapp: string
  instagram: string
  menu: string
}

export function UnitCards({ units }: { units: Unit[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-3 mb-16 max-w-2xl">
      {units.map((u, i) => (
        <div
          key={u.city}
          className="group relative flex flex-col justify-between overflow-hidden"
          style={{
            minHeight: 290,
            backgroundColor: '#080808',
            border: '1px solid #161616',
            transition: 'border-color 0.4s, box-shadow 0.4s, transform 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'rgba(201,168,76,0.28)'
            el.style.boxShadow = '0 16px 70px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.1), inset 0 1px 0 rgba(201,168,76,0.08)'
            el.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = '#161616'
            el.style.boxShadow = 'none'
            el.style.transform = 'translateY(0)'
          }}
        >
          {/* Corner accent — top left */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 32, height: 1,
              background: 'linear-gradient(to right, rgba(201,168,76,0.5), transparent)',
              transition: 'opacity 0.5s',
            }}
            className="opacity-0 group-hover:opacity-100"
          />
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 1, height: 32,
              background: 'linear-gradient(to bottom, rgba(201,168,76,0.5), transparent)',
              transition: 'opacity 0.5s',
            }}
            className="opacity-0 group-hover:opacity-100"
          />

          <div className="p-9 pb-8">
            {/* Location type badge */}
            <div
              className="text-[9px] tracking-[0.5em] uppercase mb-6"
              style={{
                fontFamily: 'Inter, sans-serif',
                color: i === 0 ? 'rgba(201,168,76,0.6)' : 'rgba(201,168,76,0.35)',
              }}
            >
              {u.note}
            </div>

            {/* City name — dominant */}
            <div
              className="text-[#F5F0E8] leading-tight mb-2"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(26px, 3.5vw, 38px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {u.city}
            </div>

            {/* State + hours */}
            <div className="flex items-center gap-3 mt-3">
              <span
                className="text-[#272727] text-[10px] tracking-[0.4em] uppercase"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {u.state}
              </span>
              <div className="w-px h-2.5 bg-[#1e1e1e]" />
              <span
                className="text-[#272727] text-[10px] tracking-[0.2em]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {u.hours}
              </span>
            </div>
          </div>

          {/* Bottom action bar */}
          <div
            className="mx-9 mb-9 pt-6 border-t border-[#111] group-hover:border-[#1e1e1e] transition-colors duration-500"
          >
            {/* Primary — WhatsApp */}
            <a
              href={u.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between mb-5 group/wa rounded-sm"
              style={{
                padding: '0.6rem 0.75rem',
                margin: '-0.6rem -0.75rem',
                transition: 'background 0.3s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span
                className="text-[#C9A84C] text-[11px] tracking-[0.4em] uppercase group-hover/wa:text-[#e8c96a] transition-colors duration-200"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                Pedir agora
              </span>
              <span
                className="w-7 h-7 border border-[#C9A84C55] group-hover/wa:border-[#C9A84C] group-hover/wa:bg-[#C9A84C15] rounded-full flex items-center justify-center transition-all duration-200 shrink-0"
                style={{ color: '#C9A84C', fontSize: 13 }}
              >
                ↗
              </span>
            </a>

            {/* Secondary */}
            <div className="flex items-center gap-5">
              <a
                href={u.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#252525] hover:text-[#666] transition-colors duration-300 text-[10px] tracking-[0.35em] uppercase"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Instagram
              </a>
              <div className="w-px h-3 bg-[#1a1a1a]" />
              <a
                href={u.menu}
                className="text-[#222] hover:text-[#555] transition-colors duration-300 text-[10px] tracking-[0.35em] uppercase"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Cardápio
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
