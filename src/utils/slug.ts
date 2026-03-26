/**
 * Gera um slug URL-friendly a partir de um texto.
 * @example gerarSlug("Uramaki Salmão Especial") → "uramaki-salmao-especial"
 */
export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // remove caracteres especiais
    .replace(/\s+/g, '-')           // espaços → hífens
    .replace(/-+/g, '-')            // múltiplos hífens → um
}
