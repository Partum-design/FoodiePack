import { useEffect } from 'react'
import { CalendarDays, Clock3, MapPin, MessageCircle, ShoppingBag, Sparkles, Utensils } from 'lucide-react'
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
}

/**
 * Slide-down navigation used on phones and tablets, where the header has no room
 * for inline links. Rendered only while open so the entry animation replays each time.
 */
export default function AppMenu({
  open, badgeCount, weeklySavings, onClose, onGoMenu, onGoWeek, onGoPackages, onGoOrder,
}: AppMenuProps) {
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

  return (
    <>
      <button className="app-menu__backdrop" aria-label="Cerrar menú" onClick={onClose} />
      <div className="app-menu" id="app-menu" role="dialog" aria-modal="true" aria-label="Menú de navegación">
        <nav className="app-menu__list" aria-label="Secciones">
          <button type="button" onClick={pick(onGoMenu)}>
            <i><Utensils size={18} /></i>
            <span>Menú del día<small>Guisados del próximo día hábil</small></span>
          </button>
          <button type="button" onClick={pick(onGoWeek)}>
            <i><CalendarDays size={18} /></i>
            <span>Plan semanal<small>Ahorra hasta {money(weeklySavings)}</small></span>
          </button>
          <button type="button" onClick={pick(onGoPackages)}>
            <i><Sparkles size={18} /></i>
            <span>Paquetes<small>Desde {money(PACKAGES.economico.dailyPrice)} por día</small></span>
          </button>
          <button type="button" onClick={pick(onGoOrder)}>
            <i><ShoppingBag size={18} /></i>
            <span>Mi pedido<small>{badgeCount > 0 ? `${badgeCount} ${badgeCount === 1 ? 'persona' : 'personas'} en tu pedido` : 'Aún no eliges paquete'}</small></span>
            {badgeCount > 0 && <b>{badgeCount}</b>}
          </button>
          <a href="/menu-semana" onClick={onClose}>
            <i><CalendarDays size={18} /></i>
            <span>Carta de la semana<small>Arma tus 5 días y pide por WhatsApp</small></span>
          </a>
          <a
            href={buildWhatsAppUrl('Hola, quiero más información de FoodiePack')}
            target="_blank"
            rel="noreferrer"
            onClick={() => { onClose(); trackWhatsAppLead('menu') }}
          >
            <i><MessageCircle size={18} /></i>
            <span>WhatsApp<small>{WHATSAPP_DISPLAY}</small></span>
          </a>
        </nav>

        <div className="app-menu__foot">
          <p><MapPin size={14} /> Lindavista, CDMX · envío gratis</p>
          <p><Clock3 size={14} /> Pedidos de 8:00 am a 6:00 pm</p>
        </div>
      </div>
    </>
  )
}
