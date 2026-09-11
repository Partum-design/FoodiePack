import { createElement, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { useReveal } from '../motion'

type RevealVariant = 'up' | 'fade' | 'scale' | 'left' | 'right' | 'mask'

type RevealProps = {
  /** Etiqueta real que se renderiza, para conservar la semántica de cada sección. */
  as?: ElementType
  variant?: RevealVariant
  /** Retraso en milisegundos, para escalonar bloques hermanos. */
  delay?: number
  threshold?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
} & Record<string, unknown>

/**
 * Envoltura de entrada por scroll. No agrega marcado extra: aplica las clases
 * de animación al propio elemento para no alterar los layouts existentes.
 */
export default function Reveal({
  as = 'div',
  variant = 'up',
  delay = 0,
  threshold,
  className = '',
  style,
  children,
  ...rest
}: RevealProps) {
  const { ref, visible } = useReveal<HTMLElement>(threshold === undefined ? undefined : { threshold })

  return createElement(
    as,
    {
      ...rest,
      ref,
      className: `${className} reveal reveal--${variant}${visible ? ' is-revealed' : ''}`.trim(),
      style: delay ? { ...style, '--reveal-delay': `${delay}ms` } as CSSProperties : style,
    },
    children,
  )
}
