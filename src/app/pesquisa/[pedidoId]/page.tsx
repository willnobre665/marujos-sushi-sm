import { PageTransition } from '@/components/layout/PageTransition'

interface Props {
  params: { pedidoId: string }
}

// TODO Fase 4: Implementar pesquisa de satisfação (NPS + avaliações + comentários)
// Componentes: NpsSelector, SurveyQuestion, SurveyTextarea, SurveyComplete
export default function PesquisaPage({ params }: Props) {
  return (
    <PageTransition>
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-ivory/40 text-sm">Pesquisa: #{params.pedidoId} — Fase 4</p>
      </main>
    </PageTransition>
  )
}
