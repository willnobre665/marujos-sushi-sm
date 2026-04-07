'use client'

export function StoryVideo() {
  return (
    <div
      style={{
        position: 'relative',
        marginTop: '5rem',
        marginLeft: 'clamp(-1.5rem, -4vw, -6rem)',
        marginRight: 'clamp(-1.5rem, -4vw, -6rem)',
      }}
    >
      {/* Section label — aligned with content padding */}
      <div
        style={{
          paddingLeft: 'clamp(1.5rem, 4vw, 6rem)',
          paddingRight: 'clamp(1.5rem, 4vw, 6rem)',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
        }}
      >
        <div style={{ width: 20, height: 1, backgroundColor: '#C9A84C', opacity: 0.6 }} />
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            color: '#C9A84C',
            fontSize: 10,
            letterSpacing: '0.5em',
            textTransform: 'uppercase',
            opacity: 0.7,
          }}
        >
          A história
        </span>
      </div>

      {/* Video frame */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '21 / 9',
          backgroundColor: '#020202',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px rgba(201,168,76,0.05)',
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Vídeo da história do Marujos Sushi"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'brightness(0.7) contrast(1.08) saturate(0.85)',
          }}
        >
          <source src="https://www.w3schools.com/howto/rain.mp4" type="video/mp4" />
        </video>

        {/* Top gradient */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(6,6,6,0.65) 0%, transparent 22%)',
          }}
        />
        {/* Bottom gradient */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'linear-gradient(to top, rgba(6,6,6,0.65) 0%, transparent 22%)',
          }}
        />
        {/* Side vignettes */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            boxShadow: 'inset 80px 0 100px rgba(6,6,6,0.5), inset -80px 0 100px rgba(6,6,6,0.5)',
          }}
        />
      </div>

      {/* Caption */}
      <div
        style={{
          paddingLeft: 'clamp(1.5rem, 4vw, 6rem)',
          paddingRight: 'clamp(1.5rem, 4vw, 6rem)',
          marginTop: '1.25rem',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            color: '#1e1e1e',
            fontSize: 10,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
          }}
        >
          Marujos Sushi · Caçapava do Sul
        </span>
      </div>
    </div>
  )
}
