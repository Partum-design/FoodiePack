import { Clock3, MapPin } from 'lucide-react'
import { trackWhatsAppLead } from '../lib/analytics'
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from '../lib/contact'
import { SocialLinks, WhatsAppIcon } from './SocialIcons'

export default function Footer() {
  const whatsapp = buildWhatsAppUrl('Hola, quiero más información de FoodiePack')
  return (
    <footer className="fp-footer">
      <div className="fp-footer__band">
        <div className="fp-footer__band-inner">
          <a href="/" aria-label="FoodiePack, inicio"><img src="/assets/brand/logo-blanco-naranja.png" alt="FoodiePack" className="fp-footer__logo" /></a>
          <div className="fp-footer__contacts">
            <a href={whatsapp} target="_blank" rel="noreferrer" onClick={() => trackWhatsAppLead('footer')} className="fp-footer__contact">
              <i className="is-wa"><WhatsAppIcon size={18} /></i><span><small>WhatsApp</small>{WHATSAPP_DISPLAY}</span>
            </a>
            <p className="fp-footer__contact"><i><Clock3 size={18} /></i><span><small>Pedidos</small>8:00 am – 6:00 pm</span></p>
          </div>
          <SocialLinks />
        </div>
      </div>
      <div className="fp-footer__main">
        <div className="fp-footer__cols">
          <div>
            <h3>FoodiePack</h3>
            <p>Comida casera recién hecha, lista para tu semana, con entrega gratis a tu oficina.</p>
          </div>
          <div>
            <h3>Ordena</h3>
            <a href="/#menu">Menú del día</a>
            <a href="/#paquetes">Paquetes</a>
            <a href="/menu-semana">Carta de la semana</a>
            <a href="/#app">Descarga la app</a>
          </div>
          <div>
            <h3>Entregas</h3>
            <p><MapPin size={14} /> Lindavista Sur y San Felipe de Jesús, CDMX</p>
            <p><Clock3 size={14} /> De 12:00 a 2:00 pm, lunes a viernes</p>
          </div>
          <div>
            <h3>Legal</h3>
            <a href="/terminos">Términos y condiciones</a>
            <a href="/privacidad">Aviso de privacidad</a>
          </div>
        </div>
        <div className="fp-footer__bottom">
          <span>© {new Date().getFullYear()} FoodiePack · Tu cocina en la oficina</span>
          <span><a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a></span>
        </div>
      </div>
    </footer>
  )
}
