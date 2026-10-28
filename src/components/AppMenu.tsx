import { useEffect } from 'react'
import { BellRing, CalendarDays, ChevronRight, Clock3, Download, MapPin, ReceiptText, ShoppingBag, Sparkles, Utensils, X } from 'lucide-react'
import { enablePush, usePushPermission } from '../lib/push'
import { WhatsAppIcon } from './SocialIcons'
import { trackWhatsAppLead } from '../lib/analytics'
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from '../lib/contact'
import { money } from '../lib/format'
import { PACKAGES } from '../packages'

type AppMenuProps = {
  open: boolean
  badgeCount: number
  weeklySavings: number
  onClose: () => void
  onGoMenu: () => void
  onGoWeek: () => void
  onGoPackages: () => void
  onGoOrder: () => void
  onGoApp: () => void
  onGoMyOrders: () => void
}

/** Side drawer used on phones and tablets, where the header has no room for links. */
export default function AppMenu({
  open, badgeCount, weeklySavings, onClose, onGoMenu, onGoWeek, onGoPackages, onGoOrder, onGoApp, onGoMyOrders,
}: AppMenuProps) {
  const permission = usePushPermission()
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const pick = (action: () => void) => () => { onClose(); action() }

  const items = [
    { icon: <Utensils size={19} />, label: 'Menú del día', hint: 'Guisados del próximo día hábil', action: onGoMenu },
    { icon: <CalendarDays size={19} />, label: 'Plan semanal', hint: `Ahorra hasta ${money(weeklySavings)}`, action: onGoWeek },
    { icon: <Sparkles size={19} />, label: 'Paquetes', hint: `Desde ${money(PACKAGES.economico.dailyPrice)} por día`, action: onGoPackages },
    { icon: <ReceiptText size={19} />, label: 'Mis pedidos', hint: 'Revisa si ya los aceptaron', action: onGoMyOrders },
    { icon: <ShoppingBag size={19} />, label: 'Mi pedido', hint: badgeCount > 0 ? `${badgeCount} ${badgeCount === 1 ? 'persona' : 'personas'}` : 'Aún vacío', action: onGoOrder, badge: badgeCount },
    { icon: <Download size={19} />, label: 'Descarga la app', hint: 'Gratis, en tu pantalla de inicio', action: onGoApp },
  ]

  return (
    <>
      <button className="fp-sheet-backdrop" aria-label="Cerrar menú" onClick={onClose} />
      <aside className="fp-drawer" id="app-menu" role="dialog" aria-modal="true" aria-label="Menú de navegación">
        <div className="fp-drawer__head">
          <img src="/assets/brand/logo-horizontal.png" alt="FoodiePack" />
          <button className="fp-icon-btn" onClick={onClose} aria-label="Cerrar menú"><X size={19} /></button>
        </div>
        <nav className="fp-drawer__list" aria-label="Secciones">
          {items.map((item, index) => (
            <button type="button" key={item.label} onClick={pick(item.action)} style={{ animationDelay: `${60 + index * 40}ms` }}>
              <i>{item.icon}</i>
              <span>{item.label}<small>{item.hint}</small></span>
              {item.badge ? <b>{item.badge}</b> : <ChevronRight size={17} />}
            </button>
          ))}
          <a href="/menu-semana" onClick={onClose} style={{ animationDelay: '260ms' }}>
            <i><CalendarDays size={19} /></i>
            <span>Carta de la semana<small>Arma tus 5 días por WhatsApp</small></span>
            <ChevronRight size={17} />
          </a>
        </nav>
        {(permission === 'default' || permission === 'granted') && (
          <button
            type="button"
            className={`fp-drawer__notify ${permission === 'granted' ? 'is-on' : ''}`}
            onClick={() => { if (permission !== 'granted') enablePush({ source: 'menu' }).catch(() => false) }}
          >
            <BellRing size={19} />
            <span>{permission === 'granted' ? 'Avisos activados' : 'Activar avisos'}<small>{permission === 'granted' ? 'Te avisamos de tus pedidos y el menú' : 'Pedido aceptado, menú del día y más'}</small></span>
            <i className="fp-switch" aria-hidden="true"><i /></i>
          </button>
        )}
        <a
          className="fp-drawer__whatsapp"
          href={buildWhatsAppUrl('Hola, quiero más información de FoodiePack')}
          target="_blank"
          rel="noreferrer"
          onClick={() => { onClose(); trackWhatsAppLead('menu') }}
        >
          <WhatsAppIcon size={20} /><span><small>¿Dudas? Escríbenos</small>{WHATSAPP_DISPLAY}</span>
        </a>
        <div className="fp-drawer__foot">
          <p><MapPin size={14} /> Lindavista, CDMX · envío gratis</p>
          <p><Clock3 size={14} /> Pedidos de 8:00 am a 6:00 pm</p>
        </div>
      </aside>
    </>
  )
}
