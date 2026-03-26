'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  src: string
  alt: string
  sizes: string
  fallback: React.ReactNode
  className?: string
}

/**
 * Tenta carregar a imagem real. Se falhar (404, rede, etc.),
 * exibe o fallback CSS sem quebrar o layout.
 */
export function ImageWithFallback({ src, alt, sizes, fallback, className = '' }: Props) {
  const [erro, setErro] = useState(false)

  if (erro) {
    return <>{fallback}</>
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={`object-cover ${className}`}
      sizes={sizes}
      onError={() => setErro(true)}
    />
  )
}
