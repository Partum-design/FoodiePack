type LogoProps = {
  /** Marca reducida para barras compactas. */
  compact?: boolean
  /** Lockup grande para portada, acceso y preloader. */
  hero?: boolean
  /** Arte oficial según el fondo: verde/naranja sobre claros, blanco/naranja sobre oscuros. */
  theme?: 'color' | 'white'
}

const ARTWORK = {
  color: '/assets/brand/logo-verde-naranja.png',
  white: '/assets/brand/logo-blanco-naranja.png',
}

export default function Logo({ compact = false, hero = false, theme = 'color' }: LogoProps) {
  return (
    <img
      src={ARTWORK[theme]}
      alt="FoodiePack — Tu cocina a la oficina"
      className={hero ? 'logo-hero' : `logo-mark${compact ? ' logo-mark--compact' : ''}`}
      loading={hero ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}
