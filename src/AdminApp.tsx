import { CSSProperties, FormEvent, useEffect, useState } from 'react'
import {
  ArrowLeft, Banknote, Check, CheckCircle2, ClipboardList, CreditCard, Eye, EyeOff,
  Loader2, LogOut, MapPin, PackageOpen, Plus, Receipt, Save, ShoppingBag, Trash2, UtensilsCrossed,
} from 'lucide-react'
import { adminLogin, getAdminMenu, getAdminOrders, getMenuDays, saveAdminMenu } from './api'
import FloatingDecor from './components/FloatingDecor'
import Logo from './components/Logo'
import type { Meal, MenuDay, SavedOrder } from './types'

const TOKEN_KEY = 'foodiepack:admin-session'
const placeholderImages = [
  '/assets/meals/pollo-citrico.jpg',
  '/assets/meals/pasta-poblano.jpg',
  '/assets/meals/res-chipotle.jpg',
  '/assets/meals/salmon-verde.jpg',
  '/assets/meals/bowl-huerto.jpg',
]

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)

function dateFromKey(date: string) {
  return new Date(`${date}T12:00:00`)
}

function shortDay(date: string) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(dateFromKey(date)).replace('.', '')
}

function longDate(date: string) {
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(date))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Login({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const password = String(new FormData(event.currentTarget).get('password'))
    try {
      const { token } = await adminLogin(password)
      sessionStorage.setItem(TOKEN_KEY, token)
      onSuccess(token)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login">
      <FloatingDecor />
      <section>
        <Logo hero />
        <p>Acceso de cocina</p>
        <h1>Administración</h1>
        <form onSubmit={submit}>
          <label>Contraseña
            <span className="password-field">
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={8} autoFocus />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span>
          </label>
          {error && <div className="inline-error">{error}</div>}
          <button className="admin-primary" disabled={loading}>{loading ? 'Verificando…' : 'Entrar'}</button>
        </form>
        <a href="/"><ArrowLeft size={15} /> Volver a la tienda</a>
      </section>
    </main>
  )
}

function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [tab, setTab] = useState<'menu' | 'orders'>('menu')
  const [days, setDays] = useState<MenuDay[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [meals, setMeals] = useState<Meal[]>([])
  const [orders, setOrders] = useState<SavedOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken('')
  }

  useEffect(() => {
    if (!token) return
    getMenuDays()
      .then(({ days: availableDays, policy }) => {
        setDays(availableDays)
        setSelectedDate((current) => current || policy.tomorrow)
      })
      .catch(() => setError('No se pudo consultar el servidor'))
  }, [token])

  useEffect(() => {
    if (!token || !selectedDate || tab !== 'menu') return
    let active = true
    setLoading(true)
    setError('')
    getAdminMenu(selectedDate, token)
      .then(({ meals: currentMeals }) => { if (active) setMeals(currentMeals) })
      .catch((requestError) => {
        if (!active) return
        const text = requestError instanceof Error ? requestError.message : 'No se pudo cargar el menú'
        setError(text)
        if (/sesión|acceso/i.test(text)) logout()
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedDate, tab, token])

  useEffect(() => {
    if (!token || tab !== 'orders') return
    setLoading(true)
    getAdminOrders(token)
      .then(({ orders: currentOrders }) => setOrders(currentOrders))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los pedidos'))
      .finally(() => setLoading(false))
  }, [tab, token])

  if (!token) return <Login onSuccess={setToken} />

  const updateMeal = <K extends keyof Meal>(index: number, key: K, value: Meal[K]) => {
    setMeals((current) => current.map((meal, mealIndex) => mealIndex === index ? { ...meal, [key]: value } : meal))
    setMessage('')
  }

  const addMeal = () => {
    setMeals((current) => [...current, {
      id: `platillo-${Date.now()}`,
      name: 'Nuevo platillo',
      description: 'Agrega aquí la descripción y los acompañamientos.',
      price: 139,
      protein: 30,
      kcal: 520,
      tags: ['Nuevo'],
      image: placeholderImages[current.length % placeholderImages.length],
      available: true,
    }])
    setMessage('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await saveAdminMenu(selectedDate, meals, token)
      setMeals(response.meals)
      setMessage('Menú guardado')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar el menú')
    } finally {
      setSaving(false)
    }
  }

  const availableCount = meals.filter((meal) => meal.available).length
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <Logo compact />
        <div>
          <button className={tab === 'menu' ? 'selected' : ''} onClick={() => setTab('menu')}><ClipboardList size={15} /> Menús</button>
          <button className={tab === 'orders' ? 'selected' : ''} onClick={() => setTab('orders')}><ShoppingBag size={15} /> Pedidos</button>
        </div>
        <button className="logout-button" onClick={logout}><LogOut size={15} /> Salir</button>
      </aside>

      <main className="admin-main">
        {tab === 'menu' ? <>
          <header className="admin-page-head">
            <div><p>Menú diario</p><h1>{selectedDate ? longDate(selectedDate) : 'Cargando…'}</h1><span>Los cambios se publican en la tienda al guardar.</span></div>
            <div className="admin-head-actions">
              {message && <span className="save-message"><Check size={14} /> {message}</span>}
              <button className="admin-secondary" onClick={addMeal}><Plus size={16} /> Agregar platillo</button>
              <button className="admin-primary" onClick={save} disabled={saving || loading}>{saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </header>

          <div className="admin-stats">
            <div className="admin-stat"><UtensilsCrossed size={20} /><span><b>{meals.length}</b>Platillos hoy</span></div>
            <div className="admin-stat admin-stat--accent"><CheckCircle2 size={20} /><span><b>{availableCount}</b>Disponibles</span></div>
          </div>

          <div className="admin-date-strip">
            {days.map((day, index) => <button key={day.date} className={selectedDate === day.date ? 'selected' : ''} onClick={() => setSelectedDate(day.date)}><span>{index === 0 ? 'Mañana' : shortDay(day.date)}</span><strong>{dateFromKey(day.date).getDate()}</strong></button>)}
          </div>

          {error && <div className="inline-error">{error}</div>}
          <div className="editor-list">
            {loading && <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando menú…</div>}
            {!loading && meals.length === 0 && (
              <div className="admin-empty"><UtensilsCrossed size={26} /><strong>Aún no hay platillos</strong>Agrega el primero para este día.</div>
            )}
            {!loading && meals.map((meal, index) => (
              <article className="editor-row" key={meal.id} style={{ '--i': index } as CSSProperties}>
                <div className="editor-photo" style={{ backgroundImage: `url(${meal.image})` }} />
                <div className="editor-fields">
                  <label>Nombre<input value={meal.name} onChange={(event) => updateMeal(index, 'name', event.target.value)} /></label>
                  <label>Descripción<input value={meal.description} onChange={(event) => updateMeal(index, 'description', event.target.value)} /></label>
                  <div>
                    <label>Precio<input type="number" min="1" value={meal.price} onChange={(event) => updateMeal(index, 'price', Number(event.target.value))} /></label>
                    <label>Proteína<input type="number" min="0" value={meal.protein} onChange={(event) => updateMeal(index, 'protein', Number(event.target.value))} /></label>
                    <label>Calorías<input type="number" min="0" value={meal.kcal} onChange={(event) => updateMeal(index, 'kcal', Number(event.target.value))} /></label>
                  </div>
                </div>
                <div className="editor-controls">
                  <button className={`availability ${meal.available ? 'active' : ''}`} onClick={() => updateMeal(index, 'available', !meal.available)}><i />{meal.available ? 'Disponible' : 'Agotado'}</button>
                  <button
                    className="delete-meal"
                    onClick={() => {
                      if (!window.confirm(`¿Eliminar "${meal.name}" del menú?`)) return
                      setMeals((current) => current.filter((_, mealIndex) => mealIndex !== index))
                      setMessage('')
                    }}
                  ><Trash2 size={16} /> Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </> : <>
          <header className="admin-page-head"><div><p>Operación</p><h1>Pedidos</h1><span>Aquí llegan los pedidos aceptados.</span></div></header>

          <div className="admin-stats">
            <div className="admin-stat"><ShoppingBag size={20} /><span><b>{orders.length}</b>Pedidos</span></div>
            <div className="admin-stat admin-stat--accent"><Receipt size={20} /><span><b>{money(totalRevenue)}</b>Ingresos</span></div>
          </div>

          {error && <div className="inline-error">{error}</div>}
          {loading && <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando pedidos…</div>}
          <div className="orders-table">
            <div className="orders-table__head"><span>Pedido</span><span>Entrega</span><span>Cliente</span><span>Dirección</span><span>Productos</span><span>Pago</span><span>Total</span><span>Estado</span></div>
            {!loading && orders.map((order, index) => (
              <div className="orders-table__row" key={order.id} style={{ '--i': index } as CSSProperties}>
                <strong>{order.id}{order.isWeeklyPlan && <em className="plan-badge">Plan semanal</em>}</strong>
                <span>{longDate(order.deliveryDate)}</span>
                <span>{order.customer.name}</span>
                <span className="order-address">
                  <strong>{order.delivery?.address || order.customer.address || 'Sin dirección'}</strong>
                  {order.delivery?.office && <small>{order.delivery.office}</small>}
                  {order.delivery?.mapUrl && <a href={order.delivery.mapUrl} target="_blank" rel="noreferrer"><MapPin size={12} /> Ver pin</a>}
                </span>
                <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                <span className="order-payment">{order.paymentMethod === 'card' ? <CreditCard size={13} /> : <Banknote size={13} />} {order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</span>
                <strong>{money(order.total)}{order.discountAmount > 0 && <small className="order-discount">-{money(order.discountAmount)}</small>}</strong>
                <b className={order.status === 'accepted' ? '' : 'status-confirmed'}>{order.status === 'accepted' ? 'Aceptado' : 'Confirmado'}</b>
              </div>
            ))}
            {!loading && orders.length === 0 && (
              <div className="admin-empty"><PackageOpen size={26} /><strong>Todavía no hay pedidos</strong>Aquí aparecerán en cuanto lleguen.</div>
            )}
          </div>
        </>}
      </main>
    </div>
  )
}

export default AdminApp
