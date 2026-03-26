/**
 * surveyService — Envio e consulta de pesquisas de satisfação.
 *
 * Troca o adapter aqui para alternar entre mock e Saipos.
 */
import { mockSurveyAdapter } from './adapters/mockAdapter'
import type { SurveyAdapter } from './adapters/types'
import type { NovaPesquisa } from '@/types/survey'

// Para usar backend real no futuro: substituir adapter
const adapter: SurveyAdapter = mockSurveyAdapter

export const surveyService = {
  enviarPesquisa: (dados: NovaPesquisa) => adapter.enviarPesquisa(dados),
  buscarPesquisaPorPedido: (pedidoId: string) => adapter.buscarPesquisaPorPedido(pedidoId),
}
