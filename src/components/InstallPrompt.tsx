import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Chrome, Download, EllipsisVertical, Monitor, Share, Smartphone, SquarePlus, X } from 'lucide-react'
import { isIos, useInstall } from '../lib/install'

const DISMISSED_KEY = 'foodiepack:install-dismissed'

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
}

type GuideTab = 'iphone' | 'android' | 'desktop'

const GUIDE_STEPS: Record<GuideTab, Array<{ icon: ReactNode; title: string; detail: string }>> = {
  iphone: [
    { icon: <Share size={20} />, title: 'Toca Compartir', detail: 'Es el cuadrito con flecha hacia arriba, abajo en Safari.' },
    { icon: <SquarePlus size={20} />, title: '“Agregar a inicio”', detail: 'Desliza el menú hacia abajo hasta encontrarlo.' },
    { icon: <Check size={20} />, title: 'Toca “Agregar”', detail: 'FoodiePack aparece junto a tus apps. ¡Listo!' },
  ],
  android: [
    { icon: <EllipsisVertical size={20} />, title: 'Abre el menú ⋮', detail: 'Arriba a la derecha en Chrome.' },
    { icon: <Download size={20} />, title: '“Instalar app”', detail: 'También puede decir “Agregar a pantalla principal”.' },
    { icon: <Check size={20} />, title: 'Confirma', detail: 'La app se instala en segundos, sin ocupar espacio.' },
  ],
  desktop: [
    { icon: <Chrome size={20} />, title: 'Usa Chrome o Edge', detail: 'Son los navegadores que permiten instalar apps web.' },
    { icon: <Monitor size={20} />, title: 'Ícono de instalar', detail: 'Búscalo a la derecha de la barra de direcciones.' },
    { icon: <Check size={20} />, title: 'Toca “Instalar”', detail: 'FoodiePack abre en su propia ventana.' },
  ],
}

const TAB_LABELS: Record<GuideTab, string> = { iphone: 'iPhone', android: 'Android', desktop: 'Computadora' }

function defaultTab(): GuideTab {
  if (isIos()) return 'iphone'
  if (/android/i.test(navigator.userAgent)) return 'android'
  return 'desktop'
}

/** Step-by-step sheet for browsers without a native install prompt (iPhone, Firefox, etc.). */
export function InstallGuide() {
  const { guideOpen, closeGuide } = useInstall()
  const [tab, setTab] = useState<GuideTab>(defaultTab)

  useEffect(() => {
    if (!guideOpen) return
    setTab(defaultTab())
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeGuide() }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [guideOpen, closeGuide])

  if (!guideOpen) return null

  return (
    <>
      <button className="fp-sheet-backdrop" aria-label="Cerrar" onClick={closeGuide} />
      <section className="fp-install-guide" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
        <div className="fp-sheet-handle" aria-hidden="true" />
        <button className="fp-icon-btn fp-install-guide__close" onClick={closeGuide} aria-label="Cerrar"><X size={18} /></button>
        <div className="fp-install-guide__head">
          <img src="/icons/icon-192.png" alt="" width="64" height="64" />
          <div>
            <span>Gratis · sin tienda de apps</span>
            <h2 id="install-guide-title">Instala FoodiePack</h2>
            <p>3 pasos y tendrás tu comida a un toque de distancia.</p>
          </div>
        </div>
        <div className="fp-segment" role="tablist" aria-label="Tu dispositivo">
          {(Object.keys(TAB_LABELS) as GuideTab[]).map((key) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
              {key === 'desktop' ? <Monitor size={15} /> : <Smartphone size={15} />} {TAB_LABELS[key]}
            </button>
          ))}
        </div>
        <ol className="fp-install-steps" key={tab}>
          {GUIDE_STEPS[tab].map((step, index) => (
            <li key={step.title} style={{ animationDelay: `${index * 70}ms` }}>
              <b>{index + 1}</b>
              <i>{step.icon}</i>
              <p><strong>{step.title}</strong><span>{step.detail}</span></p>
            </li>
          ))}
        </ol>
        <button className="fp-btn fp-btn--primary fp-btn--block" onClick={closeGuide}>Entendido</button>
      </section>
    </>
  )
}

/** Small floating card that invites phone visitors to install the app. */
function InstallPrompt() {
  const { installed, platform, install } = useInstall()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [ready, setReady] = useState(false)

  // Give people a moment with the store before asking anything.
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* private mode */ }
  }

  if (!ready || dismissed || installed || platform === 'manual') return null

  return (
    <div className="fp-install-banner" role="complementary" aria-label="Instalar la app de FoodiePack">
      <img src="/icons/icon-96.png" alt="" width="46" height="46" />
      <p><strong>FoodiePack en tu celular</strong><span>Pide en 2 toques, sin descargar nada pesado.</span></p>
      <button type="button" className="fp-btn fp-btn--primary fp-btn--sm" onClick={() => install('banner')}>
        <Download size={15} /> Instalar
      </button>
      <button type="button" className="fp-install-banner__close" onClick={dismiss} aria-label="Cerrar aviso de instalación"><X size={14} /></button>
    </div>
  )
}

export default InstallPrompt
