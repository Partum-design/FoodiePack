import { useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Clock3, Download, LoaderCircle, Utensils, X } from 'lucide-react'
import { useInstall } from '../lib/install'
import { enablePush, usePushPermission } from '../lib/push'

const DISMISSED_KEY = 'foodiepack:notify-dismissed-at'
const ASK_AGAIN_AFTER = 3 * 24 * 60 * 60 * 1000

function recentlyDismissed() {
  try { return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < ASK_AGAIN_AFTER } catch { return false }
}

const PERKS = [
  { icon: <CheckCircle2 size={18} />, title: 'Tu pedido, al momento', detail: 'Te avisamos cuando la cocina lo acepte.' },
  { icon: <Utensils size={18} />, title: 'Menú de mañana a las 11 am', detail: 'Para que no te quedes sin tu guisado favorito.' },
  { icon: <Clock3 size={18} />, title: 'Último aviso a las 5 pm', detail: 'Antes de que cerremos pedidos a las 6.' },
]

/** Inline card used in the order confirmation and in "Mis pedidos". */
export function NotifyCard({ orderId, compact = false }: { orderId?: string; compact?: boolean }) {
  const permission = usePushPermission()
  const { install } = useInstall()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (permission === 'unsupported' || permission === 'denied') return null
  if (done || (permission === 'granted' && !orderId)) {
    return <div className="fp-notify-card is-on"><BellRing size={18} /><p><strong>Avisos activados</strong><span>Te escribiremos aquí cuando cambie tu pedido.</span></p></div>
  }

  if (permission === 'needs-install') {
    return (
      <div className="fp-notify-card">
        <i><BellRing size={20} /></i>
        <p><strong>¿Quieres que te avisemos?</strong><span>En iPhone, primero agrega FoodiePack a tu inicio.</span></p>
        <button type="button" className="fp-btn fp-btn--dark fp-btn--sm" onClick={() => install('notify_card')}><Download size={15} /> Instalar</button>
      </div>
    )
  }

  const activate = async () => {
    setBusy(true)
    setError('')
    try {
      setDone(await enablePush({ orderId, source: compact ? 'my_orders' : 'confirmation' }))
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No se pudo activar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fp-notify-card">
      <i className="fp-bell"><BellRing size={20} /></i>
      <p><strong>{orderId ? '¿Te avisamos cuando lo acepten?' : 'Activa tus avisos'}</strong><span>{error || 'Una notificación y listo, sin spam.'}</span></p>
      <button type="button" className="fp-btn fp-btn--primary fp-btn--sm" onClick={activate} disabled={busy}>
        {busy ? <LoaderCircle size={15} className="fp-spin" /> : <BellRing size={15} />} Activar
      </button>
    </div>
  )
}

/** Friendly bottom sheet that invites first-time visitors to turn notifications on. */
export default function NotifyPrompt() {
  const permission = usePushPermission()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (permission !== 'default' || recentlyDismissed()) return
    const timer = window.setTimeout(() => {
      // Don't interrupt someone who is in the middle of checking out.
      if (!document.querySelector('.fp-checkout, .fp-cart-sheet, .fp-dish-sheet, .fp-install-guide')) setOpen(true)
    }, 9000)
    return () => window.clearTimeout(timer)
  }, [permission])

  const close = () => {
    setOpen(false)
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* private mode */ }
  }

  const activate = async () => {
    setBusy(true)
    try { await enablePush({ source: 'prompt' }) } catch { /* the card below explains failures */ }
    setBusy(false)
    close()
  }

  if (!open || permission !== 'default') return null

  return (
    <>
      <button className="fp-sheet-backdrop" aria-label="Cerrar" onClick={close} />
      <section className="fp-notify-sheet" role="dialog" aria-modal="true" aria-labelledby="notify-title">
        <div className="fp-sheet-handle" aria-hidden="true" />
        <button className="fp-icon-btn fp-notify-sheet__close" onClick={close} aria-label="Cerrar"><X size={18} /></button>
        <div className="fp-notify-sheet__art" aria-hidden="true">
          <div className="fp-notify-sheet__phone">
            <div className="fp-notify-sheet__toast"><img src="/icons/icon-96.png" alt="" /><p><b>FoodiePack · ahora</b><span>✅ ¡Tu pedido fue aceptado!</span></p></div>
            <div className="fp-notify-sheet__toast is-2"><img src="/icons/icon-96.png" alt="" /><p><b>FoodiePack · 11:00</b><span>🍲 ¿Ya sabes qué vas a comer mañana?</span></p></div>
          </div>
          <span className="fp-notify-sheet__bell"><BellRing size={26} /></span>
        </div>
        <h2 id="notify-title">Que no se te pase la comida</h2>
        <ul>
          {PERKS.map((perk) => <li key={perk.title}><i>{perk.icon}</i><p><strong>{perk.title}</strong><span>{perk.detail}</span></p></li>)}
        </ul>
        <button type="button" className="fp-btn fp-btn--primary fp-btn--lg fp-btn--block" onClick={activate} disabled={busy}>
          {busy ? <LoaderCircle size={18} className="fp-spin" /> : <BellRing size={18} />} Activar notificaciones
        </button>
        <button type="button" className="fp-notify-sheet__later" onClick={close}>Ahora no</button>
      </section>
    </>
  )
}
