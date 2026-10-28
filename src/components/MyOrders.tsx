import { useEffect, useState } from 'react'
import { Check, Clock3, LoaderCircle, PackageCheck, RefreshCw, X, XCircle } from 'lucide-react'
import { fullDate } from '../lib/dates'
import { money } from '../lib/format'
import { fetchMyOrders, STATUS_COPY } from '../lib/myOrders'
import type { TrackedOrder } from '../lib/myOrders'
import { buildWhatsAppUrl } from '../lib/contact'
import { NotifyCard } from './NotifyPrompt'

function StatusIcon({ status }: { status: string }) {
  if (status === 'accepted') return <Check size={15} />
  if (status === 'cancelled') return <XCircle size={15} />
  return <Clock3 size={15} />
}

/** "Mis pedidos" bottom sheet: live status of the orders placed from this device. */
export default function MyOrders({ open, focusId, onClose, onOrder }: {
  open: boolean
  focusId?: string
  onClose: () => void
  onOrder: () => void
}) {
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError('')
    fetchMyOrders(focusId)
      .then((list) => { if (active) setOrders(list) })
      .catch(() => { if (active) setError('No pudimos cargar tus pedidos. Revisa tu conexión.') })
      .finally(() => { if (active) setLoading(false) })
    // Keep statuses fresh while the sheet is open.
    const timer = window.setInterval(() => setTick((value) => value + 1), 20_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [open, focusId, tick])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <button className="fp-sheet-backdrop" aria-label="Cerrar" onClick={onClose} />
      <section className="fp-cart-sheet fp-orders-sheet" role="dialog" aria-modal="true" aria-label="Mis pedidos">
        <div className="fp-sheet-handle" aria-hidden="true" />
        <div className="fp-cart-sheet__top">
          <h2>Mis pedidos</h2>
          <div className="fp-orders-sheet__actions">
            <button type="button" className="fp-icon-btn" onClick={() => setTick((value) => value + 1)} aria-label="Actualizar">
              {loading ? <LoaderCircle size={18} className="fp-spin" /> : <RefreshCw size={18} />}
            </button>
            <button type="button" className="fp-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
          </div>
        </div>
        <div className="fp-cart-sheet__body">
          <NotifyCard compact />
          {error && <div className="fp-alert">{error}</div>}
          {orders && orders.length === 0 && !loading && (
            <div className="fp-empty">
              <span aria-hidden="true">🧾</span>
              <h3>Aún no tienes pedidos</h3>
              <p>Cuando pidas desde este celular, aquí verás si la cocina ya lo aceptó.</p>
              <button type="button" className="fp-btn fp-btn--primary" onClick={onOrder}>Ver el menú</button>
            </div>
          )}
          {orders?.map((order) => {
            const copy = STATUS_COPY[order.status] || STATUS_COPY.pending
            const item = order.items[0]
            return (
              <article key={order.id} className={`fp-track fp-track--${copy.tone} ${order.id === focusId ? 'is-focus' : ''}`}>
                <div className="fp-track__head">
                  <span className="fp-track__status"><StatusIcon status={order.status} /> {copy.label}</span>
                  <small>{order.id}</small>
                </div>
                <h3>{item?.mealName || item?.packageLabel}{order.isWeeklyPlan ? ' · semana' : ''}</h3>
                <p>{item?.quantity} × {item?.packageLabel} · {money(order.total)}</p>
                <div className="fp-track__steps" aria-hidden="true">
                  <span className="is-done"><PackageCheck size={14} /> Recibido</span>
                  <i className={order.status === 'accepted' ? 'is-done' : ''} />
                  <span className={order.status === 'accepted' ? 'is-done' : (order.status === 'cancelled' ? 'is-cancel' : '')}>
                    {order.status === 'cancelled' ? <><XCircle size={14} /> Cancelado</> : <><Check size={14} /> Aceptado</>}
                  </span>
                </div>
                <p className="fp-track__when"><Clock3 size={13} /> Entrega {fullDate(order.deliveryDate).toLowerCase()} · 12–2 pm</p>
                <small className="fp-track__hint">{copy.hint}</small>
                {order.status === 'cancelled' && (
                  <a className="fp-link" href={buildWhatsAppUrl(`Hola, mi pedido ${order.id} aparece cancelado`)} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}
