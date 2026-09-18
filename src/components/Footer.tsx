import { Facebook, Instagram, MessageCircle } from 'lucide-react'
import { trackWhatsAppLead } from '../lib/analytics'
import { buildWhatsAppUrl, SOCIAL_LINKS, WHATSAPP_DISPLAY } from '../lib/contact'
import Logo from './Logo'

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82c-.9-.87-1.45-2.06-1.5-3.4h-3.06v13.44c0 1.54-1.24 2.79-2.78 2.79a2.78 2.78 0 0 1-2.78-2.79c0-1.63 1.44-2.94 3.09-2.77v-3.1c-3.45-.24-6.14 2.51-6.14 5.87 0 3.24 2.62 5.85 5.83 5.85s5.83-2.62 5.83-5.85V9.01a8.7 8.7 0 0 0 4.78 1.44V7.42c-1.15 0-2.22-.36-3.1-.97a5.6 5.6 0 0 1-.17-.13c-.03-.02-.06-.05-.09-.07Z" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Logo horizontal />
          <p>Comida casera lista para tu semana, con entrega gratis en Lindavista, CDMX.</p>
        </div>

        <div className="site-footer__block">
          <h3>Contáctanos</h3>
          <a
            className="site-footer__whatsapp"
            href={buildWhatsAppUrl('Hola, quiero más información de FoodiePack')}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWhatsAppLead('footer')}
          >
            <MessageCircle size={19} />
            <span>Escríbenos por WhatsApp</span>
            <strong>{WHATSAPP_DISPLAY}</strong>
          </a>
        </div>

        <div className="site-footer__block">
          <h3>Síguenos</h3>
          <div className="site-footer__social">
            <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" aria-label="FoodiePack en Instagram">
              <Instagram size={20} />
            </a>
            <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" aria-label="FoodiePack en Facebook">
              <Facebook size={20} />
            </a>
            <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noreferrer" aria-label="FoodiePack en TikTok">
              <TikTokIcon />
            </a>
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} FoodiePack · Lindavista, CDMX</span>
        <a href="/privacidad">Aviso de privacidad</a>
      </div>
    </footer>
  )
}
