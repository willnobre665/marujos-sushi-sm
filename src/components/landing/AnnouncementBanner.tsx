import type { AnuncioBanner } from '@/types/config'

interface Props {
  anuncio: AnuncioBanner
}

export function AnnouncementBanner({ anuncio }: Props) {
  if (!anuncio.ativo) return null
  if (anuncio.validade && new Date(anuncio.validade) < new Date()) return null

  return (
    <div className="relative w-full overflow-hidden bg-gold/[0.07] border-b border-gold/15">
      {/* Linha superior dourada fina */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="flex items-center justify-center gap-3 px-6 py-2.5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/20 max-w-[60px]" />
        <span className="text-gold/50 text-[8px]">✦</span>
        <p className="text-gold/90 text-[11px] font-sans font-medium tracking-[0.06em] text-center">
          {anuncio.texto}
        </p>
        <span className="text-gold/50 text-[8px]">✦</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/20 max-w-[60px]" />
      </div>
    </div>
  )
}
