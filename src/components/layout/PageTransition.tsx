'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface PageTransitionProps {
  children: ReactNode
}

// Opacity-only transition: no transform/translate so that position:fixed children
// (sticky CTAs, checkout footer) anchor to the viewport correctly on iOS Safari.
// A y-translate on a parent creates a new stacking context that breaks fixed positioning.
const variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
