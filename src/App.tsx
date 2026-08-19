import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Clock3, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { createOrder, getMenu, getMenuDays } from './api'
import Logo from './components/Logo'
import type { CartItem, Meal, MenuDay, MenuResponse, SavedOrder } from './types'

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)

function dateFromKey(date: string) {
  return new Date(`${date}T12:00:00`)
}

function dayName(date: string, long = false) {
  return new Intl.DateTimeFormat('es-MX', { weekday: long ? 'long' : 'short' }).format(dateFromKey(date)).replace('.', '')
}

function fullDate(date: string) {
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(date))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('foodiepack:v2:cart') || '[]') as CartItem[]
  } catch {
    return []
  }
}

function BrandPreloader() {
  return (
    <div className="brand-preloader" role="status" aria-label="Cargando FoodiePack">
      <div className="brand-preloader__lockup">
        <Logo />
        <p>Tu cocina en la oficina</p>
        <span aria-hidden="true"><i /></span>
      </div>
    </div>
  )
}

function MealRow({ meal, canOrder, onAdd }: { meal: Meal; canOrder: boolean; onAdd: () => void }) {
  const disabled = !canOrder || !meal.available
  return (
    <article className={`menu-item ${meal.available ? '' : 'menu-item--unavailable'}`}>
      <div className="menu-item__image" style={{ backgroundPosition: meal.position }}>
        {!meal.available && <span>Agotado</span>}
      </div>
      <div className="menu-item__content">
        <div className="menu-item__topline">
          <span>{meal.tags[0] || 'Menú del día'}</span>
          <strong>{money(meal.price)}</strong>
        </div>
        <h2>{meal.name}</h2>
        <p>{meal.description}</p>
        <div className="menu-item__bottom">
          <span>{meal.protein} g proteína</span>
          <span>{meal.kcal} kcal</span>
          <button disabled={disabled} onClick={onAdd}>
            {meal.available ? (canOrder ? <><Plus size={16} /> Agregar</> : 'Vista previa') : 'No disponible'}
          </button>
        </div>
      </div>
    </article>
  )
}

function OrderSummary({ cart, deliveryDate, canOrder, onQuantity, onCheckout }: {
  cart: CartItem[]
  deliveryDate: string
  canOrder: boolean
  onQuantity: (mealId: string, change: number) => void
  onCheckout: () => void
}) {
  const subtotal = cart.reduce((sum, item) => sum + item.meal.price * item.quantity, 0)
  const delivery = cart.length ? 29 : 0

  return (
    <aside className="order-summary" id="pedido">
      <div className="order-summary__head">
        <span>Tu pedido</span>
        <strong>{cart.reduce((sum, item) => sum + item.quantity, 0)} productos</strong>
      </div>
      <div className="order-summary__date">
        <Clock3 size={18} />
        <p><span>Entrega</span><strong>{deliveryDate ? fullDate(deliveryDate) : 'Mañana'} · 1:30–2:00 pm</strong></p>
      </div>
      <div className="summary-items">
        {cart.map((item) => (
          <div className="summary-item" key={item.meal.id}>
            <div className="summary-item__thumb" style={{ backgroundPosition: item.meal.position }} />
            <p><strong>{item.meal.name}</strong><span>{money(item.meal.price)}</span></p>
            <div className="counter">
              <button onClick={() => onQuantity(item.meal.id, -1)} aria-label={`Quitar ${item.meal.name}`}><Minus size={12} /></button>
              <span>{item.quantity}</span>
              <button onClick={() => onQuantity(item.meal.id, 1)} aria-label={`Agregar otro ${item.meal.name}`}><Plus size={12} /></button>
            </div>
          </div>
        ))}
        {!cart.length && <div className="summary-empty"><ShoppingBag size={24} /><p>Agrega uno o más platillos del menú.</p></div>}
      </div>
      <div className="summary-totals">
        <p><span>Comida</span><strong>{money(subtotal)}</strong></p>
        <p><span>Envío</span><strong>{money(delivery)}</strong></p>
        <p className="summary-total"><span>Total</span><strong>{money(subtotal + delivery)}</strong></p>
      </div>
      <button className="checkout-button" disabled={!cart.length || !canOrder} onClick={onCheckout}>Continuar <ArrowRight size={17} /></button>
      <small>Pedido y pago de demostración. No se realizará un cargo real.</small>
    </aside>
  )
}

function App() {
  const [preloading, setPreloading] = useState(true)
  const [days, setDays] = useState<MenuDay[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [cart, setCart] = useState<CartItem[]>(loadCart)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<SavedOrder | null>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => {
      setPreloading(false)
      document.body.style.overflow = ''
    }, reducedMotion ? 250 : 1750)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    getMenuDays()
      .then(({ days: availableDays, policy }) => {
        setDays(availableDays)
        setSelectedDate(policy.tomorrow)
        setCart((items) => items.filter((item) => item.date === policy.tomorrow))
      })
      .catch(() => setError('No pudimos conectar con la cocina. Intenta nuevamente en un momento.'))
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let active = true
    setLoading(true)
    setError('')
    getMenu(selectedDate)
      .then((response) => { if (active) setMenu(response) })
      .catch(() => { if (active) setError('No pudimos cargar el menú de este día.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedDate])

  useEffect(() => {
    localStorage.setItem('foodiepack:v2:cart', JSON.stringify(cart))
  }, [cart])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.meal.price * item.quantity, 0) + (cart.length ? 29 : 0), [cart])
  const isTomorrow = menu?.policy.tomorrow === selectedDate
  const canOrder = Boolean(menu?.canOrder)
  const featuredMeal = menu?.meals.find((meal) => meal.available) || menu?.meals[0]

  const addMeal = (meal: Meal) => {
    if (!canOrder || !menu) return
    setCart((items) => {
      const existing = items.find((item) => item.meal.id === meal.id)
      return existing
        ? items.map((item) => item.meal.id === meal.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { meal, quantity: 1, date: menu.policy.tomorrow }]
    })
  }

  const changeQuantity = (mealId: string, change: number) => {
    setCart((items) => items
      .map((item) => item.meal.id === mealId ? { ...item, quantity: item.quantity + change } : item)
      .filter((item) => item.quantity > 0))
  }

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError('')
    try {
      const response = await createOrder({
        customer: {
          name: String(form.get('name')),
          phone: String(form.get('phone')),
          address: String(form.get('address')),
          notes: String(form.get('notes') || ''),
        },
        items: cart.map((item) => ({ mealId: item.meal.id, date: item.date, quantity: item.quantity })),
      })
      setOrder(response.order)
      setCart([])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo confirmar el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="storefront">
      {preloading && <BrandPreloader />}
      <header className="store-header">
        <a href="/" aria-label="Inicio"><Logo /></a>
        <div className="store-header__delivery">
          <span>Zona de entrega</span>
          <button>Roma Norte, CDMX <ChevronDown size={14} /></button>
        </div>
        <button className="header-cart" onClick={() => document.querySelector('#pedido')?.scrollIntoView({ behavior: 'smooth' })}>
          <ShoppingBag size={18} /><span>Pedido</span>{cartCount > 0 && <b>{cartCount}</b>}
        </button>
      </header>

      <section className="brand-landing" aria-labelledby="landing-title">
        <div className="brand-landing__inner">
          <div className="brand-landing__copy">
            <p>Cocina diaria · Ciudad de México</p>
            <h1 id="landing-title">Mañana ya<br />está <em>servido.</em></h1>
            <span>Tres platos, cocina fresca y una sola decisión: cuál se te antoja.</span>
            <div className="brand-landing__actions">
              <a href="#menu-del-dia">Elegir mi comida <ArrowRight size={17} /></a>
              <small><Clock3 size={15} /> Pide hoy de 8:00 am a 6:00 pm</small>
            </div>
          </div>
          <div className="brand-landing__visual">
            <div className="landing-dish" style={{ backgroundPosition: featuredMeal?.position || '50% 50%' }} role="img" aria-label={featuredMeal?.name || 'Comida preparada por FoodiePack'}>
              <div className="landing-date"><span>Entrega</span><strong>{menu?.policy.tomorrow ? dateFromKey(menu.policy.tomorrow).getDate() : '—'}</strong><small>{menu?.policy.tomorrow ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(dateFromKey(menu.policy.tomorrow)).replace('.', '') : 'pronto'}</small></div>
            </div>
            <div className="landing-caption">
              <span>Del menú de mañana</span>
              <strong>{featuredMeal?.name || 'Cocinando el menú…'}</strong>
              <b>{featuredMeal ? money(featuredMeal.price) : '—'}</b>
            </div>
          </div>
        </div>
      </section>

      <main className="order-workspace" id="menu-del-dia">
        <section className="menu-column">
          <div className={`order-window ${menu?.policy.isOpen ? 'order-window--open' : ''}`}>
            <span className="order-window__status"><i />{menu?.policy.isOpen ? 'Pedidos abiertos' : 'Pedidos cerrados'}</span>
            <p>Reserva para mañana</p>
            <strong>8:00 am — 6:00 pm</strong>
            <small>Hora de Ciudad de México</small>
          </div>

          <div className="menu-title">
            <p>{isTomorrow ? 'Entrega de mañana' : 'Próximamente'}</p>
            <h1>{selectedDate ? fullDate(selectedDate) : 'Menú'}</h1>
            <span>{isTomorrow
              ? (canOrder ? 'Haz tu pedido hoy. Lo cocinamos mañana por la mañana.' : 'La ventana de pedido está cerrada. Vuelve entre 8:00 am y 6:00 pm.')
              : 'Puedes revisar este menú. Las reservaciones abren el día anterior a las 8:00 am.'}</span>
          </div>

          <div className="date-strip" aria-label="Próximos menús">
            {days.map((day, index) => (
              <button key={day.date} className={selectedDate === day.date ? 'selected' : ''} onClick={() => setSelectedDate(day.date)}>
                <span>{index === 0 ? 'Mañana' : dayName(day.date)}</span>
                <strong>{dateFromKey(day.date).getDate()}</strong>
                <small>{day.mealCount} opciones</small>
              </button>
            ))}
          </div>

          {error && <div className="inline-error">{error}</div>}
          <div className="menu-list">
            {loading && Array.from({ length: 3 }, (_, index) => <div className="menu-skeleton" key={index} />)}
            {!loading && menu?.meals.map((meal) => <MealRow key={meal.id} meal={meal} canOrder={canOrder} onAdd={() => addMeal(meal)} />)}
            {!loading && menu?.meals.length === 0 && <div className="menu-empty"><h2>Menú pendiente</h2><p>La cocina todavía no publica las opciones para este día.</p></div>}
          </div>
        </section>

        <OrderSummary cart={cart} deliveryDate={menu?.policy.tomorrow || ''} canOrder={canOrder} onQuantity={changeQuantity} onCheckout={() => setCheckoutOpen(true)} />
      </main>

      {cartCount > 0 && (
        <a className="mobile-order-bar" href="#pedido">
          <span><b>{cartCount}</b> {cartCount === 1 ? 'producto' : 'productos'}</span>
          <strong>{money(cartTotal)}</strong>
          <span>Ver pedido <ArrowRight size={15} /></span>
        </a>
      )}

      {checkoutOpen && <button className="modal-backdrop" aria-label="Cerrar" onClick={() => { setCheckoutOpen(false); setOrder(null) }} />}
      {checkoutOpen && (
        <section className="checkout-dialog" role="dialog" aria-modal="true" aria-label="Confirmar pedido">
          <button className="dialog-close" onClick={() => { setCheckoutOpen(false); setOrder(null) }} aria-label="Cerrar"><X size={20} /></button>
          {order ? (
            <div className="order-confirmed">
              <span><Check size={28} /></span>
              <p>Pedido {order.id}</p>
              <h2>Listo para mañana.</h2>
              <small>Guardamos tu pedido. La entrega será de 1:30 a 2:00 pm.</small>
              <button onClick={() => { setCheckoutOpen(false); setOrder(null) }}>Cerrar</button>
            </div>
          ) : (
            <form onSubmit={placeOrder}>
              <p>Confirmar pedido</p>
              <h2>Datos de entrega</h2>
              <label>Nombre<input name="name" autoComplete="name" required /></label>
              <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required /></label>
              <label>Dirección y oficina<input name="address" autoComplete="street-address" required placeholder="Calle, número, piso y oficina" /></label>
              <label>Indicaciones opcionales<textarea name="notes" maxLength={300} /></label>
              {error && <div className="inline-error">{error}</div>}
              <div className="checkout-dialog__total"><span>Total</span><strong>{money(cartTotal)}</strong></div>
              <button className="checkout-button" disabled={submitting}>{submitting ? 'Confirmando…' : 'Confirmar pedido'}</button>
              <small>Este prototipo no procesa pagos reales.</small>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

export default App
