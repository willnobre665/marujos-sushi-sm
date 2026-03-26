import { configService } from '@/services/configService'
import { PageTransition } from '@/components/layout/PageTransition'
import { AnnouncementBanner } from '@/components/landing/AnnouncementBanner'
import { HeroSection } from '@/components/landing/HeroSection'

export default async function LandingPage({
  searchParams,
}: {
  searchParams: { mesa?: string }
}) {
  const config = configService.getConfig()

  return (
    <PageTransition>
      <main className="min-h-dvh bg-background overflow-x-hidden">

        {/* Banner de anúncio — aparece no topo se ativo */}
        {config.anuncio?.ativo && <AnnouncementBanner anuncio={config.anuncio} />}

        {/* Hero — tela completa de entrada */}
        <HeroSection
          slogan={config.slogan}
          whatsapp={config.whatsapp}
          mesa={searchParams.mesa}
        />

      </main>
    </PageTransition>
  )
}
