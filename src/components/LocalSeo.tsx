import { ChevronDown, MapPin } from 'lucide-react'
import { money } from '../lib/format'
import { PACKAGES } from '../packages'

// Keep in sync with the areaServed list in index.html.
const DELIVERY_AREAS = [
  'Lindavista Norte', 'Lindavista Sur', 'Planetario Lindavista', 'Torres Lindavista', 'Tepeyac Insurgentes',
  'Churubusco Tepeyac', 'Valle del Tepeyac', 'Magdalena de las Salinas', 'Residencial Zacatenco', 'San Felipe de Jesús',
]

const FAQ = [
  {
    q: '¿Entregan comida a domicilio en Lindavista?',
    a: 'Sí. Llevamos comida casera gratis a oficinas y casas en Lindavista y colonias cercanas de Gustavo A. Madero, a menos de 3 km a la redonda, de lunes a viernes entre 12:00 y 2:00 pm.',
  },
  {
    q: '¿Cuánto cuesta la comida del día?',
    a: `Económico ${money(PACKAGES.economico.dailyPrice)}, Ejecutivo ${money(PACKAGES.ejecutivo.dailyPrice)} y Foodie+ ${money(PACKAGES.completo.dailyPrice)} por día, con envío gratis. La semana completa pagada por adelantado sale desde ${money(PACKAGES.economico.weeklyPrepay)}.`,
  },
  { q: '¿Hasta qué hora puedo pedir?', a: 'De 8:00 am a 6:00 pm (hora de la Ciudad de México) para recibir al día siguiente hábil.' },
  { q: '¿Cómo pago?', a: 'Por transferencia, en efectivo al recibir o con tarjeta en la terminal del repartidor.' },
]

/** Visible local-search section: delivery areas and FAQ about ordering in Lindavista. */
export default function LocalSeo() {
  return (
    <section className="fp-section fp-local" aria-labelledby="local-title">
      <div className="fp-local__card">
        <div className="fp-local__intro">
          <span className="fp-eyebrow">Lindavista · Gustavo A. Madero</span>
          <h2 id="local-title">Comida casera a domicilio <em>en Lindavista</em></h2>
          <p>Comida corrida hecha el mismo día, lista para tu oficina. Sin costo de envío en estas colonias:</p>
          <ul className="fp-local__areas">
            {DELIVERY_AREAS.map((area) => <li key={area}><MapPin size={13} /> {area}</li>)}
          </ul>
        </div>
        <div className="fp-local__faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}<ChevronDown size={18} /></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
