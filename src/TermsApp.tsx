import LegalLayout from './components/LegalLayout'
import { trackWhatsAppLead } from './lib/analytics'
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from './lib/contact'
import { money } from './lib/format'
import { PACKAGE_ORDER, PACKAGES, REPEAT_GUISADO_SURCHARGE, UTENSILS_SURCHARGE } from './packages'

const UPDATED_AT = '28 de octubre de 2026'
const CANONICAL_URL = 'https://www.foodiepack.com.mx/terminos'

function ContactLink() {
  return (
    <a
      href={buildWhatsAppUrl('Hola, tengo una duda sobre los términos y condiciones de FoodiePack')}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackWhatsAppLead('terminos')}
    >
      WhatsApp {WHATSAPP_DISPLAY}
    </a>
  )
}

function TermsApp() {
  return (
    <LegalLayout
      kind="terms"
      title="Términos y condiciones"
      updatedAt={UPDATED_AT}
      canonical={CANONICAL_URL}
      lead="Estas son las reglas para pedir en FoodiePack. Las escribimos claras y cortas: al hacer un pedido en www.foodiepack.com.mx o por WhatsApp, las aceptas."
    >
      <section>
        <h2 id="terminos-servicio">1. El servicio</h2>
        <p>
          FoodiePack prepara comida casera y la entrega en oficinas y domicilios de Lindavista, Ciudad de México.
          Cada día hábil la cocina publica los guisados disponibles; tú eliges el guisado, el paquete y la guarnición.
          Las fotografías son ilustrativas: la presentación puede variar ligeramente.
        </p>
      </section>

      <section>
        <h2 id="terminos-pedidos">2. Horarios y cómo pedir</h2>
        <ul>
          <li><strong>Recibimos pedidos</strong> de lunes a viernes, de 8:00 am a 6:00 pm (hora de Ciudad de México), para entregar el siguiente día hábil.</li>
          <li><strong>Entregamos</strong> de 12:00 a 2:00 pm, de lunes a viernes. Sábados, domingos y días festivos no hay entregas.</li>
          <li>Puedes reservar hasta 5 días hábiles por adelantado, según los menús publicados.</li>
          <li>Tu pedido queda confirmado cuando ves la pantalla de “Pedido aceptado” o cuando te lo confirmamos por WhatsApp.</li>
          <li>Si un guisado se agota o hay un imprevisto en cocina, te avisaremos para cambiarlo por otro o cancelar sin costo.</li>
        </ul>
      </section>

      <section>
        <h2 id="terminos-precios">3. Paquetes y precios</h2>
        <p>Los precios están en pesos mexicanos e incluyen el envío dentro de la zona de entrega:</p>
        <ul>
          {PACKAGE_ORDER.map((tier) => {
            const pack = PACKAGES[tier]
            return (
              <li key={tier}>
                <strong>{pack.label}:</strong> {money(pack.dailyPrice)} por día ({pack.includes.join(', ').toLowerCase()}).
                Semana completa: {money(pack.weeklyRegular)}, o {money(pack.weeklyPrepay)} pagando por adelantado.
              </li>
            )
          })}
          <li>Repetir el mismo guisado en Foodie+ tiene un cargo de {money(REPEAT_GUISADO_SURCHARGE)}. Los cubiertos tienen un cargo de {money(UTENSILS_SURCHARGE)} cuando los pides.</li>
          <li>Los menús especiales (por ejemplo, pozole) tienen el precio único que se indica ese día.</li>
        </ul>
        <p>Podemos actualizar precios y menús en cualquier momento; los cambios no afectan pedidos ya confirmados.</p>
      </section>

      <section>
        <h2 id="terminos-pago">4. Formas de pago</h2>
        <ul>
          <li><strong>Transferencia:</strong> envía tu comprobante por WhatsApp. Tu pedido entra a producción cuando recibimos el comprobante, idealmente un día antes de la entrega.</li>
          <li><strong>Efectivo:</strong> pagas al recibir tu comida.</li>
          <li><strong>Tarjeta:</strong> el repartidor lleva terminal para cobrarte al entregar.</li>
        </ul>
        <p>
          El precio especial del plan semanal aplica solo si pagas la semana completa por adelantado mediante
          transferencia. El sitio no procesa pagos en línea ni guarda datos de tarjetas.
        </p>
      </section>

      <section>
        <h2 id="terminos-entrega">5. Zona y entrega</h2>
        <ul>
          <li>Entregamos sin costo a menos de 3 km a la redonda: Lindavista Sur, San Felipe de Jesús y alrededores. Si tu dirección queda fuera de la zona, te avisaremos antes de preparar tu pedido.</li>
          <li>Necesitamos una dirección exacta, la empresa u oficina, un teléfono de contacto y el pin en el mapa. Si los datos son incorrectos o no hay quien reciba, el pedido se considera entregado.</li>
          <li>El horario de 12:00 a 2:00 pm es una ventana estimada; tráfico, clima u otras causas ajenas pueden generar retrasos.</li>
        </ul>
      </section>

      <section>
        <h2 id="terminos-cambios">6. Cambios y cancelaciones</h2>
        <ul>
          <li>Puedes cambiar o cancelar tu pedido sin costo escribiéndonos por <ContactLink /> antes de las 6:00 pm del día anterior a la entrega.</li>
          <li>Después de esa hora la comida ya está programada en producción y no podemos cancelarla ni reembolsarla.</li>
          <li>En el plan semanal puedes pedirnos mover un día a otra fecha disponible avisando con la misma anticipación.</li>
          <li>Si cancelamos nosotros, te devolvemos el 100% de lo pagado o lo abonamos a tu siguiente pedido, como prefieras.</li>
        </ul>
      </section>

      <section>
        <h2 id="terminos-calidad">7. Calidad, alergias y reclamaciones</h2>
        <p>
          Cocinamos el mismo día de la entrega. Nuestros platillos pueden contener o tener contacto con alérgenos
          comunes (gluten, lácteos, huevo, cacahuate, mariscos, chile). Si tienes una alergia, avísanos en las
          indicaciones del pedido; aun así no podemos garantizar la ausencia total de trazas.
        </p>
        <p>
          Si algo llegó mal (faltante, platillo equivocado o en mal estado), escríbenos el mismo día con una foto
          por <ContactLink />. Revisaremos el caso y te repondremos el platillo o te reembolsaremos lo
          correspondiente. Consume tu comida el mismo día y mantenla en refrigeración si no la comes de inmediato.
        </p>
      </section>

      <section>
        <h2 id="terminos-app">8. Sitio, app y promociones</h2>
        <p>
          La app de FoodiePack se instala desde el navegador y funciona con el mismo sitio web. Las promociones son
          válidas en las fechas y condiciones que se publiquen y no son acumulables salvo que se indique. El contenido
          del sitio (logotipo, fotos y textos) es propiedad de FoodiePack.
        </p>
      </section>

      <section>
        <h2 id="terminos-legal">9. Privacidad y ley aplicable</h2>
        <p>
          Tratamos tus datos conforme a nuestro <a href="/privacidad">Aviso de privacidad</a>. Estos términos se rigen
          por las leyes de México, incluida la Ley Federal de Protección al Consumidor; para cualquier controversia
          puedes acudir a la Procuraduría Federal del Consumidor (PROFECO) o a los tribunales de la Ciudad de México.
        </p>
        <p>Si actualizamos estos términos, publicaremos la nueva versión aquí con su fecha.</p>
      </section>
    </LegalLayout>
  )
}

export default TermsApp
