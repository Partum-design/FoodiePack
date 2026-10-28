import { ArrowLeft, ShoppingBag } from 'lucide-react'
import Logo from './Logo'

/** Slim header for the secondary pages (carta semanal, legal). */
export default function SiteHeader({ cta = 'Pedir ahora' }: { cta?: string }) {
  return (
    <header className="fp-header is-scrolled">
      <div className="fp-header__inner">
        <a className="fp-icon-btn fp-header__back" href="/" aria-label="Volver a la tienda"><ArrowLeft size={20} /></a>
        <a className="fp-header__logo" href="/" aria-label="FoodiePack, inicio"><Logo horizontal /></a>
        <nav className="fp-header__nav" aria-label="Secciones">
          <a href="/#menu">Menú del día</a>
          <a href="/#paquetes">Paquetes</a>
          <a href="/menu-semana">Carta semanal</a>
        </nav>
        <div className="fp-header__actions">
          <a className="fp-cart-btn" href="/#menu"><ShoppingBag size={19} /><span>{cta}</span></a>
        </div>
      </div>
    </header>
  )
}
