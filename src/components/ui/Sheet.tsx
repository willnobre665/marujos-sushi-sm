'use client'

import { useEffect, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  className?: string
}

export function Sheet({ open, onClose, children, title, className }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-surface border-t border-border rounded-t-3xl',
          'max-h-[90dvh] overflow-y-auto',
          'pb-safe',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {title && (
          <div className="px-5 pb-4 border-b border-border">
            <h2 className="text-lg font-semibold text-ivory">{title}</h2>
          </div>
        )}

        {children}
      </div>
    </>
  )
}
