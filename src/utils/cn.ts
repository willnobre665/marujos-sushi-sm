/**
 * Combina classes CSS condicionalmente.
 * Alternativa leve ao clsx/classnames.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
