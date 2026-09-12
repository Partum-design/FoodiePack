type LogoProps = {
  /** Lockup reducido, para barras y encabezados compactos. */
  compact?: boolean
  /** Lockup grande, para portada, acceso y preloader. */
  hero?: boolean
  /** Lockup ancho, pensado para una barra superior. */
  horizontal?: boolean
  /** Arte oficial según el fondo: verde/naranja sobre claros, blanco sobre oscuros. */
  theme?: 'color' | 'white'
}

const ARTWORK = {
  color: '/assets/brand/logo-verde-naranja.png',
  white: '/assets/brand/logo-blanco-naranja.png',
}

const ALT = 'FoodiePack — Tu cocina a la oficina'

export default function Logo({ compact = false, hero = false, horizontal = false, theme = 'color' }: LogoProps) {
  if (horizontal) {
    return <img src="/assets/brand/logo-horizontal.png" alt={ALT} className="logo-horizontal" />
  }
  if (hero) {
    return <img src={ARTWORK[theme]} alt={ALT} className="logo-hero" loading="eager" decoding="async" />
  }
  return (
    <img
      src={ARTWORK[theme]}
      alt={ALT}
      className={`logo-lockup${compact ? ' logo-lockup--compact' : ''}`}
      loading="lazy"
      decoding="async"
    />
  )
}
