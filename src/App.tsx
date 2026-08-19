import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChefHat,
  ChevronRight,
  Clock3,
  CreditCard,
  History,
  Home,
  LayoutDashboard,
  Leaf,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  Utensils,
  X,
} from 'lucide-react'

type Meal = {
  id: string
  name: string
  description: string
  price: number
  protein: number
  kcal: number
  tags: string[]
  position: string
  soldOut?: boolean
}

type Day = {
  id: string
  short: string
  number: string
  label: string
  fullDate: string
}

type CartItem = {
  key: string
  dayId: string
  meal: Meal
  quantity: number
}

type Order = {
  id: string
  createdAt: string
  total: number
  status: string
  items: CartItem[]
}

const days: Day[] = [
  { id: 'lun', short: 'Lun', number: '17', label: 'Lunes', fullDate: '17 de agosto' },
  { id: 'mar', short: 'Mar', number: '18', label: 'Martes', fullDate: '18 de agosto' },
  { id: 'mie', short: 'Hoy', number: '19', label: 'Miércoles', fullDate: '19 de agosto' },
  { id: 'jue', short: 'Jue', number: '20', label: 'Jueves', fullDate: '20 de agosto' },
  { id: 'vie', short: 'Vie', number: '21', label: 'Viernes', fullDate: '21 de agosto' },
]

const mealLibrary: Meal[] = [
  {
    id: 'pollo-citrico',
    name: 'Pollo cítrico al grill',
    description: 'Con quinoa, camote rostizado y vegetales de temporada.',
    price: 139,
    protein: 38,
    kcal: 540,
    tags: ['Más pedido', 'Sin gluten'],
    position: '8% 20%',
  },
  {
    id: 'pasta-poblano',
    name: 'Pasta cremosa poblano',
    description: 'Rigatoni, espinaca, queso fresco y un toque de cilantro.',
    price: 125,
    protein: 24,
    kcal: 610,
    tags: ['Vegetariano'],
    position: '50% 9%',
  },
  {
    id: 'res-chipotle',
    name: 'Bowl de res chipotle',
    description: 'Arroz integral, frijol negro, aguacate y pico de gallo.',
    price: 149,
    protein: 41,
    kcal: 650,
    tags: ['Alto en proteína'],
    position: '92% 18%',
  },
  {
    id: 'salmon-verde',
    name: 'Salmón limón y hierbas',
    description: 'Salmón al grill con brócoli, ejotes y calabaza.',
    price: 169,
    protein: 36,
    kcal: 490,
    tags: ['Ligero', 'Sin gluten'],
    position: '24% 82%',
  },
  {
    id: 'bowl-huerto',
    name: 'Bowl del huerto',
    description: 'Quinoa, aguacate, kale, pepita y col morada.',
    price: 129,
    protein: 22,
    kcal: 510,
    tags: ['Vegano'],
    position: '72% 78%',
  },
]

const defaultMenus: Record<string, Meal[]> = {
  lun: [mealLibrary[2], mealLibrary[4], mealLibrary[1]],
  mar: [mealLibrary[3], mealLibrary[0], mealLibrary[4]],
  mie: [mealLibrary[0], mealLibrary[1], mealLibrary[2]],
  jue: [mealLibrary[3], mealLibrary[4], mealLibrary[0]],
  vie: [mealLibrary[2], mealLibrary[1], mealLibrary[3]],
}

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)

function useStoredState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? (JSON.parse(saved) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState] as const
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand ${inverse ? 'brand--inverse' : ''}`} aria-label="FoodiePack">
      <div className="brand__bag" aria-hidden="true">
        <span />
        <i />
      </div>
      <div className="brand__type">
        <span>Foodie</span><strong>Pack</strong>
        <small>Tu cocina en la oficina</small>
      </div>
    </div>
  )
}

function MealCard({ meal, day, onAdd, delay = 0 }: { meal: Meal; day: Day; onAdd: () => void; delay?: number }) {
  return (
    <article className={`meal-card ${meal.soldOut ? 'meal-card--sold' : ''}`} style={{ '--delay': `${delay}ms` } as React.CSSProperties}>
      <div className="meal-card__photo" style={{ backgroundPosition: meal.position }}>
        <div className="meal-card__tags">
          {meal.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        {meal.soldOut && <span className="sold-label">Agotado</span>}
      </div>
      <div className="meal-card__body">
        <p className="meal-card__day">{day.label} · {day.number} ago</p>
        <h3>{meal.name}</h3>
        <p>{meal.description}</p>
        <div className="meal-card__facts">
          <span><strong>{meal.protein}g</strong> proteína</span>
          <span><strong>{meal.kcal}</strong> kcal</span>
        </div>
        <div className="meal-card__footer">
          <strong>{money(meal.price)}</strong>
          <button className="add-button" onClick={onAdd} disabled={meal.soldOut} aria-label={`Agregar ${meal.name}`}>
            {meal.soldOut ? 'No disponible' : <><Plus size={17} /> Agregar</>}
          </button>
        </div>
      </div>
    </article>
  )
}

function App() {
  const [selectedDay, setSelectedDay] = useState('mie')
  const [menus, setMenus] = useStoredState<Record<string, Meal[]>>('foodiepack:v1:menus', defaultMenus)
  const [cart, setCart] = useStoredState<CartItem[]>('foodiepack:v1:cart', [])
  const [orders, setOrders] = useStoredState<Order[]>('foodiepack:v1:orders', [])
  const [panel, setPanel] = useState<'cart' | 'checkout' | 'orders' | 'admin' | null>(null)
  const [adminTab, setAdminTab] = useState<'menu' | 'history'>('menu')
  const [adminDay, setAdminDay] = useState('mie')
  const [weeklyPack, setWeeklyPack] = useState(false)
  const [toast, setToast] = useState('')
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)

  const day = days.find((item) => item.id === selectedDay) ?? days[2]
  const currentMeals = menus[selectedDay] ?? []
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cart.reduce((total, item) => total + item.meal.price * item.quantity, 0)
  const discount = weeklyPack ? subtotal * 0.12 : 0
  const delivery = cart.length ? 29 : 0
  const total = subtotal - discount + delivery

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const addMeal = (meal: Meal, dayId = selectedDay) => {
    const key = `${dayId}-${meal.id}`
    setCart((items) => {
      const existing = items.find((item) => item.key === key)
      return existing
        ? items.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { key, dayId, meal, quantity: 1 }]
    })
    showToast(`${meal.name} está en tu bolsa`)
  }

  const updateQuantity = (key: string, change: number) => {
    setCart((items) => items
      .map((item) => item.key === key ? { ...item, quantity: item.quantity + change } : item)
      .filter((item) => item.quantity > 0))
  }

  const addWeek = () => {
    const weekItems = days.flatMap((weekDay) => {
      const meal = (menus[weekDay.id] ?? []).find((item) => !item.soldOut)
      return meal ? [{ key: `${weekDay.id}-${meal.id}`, dayId: weekDay.id, meal, quantity: 1 }] : []
    })
    setCart(weekItems)
    setWeeklyPack(true)
    setPanel('cart')
    showToast('Tu semana quedó lista con 12% menos')
  }

  const completeOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const order: Order = {
      id: `FP-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      total,
      status: 'Confirmado',
      items: cart,
    }
    setOrders((current) => [order, ...current])
    setCart([])
    setWeeklyPack(false)
    setCheckoutSuccess(true)
  }

  const addAdminMeal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const newMeal: Meal = {
      id: `${Date.now()}`,
      name: String(data.get('name')),
      description: String(data.get('description')),
      price: Number(data.get('price')),
      protein: Number(data.get('protein')),
      kcal: Number(data.get('kcal')),
      tags: ['Nuevo'],
      position: mealLibrary[Math.floor(Math.random() * mealLibrary.length)].position,
    }
    setMenus((current) => ({ ...current, [adminDay]: [...(current[adminDay] ?? []), newMeal] }))
    event.currentTarget.reset()
    showToast('Platillo publicado en el menú')
  }

  const toggleMeal = (dayId: string, mealId: string) => {
    setMenus((current) => ({
      ...current,
      [dayId]: current[dayId].map((meal) => meal.id === mealId ? { ...meal, soldOut: !meal.soldOut } : meal),
    }))
  }

  const removeMeal = (dayId: string, mealId: string) => {
    setMenus((current) => ({ ...current, [dayId]: current[dayId].filter((meal) => meal.id !== mealId) }))
  }

  const weekTotal = useMemo(() => {
    const amount = days.reduce((sum, weekDay) => {
      const firstMeal = (menus[weekDay.id] ?? []).find((item) => !item.soldOut)
      return sum + (firstMeal?.price ?? 0)
    }, 0)
    return amount * 0.88
  }, [menus])

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#inicio" className="logo-link"><Logo /></a>
        <nav className="desktop-nav" aria-label="Navegación principal">
          <a className="active" href="#menu">Menú</a>
          <a href="#semana">Mi semana</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>
        <div className="topbar__actions">
          <button className="location-pill"><MapPin size={16} /> Roma Norte <ChevronRight size={15} /></button>
          <button className="icon-button admin-entry" onClick={() => setPanel('admin')} aria-label="Abrir administración"><LayoutDashboard size={20} /></button>
          <button className="icon-button" onClick={() => setPanel('orders')} aria-label="Ver pedidos"><UserRound size={20} /></button>
          <button className="bag-button" onClick={() => setPanel('cart')} aria-label={`Bolsa con ${cartCount} productos`}>
            <ShoppingBag size={20} />
            <span>Mi bolsa</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero__photo" aria-hidden="true" />
          <div className="hero__shade" />
          <div className="hero__content">
            <span className="eyebrow"><Sparkles size={14} /> Menú del miércoles</span>
            <h1>Tu comida rica,<br /><em>sin pausar el día.</em></h1>
            <p>Platillos recién hechos que llegan a tu oficina. Pide hoy o deja resuelta toda tu semana.</p>
            <div className="hero__actions">
              <a href="#menu" className="primary-button">Ver menú de hoy <ArrowRight size={18} /></a>
              <button className="ghost-button" onClick={addWeek}><CalendarDays size={18} /> Armar mi semana</button>
            </div>
          </div>
          <div className="delivery-card">
            <div className="delivery-card__icon"><Clock3 size={22} /></div>
            <div><span>Próxima entrega</span><strong>Hoy · 1:30–2:00 pm</strong></div>
            <span className="live-dot">Cierra en 42 min</span>
          </div>
        </section>

        <section className="menu-section" id="menu">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Elige sin prisa</span>
              <h2>¿Qué se te antoja?</h2>
              <p>Tres opciones frescas cada día. Tú eliges cuándo recibirlas.</p>
            </div>
            <button className="filter-button"><Leaf size={17} /> Todos los platillos</button>
          </div>

          <div className="day-picker" role="tablist" aria-label="Días del menú">
            {days.map((item) => (
              <button
                key={item.id}
                className={selectedDay === item.id ? 'selected' : ''}
                onClick={() => setSelectedDay(item.id)}
                role="tab"
                aria-selected={selectedDay === item.id}
              >
                <span>{item.short}</span><strong>{item.number}</strong>
                {item.id === 'mie' && <i />}
              </button>
            ))}
          </div>

          <div className="menu-meta">
            <p><strong>{day.label} {day.fullDate}</strong><span>{currentMeals.length} platillos disponibles</span></p>
            <span>Entrega de 1:30 a 2:00 pm</span>
          </div>

          <div className="meal-grid" key={selectedDay}>
            {currentMeals.map((meal, index) => (
              <MealCard key={meal.id} meal={meal} day={day} onAdd={() => addMeal(meal)} delay={index * 80} />
            ))}
          </div>
          {currentMeals.length === 0 && (
            <div className="empty-state"><ChefHat size={34} /><h3>El menú está en preparación</h3><p>Pronto publicaremos los platillos de este día.</p></div>
          )}
        </section>

        <section className="week-banner" id="semana">
          <div className="week-banner__copy">
            <span className="eyebrow eyebrow--lime"><CalendarDays size={14} /> Pack semanal</span>
            <h2>Cinco días resueltos.<br /><em>12% menos.</em></h2>
            <p>Elige una comida por día, recibe cada platillo fresco y cambia tu selección hasta las 8 pm del día anterior.</p>
            <button className="primary-button primary-button--orange" onClick={addWeek}>Armar mi semana <ArrowRight size={18} /></button>
          </div>
          <div className="week-ticket">
            <div className="week-ticket__top"><span>Tu semana</span><strong>17—21 AGO</strong></div>
            {days.map((item, index) => (
              <div className="ticket-row" key={item.id}>
                <span>{item.short}</span>
                <i className={`ticket-thumb ticket-thumb--${index + 1}`} />
                <p>{(menus[item.id] ?? []).find((meal) => !meal.soldOut)?.name ?? 'Por elegir'}</p>
                <Check size={16} />
              </div>
            ))}
            <div className="week-ticket__total"><span>Total con descuento</span><strong>{money(weekTotal)}</strong></div>
          </div>
        </section>

        <section className="steps-section" id="como-funciona">
          <div className="section-heading section-heading--center">
            <div><span className="section-kicker">Así de fácil</span><h2>Come bien. Sigue con tu día.</h2></div>
          </div>
          <div className="steps-grid">
            <article><span><CalendarDays /></span><strong>1</strong><h3>Elige el día</h3><p>Pide para hoy o aparta tu comida con tiempo.</p></article>
            <article><span><Utensils /></span><strong>2</strong><h3>Arma tu menú</h3><p>Combina tus favoritos o resuelve la semana.</p></article>
            <article><span><PackageCheck /></span><strong>3</strong><h3>Recibe y disfruta</h3><p>Llegamos a tu oficina en el horario acordado.</p></article>
          </div>
        </section>
      </main>

      <footer>
        <Logo inverse />
        <p>Comida honesta para días que no paran.</p>
        <div><a href="#menu">Menú</a><a href="#semana">Pack semanal</a><button onClick={() => setPanel('admin')}>Administración</button></div>
        <small>© 2026 FoodiePack · CDMX</small>
      </footer>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        <a className="active" href="#inicio"><Home size={20} /><span>Inicio</span></a>
        <a href="#menu"><Utensils size={20} /><span>Menú</span></a>
        <button onClick={() => setPanel('orders')}><History size={20} /><span>Pedidos</span></button>
        <button onClick={() => setPanel('cart')} className="mobile-bag"><ShoppingBag size={20} /><span>Bolsa</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
      </nav>

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}

      {panel && <button className="overlay" onClick={() => { setPanel(null); setCheckoutSuccess(false) }} aria-label="Cerrar panel" />}

      <aside className={`drawer ${panel === 'cart' ? 'drawer--open' : ''}`} aria-hidden={panel !== 'cart'}>
        <div className="drawer__header"><div><span>Tu pedido</span><h2>Mi bolsa <i>{cartCount}</i></h2></div><button className="close-button" onClick={() => setPanel(null)}><X /></button></div>
        <div className="drawer__delivery"><Clock3 size={19} /><div><span>Entrega estimada</span><strong>Hoy · 1:30–2:00 pm</strong></div><button>Cambiar</button></div>
        <div className="cart-list">
          {cart.map((item) => {
            const itemDay = days.find((entry) => entry.id === item.dayId)
            return (
              <article className="cart-item" key={item.key}>
                <div className="cart-item__photo" style={{ backgroundPosition: item.meal.position }} />
                <div className="cart-item__content"><span>{itemDay?.label} {itemDay?.number}</span><h3>{item.meal.name}</h3><strong>{money(item.meal.price)}</strong></div>
                <div className="quantity"><button onClick={() => updateQuantity(item.key, -1)}><Minus size={14} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.key, 1)}><Plus size={14} /></button></div>
              </article>
            )
          })}
          {cart.length === 0 && <div className="empty-cart"><div className="brand__bag"><span /><i /></div><h3>Tu bolsa está esperando</h3><p>Agrega algo rico del menú de hoy.</p><button className="primary-button" onClick={() => setPanel(null)}>Explorar menú</button></div>}
        </div>
        {cart.length > 0 && <div className="drawer__summary">
          <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          {weeklyPack && <div className="discount-row"><span>Descuento semanal</span><strong>−{money(discount)}</strong></div>}
          <div><span>Entrega</span><strong>{money(delivery)}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="primary-button primary-button--full" onClick={() => setPanel('checkout')}>Continuar al pago <ArrowRight size={18} /></button>
          <small><Check size={13} /> Puedes cancelar sin costo hasta las 8 pm</small>
        </div>}
      </aside>

      {panel === 'checkout' && (
        <section className="modal checkout-modal" role="dialog" aria-modal="true" aria-label="Finalizar pedido">
          <button className="close-button modal-close" onClick={() => { setPanel(null); setCheckoutSuccess(false) }}><X /></button>
          {checkoutSuccess ? (
            <div className="success-state"><div><Check size={34} /></div><span>¡Pedido confirmado!</span><h2>Nos vemos a la hora de comer.</h2><p>Tu número de pedido y recibo ya están guardados en “Mis pedidos”.</p><button className="primary-button" onClick={() => { setPanel('orders'); setCheckoutSuccess(false) }}>Ver mi pedido</button></div>
          ) : (
            <form onSubmit={completeOrder}>
              <span className="section-kicker">Último paso</span><h2>¿Dónde te lo llevamos?</h2>
              <label>Dirección de entrega<input required defaultValue="Álvaro Obregón 213, Roma Norte" /></label>
              <div className="form-row"><label>Piso / oficina<input required placeholder="Piso 4, oficina 402" /></label><label>Teléfono<input required type="tel" placeholder="55 1234 5678" /></label></div>
              <label>Método de pago</label>
              <div className="payment-option selected"><CreditCard size={22} /><div><strong>Tarjeta terminada en 4242</strong><span>Visa · pago seguro</span></div><Check size={17} /></div>
              <div className="checkout-total"><span>Total a pagar</span><strong>{money(total)}</strong></div>
              <button className="primary-button primary-button--full" type="submit">Confirmar y pagar <ArrowRight size={18} /></button>
              <small className="secure-copy">Pago de demostración · no se realizará ningún cargo real</small>
            </form>
          )}
        </section>
      )}

      <aside className={`drawer ${panel === 'orders' ? 'drawer--open' : ''}`} aria-hidden={panel !== 'orders'}>
        <div className="drawer__header"><div><span>Tu cuenta</span><h2>Mis pedidos</h2></div><button className="close-button" onClick={() => setPanel(null)}><X /></button></div>
        <div className="profile-strip"><div>BP</div><p><strong>¡Hola, Bryan!</strong><span>Tu comida, tus tiempos.</span></p></div>
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div><span>{order.id}</span><b>{order.status}</b></div>
              <h3>{order.items.length} {order.items.length === 1 ? 'platillo' : 'platillos'} · {money(order.total)}</h3>
              <p>{new Date(order.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <button>Ver detalle <ChevronRight size={16} /></button>
            </article>
          ))}
          {orders.length === 0 && <div className="empty-cart"><History size={34} /><h3>Aquí aparecerán tus pedidos</h3><p>Cuando confirmes el primero podrás seguirlo desde aquí.</p></div>}
        </div>
      </aside>

      {panel === 'admin' && (
        <section className="admin-modal" role="dialog" aria-modal="true" aria-label="Panel de administración">
          <aside className="admin-sidebar">
            <Logo inverse />
            <div><span>Panel de cocina</span><strong>Administración</strong></div>
            <nav>
              <button className={adminTab === 'menu' ? 'active' : ''} onClick={() => setAdminTab('menu')}><Utensils size={18} /> Menú diario</button>
              <button className={adminTab === 'history' ? 'active' : ''} onClick={() => setAdminTab('history')}><History size={18} /> Pedidos</button>
            </nav>
            <button className="admin-exit" onClick={() => setPanel(null)}><ArrowRight size={17} /> Volver a la tienda</button>
          </aside>
          <div className="admin-content">
            <button className="close-button admin-close" onClick={() => setPanel(null)}><X /></button>
            {adminTab === 'menu' ? <>
              <div className="admin-title"><div><span>Miércoles, 19 de agosto</span><h2>Menú diario</h2><p>Publica, pausa o retira los platillos disponibles por día.</p></div><span className="kitchen-open"><i /> Cocina abierta</span></div>
              <div className="admin-days">
                {days.map((item) => <button key={item.id} className={adminDay === item.id ? 'selected' : ''} onClick={() => setAdminDay(item.id)}><span>{item.short}</span><strong>{item.number}</strong></button>)}
              </div>
              <div className="admin-grid">
                <div className="admin-menu-list">
                  <div className="admin-list-head"><h3>Platillos publicados</h3><span>{(menus[adminDay] ?? []).length} en el menú</span></div>
                  {(menus[adminDay] ?? []).map((meal) => (
                    <article key={meal.id} className={meal.soldOut ? 'paused' : ''}>
                      <div className="admin-thumb" style={{ backgroundPosition: meal.position }} />
                      <div><span>{meal.soldOut ? 'Pausado' : 'Disponible'}</span><h4>{meal.name}</h4><p>{money(meal.price)} · {meal.kcal} kcal</p></div>
                      <button className="status-toggle" onClick={() => toggleMeal(adminDay, meal.id)} aria-label="Cambiar disponibilidad"><i /></button>
                      <button className="trash-button" onClick={() => removeMeal(adminDay, meal.id)} aria-label={`Eliminar ${meal.name}`}><Trash2 size={17} /></button>
                    </article>
                  ))}
                </div>
                <form className="new-meal-form" onSubmit={addAdminMeal}>
                  <span className="section-kicker">Nuevo platillo</span><h3>Agregar al {days.find((item) => item.id === adminDay)?.label.toLowerCase()}</h3>
                  <label>Nombre<input name="name" required placeholder="Ej. Enchiladas verdes" /></label>
                  <label>Descripción<textarea name="description" required placeholder="Ingredientes y acompañamientos" /></label>
                  <div className="form-row"><label>Precio<input name="price" required type="number" min="1" placeholder="139" /></label><label>Calorías<input name="kcal" required type="number" min="1" placeholder="520" /></label></div>
                  <label>Proteína (g)<input name="protein" required type="number" min="0" placeholder="32" /></label>
                  <button className="primary-button primary-button--full" type="submit"><Plus size={17} /> Publicar platillo</button>
                </form>
              </div>
            </> : <>
              <div className="admin-title"><div><span>Operación de hoy</span><h2>Pedidos</h2><p>Historial de pedidos confirmados desde la tienda.</p></div><span className="orders-count">{orders.length} pedidos</span></div>
              <div className="admin-orders-table">
                <div className="table-head"><span>Pedido</span><span>Cliente</span><span>Platillos</span><span>Total</span><span>Estado</span></div>
                {orders.map((order) => <div className="table-row" key={order.id}><strong>{order.id}</strong><span>Bryan Partum</span><span>{order.items.length}</span><strong>{money(order.total)}</strong><b>{order.status}</b></div>)}
                {orders.length === 0 && <div className="empty-state"><PackageCheck size={34} /><h3>Aún no hay pedidos</h3><p>Los pedidos confirmados aparecerán aquí en tiempo real.</p></div>}
              </div>
            </>}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
