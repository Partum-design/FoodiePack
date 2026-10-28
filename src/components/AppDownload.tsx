import { Apple, Bell, CheckCircle2, Download, Monitor, Play, Zap } from 'lucide-react'
import { useInstall } from '../lib/install'
import { money } from '../lib/format'
import type { Meal } from '../types'

/** "Lleva FoodiePack en tu bolsillo" band with a phone mockup and install buttons. */
export default function AppDownload({ meals }: { meals: Meal[] }) {
  const { installed, platform, install } = useInstall()
  const preview = meals.filter((meal) => meal.available).slice(0, 3)

  return (
    <section className="fp-app" id="app" aria-labelledby="app-title">
      <div className="fp-app__inner">
        <div className="fp-app__visual" aria-hidden="true">
          <div className="fp-phone">
            <div className="fp-phone__notch" />
            <div className="fp-phone__screen">
              <div className="fp-phone__top">
                <img src="/assets/brand/logo-horizontal.png" alt="" />
                <span><Bell size={11} /></span>
              </div>
              <div className="fp-phone__hero">
                <small>Menú de mañana</small>
                <strong>Tu cocina en la oficina</strong>
                <em>Pedir ahora</em>
              </div>
              {(preview.length ? preview : [null, null, null]).map((meal, index) => (
                <div className="fp-phone__row" key={meal?.id || index}>
                  <i style={meal ? { backgroundImage: `url(${meal.image})` } : undefined} />
                  <p><b>{meal?.name || 'Guisado del día'}</b><span>{money(60 + index * 15)}</span></p>
                  <em>+</em>
                </div>
              ))}
              <div className="fp-phone__cta">Confirmar pedido</div>
            </div>
          </div>
          <div className="fp-app__float fp-app__float--1"><Zap size={14} /> Pide en 2 toques</div>
          <div className="fp-app__float fp-app__float--2"><CheckCircle2 size={14} /> Pedido aceptado</div>
        </div>

        <div className="fp-app__copy">
          <span className="fp-eyebrow fp-eyebrow--light">App FoodiePack</span>
          <h2 id="app-title">Tu comida favorita, <em>en tu bolsillo.</em></h2>
          <p>Instálala gratis desde aquí mismo: no ocupa espacio, abre al instante y no necesitas tienda de apps.</p>
          <ul>
            <li><CheckCircle2 size={17} /> Ícono en tu pantalla de inicio</li>
            <li><CheckCircle2 size={17} /> Abre al instante, sin buscar la página</li>
            <li><CheckCircle2 size={17} /> Menú de la semana siempre a la mano</li>
          </ul>

          {installed ? (
            <div className="fp-app__installed"><CheckCircle2 size={20} /> Ya tienes FoodiePack instalada en este dispositivo.</div>
          ) : (
            <div className="fp-app__stores">
              {platform === 'native' ? (
                <button type="button" className="fp-store fp-store--main" onClick={() => install('app_section')}>
                  <Download size={24} />
                  <span><small>Gratis · 1 toque</small><strong>Instalar app</strong></span>
                </button>
              ) : (
                <>
                  <button type="button" className="fp-store" onClick={() => install('app_section_ios')}>
                    <Apple size={24} />
                    <span><small>Agrégala en</small><strong>iPhone</strong></span>
                  </button>
                  <button type="button" className="fp-store" onClick={() => install('app_section_android')}>
                    <Play size={22} />
                    <span><small>Instálala en</small><strong>Android</strong></span>
                  </button>
                  <button type="button" className="fp-store fp-store--ghost" onClick={() => install('app_section_desktop')}>
                    <Monitor size={22} />
                    <span><small>Úsala en tu</small><strong>Computadora</strong></span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
