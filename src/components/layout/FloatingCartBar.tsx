'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/store/cartStore'
import { formatarPreco } from '@/utils/currency'

// Ticket médio ideal — mesmo valor do CartProgressBar
const TARGET = 12000

// ─── Allowlist: routes where the bar MAY appear ──────────────────────────────
// Only show on browsing/shopping pages. All other routes (home, checkout,
// cart, confirmation, product detail) are implicitly hidden.
//   /cardapio          — full menu list
//   /cardapio/[cat]    — single category list (exactly 1 segment under /cardapio)
function isAllowedRoute(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  // Must start with "cardapio" and have at most 1 additional segment
  return parts[0] === 'cardapio' && parts.length <= 2
}

function IconBag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M3 6h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FloatingCartBar() {
  const pathname = usePathname()
  const quantidadeTotal = useCartStore((s) => s.quantidadeTotal)
  const total = useCartStore((s) => s.total)
  const flashAt = useCartStore((s) => s.flashAt)
  const hasHydrated = useCartStore((s) => s._hasHydrated)

  const [flash, setFlash] = useState(false)

  // Trigger flash whenever a new item is added.
  // Guard: flashAt is null on SSR and on first mount, so this never fires
  // during hydration — only after a real adicionarItem/adicionarCombo call.
  useEffect(() => {
    if (!flashAt) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2000)
    return () => clearTimeout(t)
  }, [flashAt])

  // Do not render anything until Zustand has rehydrated from localStorage.
  // Without this guard, SSR renders the bar as hidden (empty cart), but the
  // client immediately re-renders it as visible (items in localStorage) →
  // Next.js hydration mismatch → "1 error" in dev overlay.
  if (!hasHydrated) return null

  const qtd = quantidadeTotal()
  const totalAtual = total()
  const progresso = Math.min(100, Math.round((totalAtual / TARGET) * 100))
  const completed = totalAtual >= TARGET

  const visible = isAllowedRoute(pathname) && qtd > 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="floating-cart-bar"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
          // Plain div wrapper — no transform on the Link/button ancestors
          // so position:fixed children of ProdutoClient stay unaffected.
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            paddingBottom: 'env(safe-area-inset-bottom)',
            // The bar itself is not inside any page's animated wrapper,
            // so iOS Safari fixed-positioning is reliable here.
          }}
        >
          <div
            style={{
              margin: '0 12px 12px',
            }}
          >
            <Link
              href="/carrinho"
              className="relative flex items-center rounded-2xl overflow-hidden active:scale-[0.985] transition-transform duration-150"
              style={{
                backgroundColor: '#C9A84C',
                boxShadow: '0 8px 32px rgba(201,168,76,0.28), 0 2px 8px rgba(0,0,0,0.40)',
              }}
              aria-label={`Ver sacola — ${qtd} ${qtd === 1 ? 'item' : 'itens'}, ${formatarPreco(totalAtual)}`}
            >
              {/* Left — bag icon + count pill */}
              <div
                className="flex items-center gap-2.5 px-4 py-4"
                style={{ minWidth: 0 }}
              >
                <div className="relative flex-shrink-0" style={{ color: '#0A0A0A' }}>
                  <IconBag />
                  {/* Count bubble */}
                  <span
                    className="absolute flex items-center justify-center font-sans font-bold"
                    style={{
                      top: '-7px',
                      right: '-8px',
                      minWidth: '17px',
                      height: '17px',
                      borderRadius: '99px',
                      backgroundColor: '#0A0A0A',
                      color: '#C9A84C',
                      fontSize: '9px',
                      paddingInline: '3px',
                      lineHeight: 1,
                    }}
                  >
                    {qtd > 99 ? '99+' : qtd}
                  </span>
                </div>

                {/* Flash message / label */}
                <AnimatePresence mode="wait">
                  {flash ? (
                    <motion.span
                      key="flash"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="font-sans font-semibold truncate"
                      style={{ fontSize: '14px', color: '#0A0A0A' }}
                    >
                      Item adicionado à sacola
                    </motion.span>
                  ) : (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="font-sans font-semibold truncate"
                      style={{ fontSize: '14px', color: '#0A0A0A' }}
                    >
                      {qtd} {qtd === 1 ? 'item' : 'itens'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Right — total + arrow */}
              <div
                className="flex items-center gap-2 px-4 py-4 ml-auto flex-shrink-0"
                style={{
                  borderLeft: '1px solid rgba(10,10,10,0.15)',
                  color: '#0A0A0A',
                }}
              >
                <span className="font-sans font-bold" style={{ fontSize: '14px' }}>
                  {formatarPreco(totalAtual)}
                </span>
                <IconArrowRight />
              </div>

              {/* Mini progress bar — bottom edge of the bar */}
              {!completed && (
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: '3px', backgroundColor: 'rgba(10,10,10,0.22)' }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progresso}%`,
                      backgroundColor: 'rgba(10,10,10,0.50)',
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
              )}
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
