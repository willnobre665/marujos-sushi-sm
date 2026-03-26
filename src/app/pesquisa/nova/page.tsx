import { PageTransition } from '@/components/layout/PageTransition'
import { PesquisaForm } from '@/components/pesquisa/PesquisaForm'

export default function PesquisaNovaPage() {
  return (
    <PageTransition>
      <main className="min-h-dvh bg-background flex flex-col items-center justify-center px-5 py-10">
        <PesquisaForm />
      </main>
    </PageTransition>
  )
}
