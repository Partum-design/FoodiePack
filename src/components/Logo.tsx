type LogoProps = {
  compact?: boolean
  /** Renders the full official logo artwork instead of the compact CSS lockup. */
  hero?: boolean
  /** Which official artwork to use when `hero` is set: for light or dark backgrounds. */
  theme?: 'color' | 'white'
}

export default function Logo({ compact = false, hero = false, theme = 'color' }: LogoProps) {
  if (hero) {
    const src = theme === 'white' ? '/assets/brand/logo-blanco-naranja.png' : '/assets/brand/logo-verde-naranja.png'
    return <img src={src} alt="FoodiePack — Tu cocina a la oficina" className="logo-hero" />
  }
  return (
    <div className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="FoodiePack">
      <span className="logo__mark" aria-hidden="true"><i /><b /></span>
      <span className="logo__word"><b>Foodie</b><strong>Pack</strong></span>
    </div>
  )
}
