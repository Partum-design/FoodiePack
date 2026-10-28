import { Clock3, Facebook, Instagram, MapPin, MessageCircle } from 'lucide-react'
import { trackWhatsAppLead } from '../lib/analytics'
import { buildWhatsAppUrl, SOCIAL_LINKS, WHATSAPP_DISPLAY } from '../lib/contact'

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82c-.9-.87-1.45-2.06-1.5-3.4h-3.06v13.44c0 1.54-1.24 2.79-2.78 2.79a2.78 2.78 0 0 1-2.78-2.79c0-1.63 1.44-2.94 3.09-2.77v-3.1c-3.45-.24-6.14 2.51-6.14 5.87 0 3.24 2.62 5.85 5.83 5.85s5.83-2.62 5.83-5.85V9.01a8.7 8.7 0 0 0 4.78 1.44V7.42c-1.15 0-2.22-.36-3.1-.97a5.6 5.6 0 0 1-.17-.13c-.03-.02-.06-.05-.09-.07Z" />
    </svg>
  )
}

export default function Footer() {
  const whatsapp = buildWhatsAppUrl('Hola, quiero más información de FoodiePack')
  return (
    <footer className="fp-footer">
      <div className="fp-footer__band">
        <div className="fp-footer__band-inner">
          <img src="/assets/brand/logo-blanco-naranja.png" alt="FoodiePack" className="fp-footer__logo" />
          <a href={whatsapp} target="_blank" rel="noreferrer" onClick={() => trackWhatsAppLead('footer')} className="fp-footer__contact">
            <i><MessageCircle size={18} /></i><span><small>WhatsApp</small>{WHATSAPP_DISPLAY}</span>
          </a>
          <p className="fp-footer__contact"><i><Clock3 size={18} /></i><span><small>Pedidos</small>8:00 am – 6:00 pm</span></p>
          <div className="fp-footer__social">
            <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" aria-label="FoodiePack en Instagram"><Instagram size={18} /></a>
            <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" aria-label="FoodiePack en Facebook"><Facebook size={18} /></a>
            <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noreferrer" aria-label="FoodiePack en TikTok"><TikTokIcon /></a>
          </div>
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
        </div>
        <div className="fp-footer__bottom">
          <span>© {new Date().getFullYear()} FoodiePack · Tu cocina en la oficina</span>
          <a href="/privacidad">Aviso de privacidad</a>
        </div>
      </div>
    </footer>
  )
}
