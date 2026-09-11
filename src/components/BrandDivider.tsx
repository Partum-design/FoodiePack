type BrandDividerProps = {
  /** `down` cierra un bloque oscuro, `up` abre el siguiente sobre el fondo crema. */
  direction?: 'down' | 'up'
  /** Color de la onda; debe coincidir con el fondo del bloque que sigue. */
  tone?: 'cream' | 'white' | 'green'
  /** Se ancla al pie de la sección anterior, recortándose contra su fondo. */
  overlay?: boolean
}

const CURVES = {
  down: 'M0 0c180 78 420 118 720 118S1260 78 1440 0v122H0Z',
  up: 'M0 122c180-78 420-118 720-118s540 40 720 118V0H0Z',
}

/**
 * Transición orgánica entre secciones, en el mismo espíritu redondeado
 * del logotipo y de los flyers de la marca.
 */
export default function BrandDivider({ direction = 'down', tone = 'cream', overlay = false }: BrandDividerProps) {
  return (
    <div
      className={`brand-divider brand-divider--${direction} brand-divider--${tone}${overlay ? ' brand-divider--overlay' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 122" preserveAspectRatio="none" focusable="false">
        <path d={CURVES[direction]} />
      </svg>
    </div>
  )
}
