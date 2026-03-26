export interface EnderecoEntrega {
  logradouro: string  // rua / avenida
  numero: string
  bairro: string
  referencia?: string // ponto de referência (opcional)
}

export interface DadosCliente {
  nome: string
  telefone?: string // apenas dígitos: "11987654321" — obrigatório em delivery, opcional em mesa
  email?: string
  dataNascimento?: string  // "DD/MM/AAAA" — optional, for birthday campaigns
  consentWhatsApp?: boolean // consent to receive WhatsApp marketing offers
}

export interface Sessao {
  mesa?: string              // string para aceitar "A3", "Varanda"
  cliente?: DadosCliente     // preenchido no checkout, persiste na visita
  pedidoAtualId?: string     // ID do último pedido confirmado na sessão
}
