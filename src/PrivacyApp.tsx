import { useEffect } from 'react'
import Footer from './components/Footer'
import Logo from './components/Logo'
import { trackWhatsAppLead } from './lib/analytics'
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from './lib/contact'

const UPDATED_AT = '18 de septiembre de 2026'
const CANONICAL_URL = 'https://www.foodiepack.com.mx/privacidad'

function ContactLink() {
  return (
    <a
      href={buildWhatsAppUrl('Hola, tengo una duda sobre el aviso de privacidad de FoodiePack')}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackWhatsAppLead('privacidad')}
    >
      WhatsApp {WHATSAPP_DISPLAY}
    </a>
  )
}

function PrivacyApp() {
  useEffect(() => {
    document.title = 'FoodiePack · Aviso de privacidad'
    // index.html points its canonical at the storefront; this page is its own document.
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', CANONICAL_URL)
  }, [])

  return (
    <div className="legal-page">
      <header className="week-menu-page__header">
        <a href="/" aria-label="Ir a la tienda de FoodiePack"><Logo horizontal /></a>
        <a className="week-menu-page__back" href="/">‹ Tienda principal</a>
      </header>

      <main className="legal-page__body">
        <p className="legal-page__eyebrow">Legal</p>
        <h1>Aviso de privacidad</h1>
        <p className="legal-page__updated">Última actualización: {UPDATED_AT}</p>
        <p className="legal-page__lead">
          En FoodiePack cuidamos tus datos. Aquí te explicamos qué información recabamos cuando pides comida o
          navegas nuestro sitio, para qué la usamos y cómo puedes ejercer tus derechos.
        </p>

        <section aria-labelledby="privacy-responsable">
          <h2 id="privacy-responsable">¿Quién es el responsable de tus datos?</h2>
          <p>
            FoodiePack, servicio de comida casera con entrega en Lindavista, Ciudad de México
            (www.foodiepack.com.mx), es responsable del tratamiento de tus datos personales. Para cualquier asunto
            de privacidad escríbenos por <ContactLink />.
          </p>
        </section>

        <section aria-labelledby="privacy-datos">
          <h2 id="privacy-datos">¿Qué datos recabamos?</h2>
          <ul>
            <li><strong>Identificación y contacto:</strong> tu nombre y teléfono.</li>
            <li>
              <strong>Entrega:</strong> dirección, empresa, edificio u oficina, indicaciones y la ubicación del pin en
              el mapa. Usamos la ubicación de tu dispositivo solo si tocas «Usar mi ubicación» y aceptas el permiso
              de tu navegador.
            </li>
            <li><strong>Pedido:</strong> paquete y platillos elegidos, fecha de entrega, cantidad, forma de pago elegida e importe.</li>
            <li><strong>Mensajes:</strong> lo que nos envías por WhatsApp, incluidos los comprobantes de transferencia.</li>
            <li>
              <strong>Navegación:</strong> páginas que visitas, acciones dentro del sitio, tipo de dispositivo y
              navegador, y una ubicación aproximada, mediante Google Analytics.
            </li>
          </ul>
          <p>
            No solicitamos datos personales sensibles. Si decides compartir alguno en las indicaciones de tu pedido
            (por ejemplo, una alergia), lo usaremos únicamente para preparar y entregar tu pedido.
          </p>
          <p>
            Este sitio no procesa pagos en línea ni recibe números de tarjeta: pagas por transferencia, en efectivo o
            con la terminal del repartidor al recibir tu pedido.
          </p>
        </section>

        <section aria-labelledby="privacy-finalidades">
          <h2 id="privacy-finalidades">¿Para qué usamos tus datos?</h2>
          <p>Para darte el servicio (finalidades necesarias):</p>
          <ul>
            <li>Recibir, confirmar, preparar y entregar tu pedido.</li>
            <li>Contactarte por teléfono o WhatsApp para confirmar dirección, horario y pago.</li>
            <li>Conciliar tu pago, darte seguimiento y atender aclaraciones.</li>
            <li>Cumplir las obligaciones legales que nos apliquen.</li>
          </ul>
          <p>Finalidad adicional:</p>
          <ul>
            <li>Medir cómo se usa el sitio para mejorar el menú, la experiencia de compra y el servicio, con datos estadísticos.</li>
          </ul>
          <p>
            Si no quieres que tus datos de navegación se usen para esta finalidad adicional, puedes desactivar Google
            Analytics como se explica abajo o escribirnos. Esto no afecta tu pedido.
          </p>
        </section>

        <section aria-labelledby="privacy-cookies">
          <h2 id="privacy-cookies">Google Analytics, cookies y almacenamiento local</h2>
          <p>
            Usamos Google Analytics 4 (Google LLC) para saber cuántas personas visitan el sitio y qué acciones
            realizan: ver el menú, elegir un paquete, iniciar o confirmar un pedido y tocar el botón de WhatsApp.
            Google Analytics coloca cookies en tu navegador (<code>_ga</code> y <code>_ga_*</code>) para distinguir
            visitas y sesiones, y puede usar tu dirección IP para estimar una ubicación aproximada.
          </p>
          <p>
            No enviamos a Google Analytics tu nombre, teléfono, dirección ni las notas de tu pedido. Google trata la
            información conforme a sus propias políticas; puedes consultar{' '}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">cómo usa Google la información de los sitios que utilizan sus servicios</a>.
          </p>
          <p>
            Para desactivarlo, bloquea o elimina las cookies desde la configuración de tu navegador, o instala el{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">complemento de inhabilitación de Google Analytics</a>.
          </p>
          <p>
            Además, guardamos en tu dispositivo (almacenamiento local del navegador) tus platillos favoritos y si
            cerraste el aviso para instalar la app. Esa información no sale de tu dispositivo.
          </p>
        </section>

        <section aria-labelledby="privacy-terceros">
          <h2 id="privacy-terceros">¿Con quién compartimos tus datos?</h2>
          <p>No vendemos tus datos. Solo los compartimos cuando es necesario para darte el servicio:</p>
          <ul>
            <li><strong>Cocina y repartidores:</strong> nombre, teléfono, dirección de entrega e indicaciones, para preparar y entregar tu pedido.</li>
            <li><strong>Proveedores tecnológicos:</strong> Vercel (hospedaje del sitio) y Supabase (base de datos donde se guardan los pedidos).</li>
            <li><strong>Mapas:</strong> OpenStreetMap recibe la dirección que escribes, para ubicarla, y las zonas del mapa que consultas.</li>
            <li><strong>Google:</strong> únicamente los datos de navegación descritos en la sección anterior.</li>
            <li><strong>WhatsApp (Meta):</strong> cuando nos escribes, conforme a los términos de esa plataforma.</li>
          </ul>
          <p>También podemos compartir datos cuando una autoridad competente lo requiera conforme a la ley.</p>
        </section>

        <section aria-labelledby="privacy-arco">
          <h2 id="privacy-arco">Tus derechos</h2>
          <p>
            Puedes Acceder a tus datos, Rectificarlos, Cancelarlos u Oponerte a su tratamiento (derechos ARCO), y
            también revocar tu consentimiento o limitar el uso de tus datos. Para ejercerlos, escríbenos por{' '}
            <ContactLink /> con tu nombre, el teléfono con el que hiciste tu pedido y el derecho que quieres
            ejercer. Te responderemos en los plazos que marca la ley.
          </p>
          <p>
            Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes acudir ante la
            autoridad de protección de datos personales competente.
          </p>
        </section>

        <section aria-labelledby="privacy-conservacion">
          <h2 id="privacy-conservacion">¿Cuánto tiempo conservamos tus datos?</h2>
          <p>
            El tiempo necesario para atender tu pedido, darle seguimiento y cumplir obligaciones legales. Después los
            eliminamos o los dejamos de forma que ya no te identifiquen. Puedes pedir su cancelación en cualquier momento.
          </p>
        </section>

        <section aria-labelledby="privacy-cambios">
          <h2 id="privacy-cambios">Cambios a este aviso</h2>
          <p>
            Si este aviso cambia, publicaremos la nueva versión en esta página con su fecha de actualización.
            Al hacer un pedido en FoodiePack aceptas el aviso vigente en ese momento.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default PrivacyApp
