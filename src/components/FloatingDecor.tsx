type DecorTone = 'dark' | 'light'

type FloatingDecorProps = {
  /** Sobre fondos verdes se usan destellos claros; sobre crema, hojas de marca. */
  tone?: DecorTone
  /** Versión discreta para bloques pequeños. */
  soft?: boolean
}

/** Hoja de la marca: la misma almendra puntiaguda del logotipo. */
function Leaf({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 40 54" aria-hidden="true">
      <path d="M20 1c13 12 13 30 0 52C7 31 7 13 20 1Z" />
    </svg>
  )
}

/** Chispas cortas, el mismo recurso gráfico de los flyers. */
function Sparks({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4v10M38 10l-6 7M10 10l6 7M4 30h9M44 30h-9" />
    </svg>
  )
}

/**
 * Capa decorativa de marca: burbujas suaves, hojas y chispas que respiran
 * detrás del contenido. Puramente visual, nunca captura el puntero.
 */
export default function FloatingDecor({ tone = 'dark', soft = false }: FloatingDecorProps) {
  return (
    <div className={`floating-decor floating-decor--${tone}${soft ? ' floating-decor--soft' : ''}`} aria-hidden="true">
      <span className="floating-decor__shape floating-decor__shape--1" />
      <span className="floating-decor__shape floating-decor__shape--2" />
      <span className="floating-decor__shape floating-decor__shape--3" />
      <span className="floating-decor__dot floating-decor__dot--1" />
      <span className="floating-decor__dot floating-decor__dot--2" />
      <span className="floating-decor__dot floating-decor__dot--3" />
      <Leaf className="floating-decor__leaf floating-decor__leaf--1" />
      <Leaf className="floating-decor__leaf floating-decor__leaf--2" />
      <Leaf className="floating-decor__leaf floating-decor__leaf--3" />
      <Leaf className="floating-decor__leaf floating-decor__leaf--4" />
      <Sparks className="floating-decor__sparks floating-decor__sparks--1" />
      <Sparks className="floating-decor__sparks floating-decor__sparks--2" />
      <svg className="floating-decor__sprout floating-decor__sprout--1" viewBox="0 0 40 34" aria-hidden="true">
        <path d="M20 33C20 33 20 20 8 14 2 11 0 4 0 4c0 0 9-2 15 4 5 5 5 12 5 12" />
        <path d="M20 33C20 33 20 18 32 12 38 9 40 2 40 2c0 0-9-2-15 4-5 5-5 12-5 12" />
      </svg>
      <svg className="floating-decor__sprout floating-decor__sprout--2" viewBox="0 0 40 34" aria-hidden="true">
        <path d="M20 33C20 33 20 20 8 14 2 11 0 4 0 4c0 0 9-2 15 4 5 5 5 12 5 12" />
        <path d="M20 33C20 33 20 18 32 12 38 9 40 2 40 2c0 0-9-2-15 4-5 5-5 12-5 12" />
      </svg>
    </div>
  )
}
