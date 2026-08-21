import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Banknote, CalendarDays, Check, ChevronDown, Clock3, CreditCard, Heart, LocateFixed,
  MapPin, Minus, Navigation, Plus, RefreshCw, ShoppingBag, Sparkles, Utensils, WifiOff, X,
} from 'lucide-react'
import { createOrder, getMenu, getMenuDays } from './api'
import Logo from './components/Logo'
import type { CartItem, Meal, MenuDay, MenuResponse, OrderPolicy, PaymentMethod, SavedOrder } from './types'

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)

const DELIVERY_ZONE = 'Lindavista, CDMX' as const
const LINDAVISTA_QUERY = 'Lindavista, Gustavo A. Madero, Ciudad de México'
const WEEKLY_DISCOUNT_RATE = 0.12

type Coordinates = { latitude: number; longitude: number }
type OrderMode = 'day' | 'week'

function mapLinks(address: string, coordinates: Coordinates | null) {
  const query = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : address
      ? `${address}, ${LINDAVISTA_QUERY}`
      : LINDAVISTA_QUERY

  return {
    embed: `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`,
    external: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  }
}

function isNearLindavista({ latitude, longitude }: Coordinates) {
  return latitude >= 19.472 && latitude <= 19.516 && longitude >= -99.151 && longitude <= -99.106
}

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

function loadCart(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as CartItem[]
  } catch {
    return []
  }
}

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('foodiepack:v2:favorites') || '[]') as string[]
  } catch {
    return []
  }
}

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' }

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      })
    }, { threshold: 0.15 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
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

function AcceptedOrderAnimation() {
  return (
    <div className="accepted-order-motion" role="status" aria-label="Pedido aceptado">
      <span className="accepted-order-motion__waiting" aria-hidden="true">Enviando a cocina</span>
      <span className="accepted-order-motion__success" aria-hidden="true">Pedido aceptado
        <svg viewBox="0 0 12 10" aria-hidden="true"><polyline points="1.5 6 4.5 9 10.5 1" /></svg>
      </span>
      <div className="accepted-order-motion__package" aria-hidden="true" />
      <div className="accepted-order-motion__truck" aria-hidden="true">
        <div className="accepted-order-motion__back" />
        <div className="accepted-order-motion__front"><div className="accepted-order-motion__window" /></div>
        <div className="accepted-order-motion__light accepted-order-motion__light--top" />
        <div className="accepted-order-motion__light accepted-order-motion__light--bottom" />
      </div>
      <div className="accepted-order-motion__lines" aria-hidden="true" />
    </div>
  )
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast--${toast.tone}`} key={toast.id}>
          {toast.tone === 'success' && <Check size={14} />}
          <span>{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso"><X size={13} /></button>
        </div>
      ))}
    </div>
  )
}

function MealCard({ meal, canOrder, index, isFavorite, justAdded, onAdd, onToggleFavorite }: {
  meal: Meal
  canOrder: boolean
  index: number
  isFavorite: boolean
  justAdded: boolean
  onAdd: () => void
  onToggleFavorite: () => void
}) {
  const disabled = !canOrder || !meal.available
  const { ref, visible } = useReveal<HTMLElement>()
  return (
    <article
      ref={ref}
      className={`meal-card reveal ${meal.available ? '' : 'meal-card--unavailable'} ${visible ? 'reveal--visible' : ''}`}
      style={{ transitionDelay: visible ? `${Math.min(index, 8) * 50}ms` : '0ms' }}
    >
      <div className="meal-card__media">
        <img src={meal.image} alt={meal.name} loading="lazy" decoding="async" />
        {!meal.available && <span className="meal-card__sold-out">Agotado</span>}
        <button
          type="button"
          className={`meal-card__favorite ${isFavorite ? 'meal-card__favorite--active' : ''}`}
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Quitar ${meal.name} de favoritos` : `Guardar ${meal.name} en favoritos`}
        >
          <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <div className="meal-card__chips">
          <span>{meal.tags[0] || 'Menú del día'}</span>
          <b>{money(meal.price)}</b>
        </div>
      </div>
      <div className="meal-card__content">
        <h2>{meal.name}</h2>
        <p>{meal.description}</p>
        <div className="meal-card__bottom">
          <span>{meal.protein} g proteína</span>
          <span>{meal.kcal} kcal</span>
          <button className={justAdded ? 'meal-card__add--pop' : ''} disabled={disabled} onClick={onAdd}>
            {meal.available
              ? (canOrder ? (justAdded ? <><Check size={16} /> Agregado</> : <><Plus size={16} /> Agregar</>) : 'Vista previa')
              : 'No disponible'}
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
        <p><span>Entrega</span><strong>{deliveryDate ? fullDate(deliveryDate) : 'Mañana'} · 1:30 a 2:00 pm</strong></p>
      </div>
      <div className="summary-items">
        {cart.map((item) => (
          <div className="summary-item" key={item.meal.id}>
            <div className="summary-item__thumb" style={{ backgroundImage: `url(${item.meal.image})` }} />
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
      <small>Pedido de demostración. No se realizará un cargo real.</small>
    </aside>
  )
}

function WeeklySummary({ days, weeklyByDate, subtotal, deliveryFee, discountRate, discountAmount, total, prepayWeek, weeklyIsFull, canOrder, onTogglePrepay, onQuantity, onCheckout }: {
  days: MenuDay[]
  weeklyByDate: Map<string, CartItem[]>
  subtotal: number
  deliveryFee: number
  discountRate: number
  discountAmount: number
  total: number
  prepayWeek: boolean
  weeklyIsFull: boolean
  canOrder: boolean
  onTogglePrepay: () => void
  onQuantity: (mealId: string, date: string, change: number) => void
  onCheckout: () => void
}) {
  const totalItems = days.reduce((sum, day) => sum + (weeklyByDate.get(day.date) || []).reduce((s, i) => s + i.quantity, 0), 0)

  return (
    <aside className="order-summary" id="pedido">
      <div className="order-summary__head">
        <span>Tu semana</span>
        <strong>{totalItems} productos</strong>
      </div>
      <div className="summary-items summary-items--weekly">
        {days.map((day) => {
          const items = weeklyByDate.get(day.date) || []
          return (
            <div className="weekly-day-group" key={day.date}>
              <p className="weekly-day-group__label">{dayName(day.date, true)} {dateFromKey(day.date).getDate()}</p>
              {items.length === 0 && <p className="weekly-day-group__empty">Sin platillos todavía</p>}
              {items.map((item) => (
                <div className="summary-item" key={`${day.date}:${item.meal.id}`}>
                  <div className="summary-item__thumb" style={{ backgroundImage: `url(${item.meal.image})` }} />
                  <p><strong>{item.meal.name}</strong><span>{money(item.meal.price)}</span></p>
                  <div className="counter">
                    <button onClick={() => onQuantity(item.meal.id, day.date, -1)} aria-label={`Quitar ${item.meal.name}`}><Minus size={12} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => onQuantity(item.meal.id, day.date, 1)} aria-label={`Agregar otro ${item.meal.name}`}><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <label className={`weekly-discount ${weeklyIsFull ? '' : 'weekly-discount--disabled'}`}>
        <input type="checkbox" checked={prepayWeek} disabled={!weeklyIsFull} onChange={onTogglePrepay} />
        <span>
          <strong>Pagar toda la semana por adelantado</strong>
          <small>{weeklyIsFull ? 'Desbloqueado: ahorra en tu semana completa' : 'Agrega platillos los 5 días para desbloquear el descuento'}</small>
        </span>
        <b>-{Math.round(WEEKLY_DISCOUNT_RATE * 100)}%</b>
      </label>
      <div className="summary-totals">
        <p><span>Comida</span><strong>{money(subtotal)}</strong></p>
        {discountRate > 0 && <p className="summary-discount"><span>Descuento semanal</span><strong>-{money(discountAmount)}</strong></p>}
        <p><span>Envío ({days.filter((d) => (weeklyByDate.get(d.date)?.length || 0) > 0).length} días)</span><strong>{money(deliveryFee)}</strong></p>
        <p className="summary-total"><span>Total</span><strong>{money(total)}</strong></p>
      </div>
      <button className="checkout-button" disabled={totalItems === 0 || !canOrder} onClick={onCheckout}>Continuar <ArrowRight size={17} /></button>
      <small>Pedido de demostración. No se realizará un cargo real.</small>
    </aside>
  )
}

function App() {
  const [preloading, setPreloading] = useState(true)
  const [days, setDays] = useState<MenuDay[]>([])
  const [policy, setPolicy] = useState<OrderPolicy | null>(null)
  const [orderMode, setOrderMode] = useState<OrderMode>('day')
  const [selectedDate, setSelectedDate] = useState('')
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [cart, setCart] = useState<CartItem[]>(() => loadCart('foodiepack:v2:cart'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeWeekDay, setActiveWeekDay] = useState('')
  const [weeklyMenus, setWeeklyMenus] = useState<Record<string, MenuResponse>>({})
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyCart, setWeeklyCart] = useState<CartItem[]>(() => loadCart('foodiepack:v2:weeklycart'))
  const [prepayWeek, setPrepayWeek] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<SavedOrder | null>(null)
  const [orderError, setOrderError] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [pinnedAddress, setPinnedAddress] = useState('')
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null)
  const [deliveryError, setDeliveryError] = useState('')
  const [locating, setLocating] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [retryTick, setRetryTick] = useState(0)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const toastId = useRef(0)

  const dismissToast = (id: number) => setToasts((items) => items.filter((item) => item.id !== id))

  const pushToast = (message: string, tone: Toast['tone'] = 'info') => {
    const id = (toastId.current += 1)
    setToasts((items) => [...items, { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 3200)
  }

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
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    getMenuDays()
      .then(({ days: availableDays, policy: currentPolicy }) => {
        const eligibleDates = availableDays.map((day) => day.date)
        setDays(availableDays)
        setPolicy(currentPolicy)
        setSelectedDate((current) => current || currentPolicy.tomorrow)
        setActiveWeekDay((current) => current || availableDays[0]?.date || '')
        setCart((items) => items.filter((item) => eligibleDates.includes(item.date)))
        setWeeklyCart((items) => items.filter((item) => eligibleDates.includes(item.date)))
      })
      .catch(() => setError('No pudimos conectar con la cocina. Intenta nuevamente en un momento.'))
  }, [retryTick])

  useEffect(() => {
    if (!selectedDate || orderMode !== 'day') return
    let active = true
    setLoading(true)
    setError('')
    getMenu(selectedDate)
      .then((response) => { if (active) setMenu(response) })
      .catch(() => { if (active) setError('No pudimos cargar el menú de este día.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedDate, orderMode, retryTick])

  useEffect(() => {
    if (orderMode !== 'week' || days.length === 0) return
    let active = true
    setWeeklyLoading(true)
    setError('')
    Promise.all(days.map((day) => getMenu(day.date).then((response) => [day.date, response] as const)))
      .then((entries) => { if (active) setWeeklyMenus(Object.fromEntries(entries)) })
      .catch(() => { if (active) setError('No pudimos cargar el plan semanal.') })
      .finally(() => { if (active) setWeeklyLoading(false) })
    return () => { active = false }
  }, [orderMode, days, retryTick])

  useEffect(() => {
    localStorage.setItem('foodiepack:v2:cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem('foodiepack:v2:weeklycart', JSON.stringify(weeklyCart))
  }, [weeklyCart])

  useEffect(() => {
    localStorage.setItem('foodiepack:v2:favorites', JSON.stringify(favorites))
  }, [favorites])

  const orderingOpen = Boolean(policy?.isOpen)
  const isTomorrow = menu?.policy.tomorrow === selectedDate
  const featuredMeal = menu?.meals.find((meal) => meal.available) || menu?.meals[0]
  const deliveryMap = mapLinks(pinnedAddress, deliveryCoordinates)
  const hasDeliveryPin = Boolean(pinnedAddress || deliveryCoordinates)

  const currentMeals = useMemo(
    () => orderMode === 'day' ? (menu?.meals || []) : (weeklyMenus[activeWeekDay]?.meals || []),
    [orderMode, menu, weeklyMenus, activeWeekDay],
  )
  const availableTags = useMemo(
    () => Array.from(new Set(currentMeals.flatMap((meal) => meal.tags))).filter(Boolean),
    [currentMeals],
  )
  const visibleMeals = useMemo(() => currentMeals
    .filter((meal) => !activeTag || meal.tags.includes(activeTag))
    .filter((meal) => !onlyFavorites || favorites.includes(meal.id)), [currentMeals, activeTag, onlyFavorites, favorites])
  const isLoadingCurrent = orderMode === 'day' ? loading : weeklyLoading

  const cartCount = (orderMode === 'week' ? weeklyCart : cart).reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.meal.price * item.quantity, 0) + (cart.length ? 29 : 0), [cart])

  const weeklyByDate = useMemo(() => {
    const map = new Map<string, CartItem[]>()
    for (const day of days) map.set(day.date, [])
    for (const item of weeklyCart) {
      if (!map.has(item.date)) map.set(item.date, [])
      map.get(item.date)!.push(item)
    }
    return map
  }, [weeklyCart, days])
  const weeklyDaysCovered = days.filter((day) => (weeklyByDate.get(day.date)?.length || 0) > 0).length
  const weeklyIsFull = days.length > 0 && weeklyDaysCovered === days.length
  const weeklySubtotal = weeklyCart.reduce((sum, item) => sum + item.meal.price * item.quantity, 0)
  const weeklyDeliveryDays = new Set(weeklyCart.map((item) => item.date)).size
  const weeklyDeliveryFee = weeklyDeliveryDays * 29
  const weeklyDiscountRate = prepayWeek && weeklyIsFull ? WEEKLY_DISCOUNT_RATE : 0
  const weeklyDiscountAmount = Math.round(weeklySubtotal * weeklyDiscountRate)
  const weeklyTotal = weeklySubtotal - weeklyDiscountAmount + weeklyDeliveryFee

  const toggleFavorite = (mealId: string) => {
    setFavorites((current) => current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId])
  }

  const addMeal = (meal: Meal) => {
    if (!orderingOpen || !menu) return
    setCart((items) => {
      const existing = items.find((item) => item.meal.id === meal.id)
      return existing
        ? items.map((item) => item.meal.id === meal.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { meal, quantity: 1, date: menu.policy.tomorrow }]
    })
    pushToast(`${meal.name} se agregó a tu pedido`, 'success')
    setAddedKey(meal.id)
    window.setTimeout(() => setAddedKey((current) => current === meal.id ? null : current), 1100)
  }

  const changeQuantity = (mealId: string, change: number) => {
    setCart((items) => items
      .map((item) => item.meal.id === mealId ? { ...item, quantity: item.quantity + change } : item)
      .filter((item) => item.quantity > 0))
  }

  const addWeeklyMeal = (meal: Meal, date: string) => {
    if (!orderingOpen) return
    setWeeklyCart((items) => {
      const existing = items.find((item) => item.meal.id === meal.id && item.date === date)
      return existing
        ? items.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { meal, quantity: 1, date }]
    })
    pushToast(`${meal.name} se agregó a ${dayName(date, true)}`, 'success')
    const key = `${meal.id}::${date}`
    setAddedKey(key)
    window.setTimeout(() => setAddedKey((current) => current === key ? null : current), 1100)
  }

  const changeWeeklyQuantity = (mealId: string, date: string, change: number) => {
    setWeeklyCart((items) => items
      .map((item) => (item.meal.id === mealId && item.date === date) ? { ...item, quantity: item.quantity + change } : item)
      .filter((item) => item.quantity > 0))
  }

  const updateDeliveryAddress = (value: string) => {
    setDeliveryAddress(value)
    setPinnedAddress('')
    setDeliveryCoordinates(null)
    setDeliveryError('')
  }

  const pinDeliveryAddress = () => {
    const address = deliveryAddress.trim()
    if (address.length < 8) {
      setDeliveryError('Escribe la calle y el número antes de colocar el pin.')
      return
    }
    setPinnedAddress(address)
    setDeliveryCoordinates(null)
    setDeliveryError('')
  }

  const useCurrentLocation = () => {
    if (deliveryAddress.trim().length < 8) {
      setDeliveryError('Primero escribe la dirección de la oficina.')
      return
    }
    if (!navigator.geolocation) {
      setDeliveryError('Este dispositivo no permite obtener la ubicación. Puedes ubicar la dirección escrita.')
      return
    }

    setLocating(true)
    setDeliveryError('')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const location = { latitude: coords.latitude, longitude: coords.longitude }
      setLocating(false)
      if (!isNearLindavista(location)) {
        setDeliveryError('La ubicación actual parece estar fuera de Lindavista. Revisa la dirección y pulsa Ubicar dirección.')
        return
      }
      setDeliveryCoordinates(location)
      setPinnedAddress(deliveryAddress.trim())
    }, () => {
      setLocating(false)
      setDeliveryError('No pudimos obtener tu ubicación. Puedes ubicar la dirección escrita.')
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 })
  }

  const activeCartItems = orderMode === 'week' ? weeklyCart : cart
  const activeTotal = orderMode === 'week' ? weeklyTotal : cartTotal
  const isWeeklyPlanOrder = orderMode === 'week' && prepayWeek && weeklyIsFull

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isOnline) {
      setOrderError('Sin conexión a internet. Reconéctate para confirmar tu pedido.')
      return
    }
    if (!hasDeliveryPin) {
      setDeliveryError('Ubica la dirección en el mapa antes de confirmar el pedido.')
      return
    }
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setOrderError('')
    try {
      const response = await createOrder({
        customer: {
          name: String(form.get('name')),
          phone: String(form.get('phone')),
          notes: String(form.get('notes') || ''),
        },
        delivery: {
          zone: DELIVERY_ZONE,
          address: deliveryAddress.trim(),
          office: String(form.get('office')),
          pinConfirmed: true,
          ...(deliveryCoordinates ? { coordinates: deliveryCoordinates } : {}),
        },
        paymentMethod,
        isWeeklyPlan: isWeeklyPlanOrder,
        items: activeCartItems.map((item) => ({ mealId: item.meal.id, date: item.date, quantity: item.quantity })),
      })
      setOrder(response.order)
      if (orderMode === 'week') {
        setWeeklyCart([])
        setPrepayWeek(false)
      } else {
        setCart([])
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo confirmar el pedido'
      setOrderError(message)
      pushToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const scrollToMenu = () => document.querySelector('#menu-del-dia')?.scrollIntoView({ behavior: 'smooth' })
  const scrollToSummary = () => document.querySelector('#pedido')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="storefront">
      {preloading && <BrandPreloader />}
      {!isOnline && (
        <div className="offline-banner" role="alert">
          <WifiOff size={14} /> Sin conexión a internet. Algunas acciones no estarán disponibles.
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <header className={`store-header ${headerScrolled ? 'store-header--scrolled' : ''}`}>
        <a href="/" aria-label="Inicio"><Logo /></a>
        <div className="store-header__delivery">
          <span>Zona de entrega</span>
          <button onClick={scrollToMenu}>Lindavista, CDMX <ChevronDown size={14} /></button>
        </div>
        <button className="header-cart" onClick={scrollToSummary}>
          <ShoppingBag size={18} /><span>Pedido</span>{cartCount > 0 && <b key={cartCount} className="header-cart__badge">{cartCount}</b>}
        </button>
      </header>

      <section className="brand-landing" aria-labelledby="landing-title">
        <div className="brand-landing__inner">
          <div className="brand-landing__copy">
            <p>FoodiePack · Lindavista</p>
            <h1 id="landing-title">Tu cocina<br />en la <em>oficina.</em></h1>
            <span>Pide hoy y mañana te llevamos comida fresca hasta tu oficina en Lindavista.</span>
            <div className="brand-landing__actions">
              <a href="#menu-del-dia">Elegir mi comida <ArrowRight size={17} /></a>
              <small><Clock3 size={15} /> Pide hoy de 8:00 am a 6:00 pm</small>
            </div>
          </div>
          <div className="brand-landing__visual">
            <div className="landing-dish" style={{ backgroundImage: featuredMeal ? `url(${featuredMeal.image})` : undefined }} role="img" aria-label={featuredMeal?.name || 'Comida preparada por FoodiePack'}>
              <div className="landing-date"><span>Entrega</span><strong>{menu?.policy.tomorrow ? dateFromKey(menu.policy.tomorrow).getDate() : '...'}</strong><small>{menu?.policy.tomorrow ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(dateFromKey(menu.policy.tomorrow)).replace('.', '') : 'pronto'}</small></div>
            </div>
            <div className="landing-caption">
              <span>Del menú de mañana</span>
              <strong>{featuredMeal?.name || 'Cocinando el menú…'}</strong>
              <b>{featuredMeal ? money(featuredMeal.price) : '...'}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="weekly-promo" aria-labelledby="weekly-promo-title">
        <div className="weekly-promo__inner">
          <div className="weekly-promo__media">
            <img src="/assets/meals/weekly-hero.jpg" alt="Comidas de la semana en contenedores" loading="lazy" />
          </div>
          <div className="weekly-promo__copy">
            <span><Sparkles size={13} /> Nuevo</span>
            <h2 id="weekly-promo-title">Arma tu semana completa</h2>
            <p>Elige tus comidas de cada día, paga por adelantado y ahorra {Math.round(WEEKLY_DISCOUNT_RATE * 100)}% en toda tu semana.</p>
            <button type="button" onClick={() => { setOrderMode('week'); scrollToMenu() }}>Armar mi semana <ArrowRight size={16} /></button>
          </div>
        </div>
      </section>

      <main className="order-workspace" id="menu-del-dia">
        <section className="menu-column">
          <div className={`order-window ${orderingOpen ? 'order-window--open' : ''}`}>
            <span className="order-window__status"><i />{orderingOpen ? 'Pedidos abiertos' : 'Pedidos cerrados'}</span>
            <p>Reserva hasta 5 días</p>
            <strong>8:00 am a 6:00 pm</strong>
            <small>Hora de Ciudad de México</small>
          </div>

          <div className="order-mode-toggle" role="tablist" aria-label="Modo de pedido">
            <button role="tab" aria-selected={orderMode === 'day'} className={orderMode === 'day' ? 'selected' : ''} onClick={() => setOrderMode('day')}>Pedido de mañana</button>
            <button role="tab" aria-selected={orderMode === 'week'} className={orderMode === 'week' ? 'selected' : ''} onClick={() => setOrderMode('week')}>Plan semanal <b>-{Math.round(WEEKLY_DISCOUNT_RATE * 100)}%</b></button>
          </div>

          {orderMode === 'day' ? (
            <>
              <div className="menu-title">
                <p>{isTomorrow ? 'Entrega de mañana' : 'Próximamente'}</p>
                <h1>{selectedDate ? fullDate(selectedDate) : 'Menú'}</h1>
                <span>{isTomorrow
                  ? (orderingOpen ? 'Haz tu pedido hoy. Lo cocinamos mañana por la mañana.' : 'La ventana de pedido está cerrada. Vuelve entre 8:00 am y 6:00 pm.')
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
            </>
          ) : (
            <>
              <div className="menu-title">
                <p>Plan semanal</p>
                <h1>{activeWeekDay ? fullDate(activeWeekDay) : 'Elige tus días'}</h1>
                <span>{weeklyIsFull
                  ? 'Ya cubriste toda la semana. Activa el pago por adelantado para ahorrar.'
                  : `Elige platillos para cada día. Cubre los ${days.length || 5} días para desbloquear ${Math.round(WEEKLY_DISCOUNT_RATE * 100)}% de descuento.`}</span>
              </div>

              <div className="date-strip" aria-label="Días de tu plan semanal">
                {days.map((day, index) => {
                  const count = (weeklyByDate.get(day.date) || []).reduce((sum, item) => sum + item.quantity, 0)
                  return (
                    <button key={day.date} className={activeWeekDay === day.date ? 'selected' : ''} onClick={() => setActiveWeekDay(day.date)}>
                      <span>{index === 0 ? 'Mañana' : dayName(day.date)}</span>
                      <strong>{dateFromKey(day.date).getDate()}</strong>
                      <small>{count > 0 ? `${count} en tu plan` : `${day.mealCount} opciones`}</small>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {error && (
            <div className="inline-error">
              <span>{error}</span>
              <button type="button" onClick={() => setRetryTick((tick) => tick + 1)}><RefreshCw size={12} /> Reintentar</button>
            </div>
          )}

          {!isLoadingCurrent && Boolean(currentMeals.length) && (
            <div className="filter-chips" aria-label="Filtrar menú">
              <button className={!activeTag && !onlyFavorites ? 'selected' : ''} onClick={() => { setActiveTag(null); setOnlyFavorites(false) }}>Todo</button>
              {availableTags.map((tag) => (
                <button key={tag} className={activeTag === tag ? 'selected' : ''} onClick={() => setActiveTag((current) => current === tag ? null : tag)}>{tag}</button>
              ))}
              <button className={`filter-chips__favorite ${onlyFavorites ? 'selected' : ''}`} onClick={() => setOnlyFavorites((value) => !value)}>
                <Heart size={12} fill={onlyFavorites ? 'currentColor' : 'none'} /> Favoritos{favorites.length > 0 ? ` (${favorites.length})` : ''}
              </button>
            </div>
          )}

          <div className="meal-grid">
            {isLoadingCurrent && Array.from({ length: 4 }, (_, index) => <div className="meal-skeleton" key={index} />)}
            {!isLoadingCurrent && visibleMeals.map((meal, index) => (
              <MealCard
                key={meal.id}
                meal={meal}
                canOrder={orderingOpen}
                index={index}
                isFavorite={favorites.includes(meal.id)}
                justAdded={addedKey === (orderMode === 'week' ? `${meal.id}::${activeWeekDay}` : meal.id)}
                onAdd={() => orderMode === 'week' ? addWeeklyMeal(meal, activeWeekDay) : addMeal(meal)}
                onToggleFavorite={() => toggleFavorite(meal.id)}
              />
            ))}
            {!isLoadingCurrent && currentMeals.length === 0 && <div className="menu-empty"><h2>Menú pendiente</h2><p>La cocina todavía no publica las opciones para este día.</p></div>}
            {!isLoadingCurrent && Boolean(currentMeals.length) && visibleMeals.length === 0 && (
              <div className="menu-empty"><h2>Sin resultados</h2><p>Ningún platillo coincide con este filtro. Prueba con otro.</p></div>
            )}
          </div>
        </section>

        {orderMode === 'day' ? (
          <OrderSummary cart={cart} deliveryDate={menu?.policy.tomorrow || ''} canOrder={orderingOpen} onQuantity={changeQuantity} onCheckout={() => setCheckoutOpen(true)} />
        ) : (
          <WeeklySummary
            days={days}
            weeklyByDate={weeklyByDate}
            subtotal={weeklySubtotal}
            deliveryFee={weeklyDeliveryFee}
            discountRate={weeklyDiscountRate}
            discountAmount={weeklyDiscountAmount}
            total={weeklyTotal}
            prepayWeek={prepayWeek}
            weeklyIsFull={weeklyIsFull}
            canOrder={orderingOpen}
            onTogglePrepay={() => setPrepayWeek((value) => !value)}
            onQuantity={changeWeeklyQuantity}
            onCheckout={() => setCheckoutOpen(true)}
          />
        )}
      </main>

      <nav className="app-tabbar" aria-label="Navegación">
        <button className={orderMode === 'day' ? 'active' : ''} onClick={() => { setOrderMode('day'); scrollToMenu() }}>
          <Utensils size={20} /><span>Menú</span>
        </button>
        <button className={orderMode === 'week' ? 'active' : ''} onClick={() => { setOrderMode('week'); scrollToMenu() }}>
          <CalendarDays size={20} /><span>Semana</span>
        </button>
        <button onClick={scrollToSummary}>
          <span className="app-tabbar__cart"><ShoppingBag size={20} />{cartCount > 0 && <b>{cartCount}</b>}</span>
          <span>Pedido</span>
        </button>
      </nav>

      {checkoutOpen && <button className="modal-backdrop" aria-label="Cerrar" onClick={() => { setCheckoutOpen(false); setOrder(null); setOrderError('') }} />}
      {checkoutOpen && (
        <section className="checkout-dialog" role="dialog" aria-modal="true" aria-label="Confirmar pedido">
          <div className="sheet-handle" aria-hidden="true" />
          <button className="dialog-close" onClick={() => { setCheckoutOpen(false); setOrder(null); setOrderError('') }} aria-label="Cerrar"><X size={20} /></button>
          {order ? (
            <div className="order-confirmed">
              <AcceptedOrderAnimation />
              <p>Pedido {order.id}</p>
              <h2>{order.isWeeklyPlan ? 'Tu semana está lista.' : 'Nos vemos mañana.'}</h2>
              <small>
                La cocina aceptó tu pedido{order.isWeeklyPlan ? ', con descuento de plan semanal aplicado' : ''}. Llegará a {order.delivery?.office || 'tu oficina'} de 1:30 a 2:00 pm.
                {' '}Pagarás {order.paymentMethod === 'card' ? 'con tarjeta' : 'en efectivo'} al recibir.
              </small>
              {order.delivery?.mapUrl && <a className="confirmed-map-link" href={order.delivery.mapUrl} target="_blank" rel="noreferrer"><MapPin size={14} /> Ver dirección guardada</a>}
              <button onClick={() => { setCheckoutOpen(false); setOrder(null); setOrderError('') }}>Cerrar</button>
            </div>
          ) : (
            <form onSubmit={placeOrder}>
              <p>Confirmar pedido</p>
              <h2>{orderMode === 'week' ? 'Plan semanal' : 'Datos de entrega'}</h2>
              {orderMode === 'week' && (
                <div className="weekly-recap">
                  <CalendarDays size={16} />
                  <p><span>{weeklyDeliveryDays} {weeklyDeliveryDays === 1 ? 'día' : 'días'} de entrega</span>
                    <strong>{isWeeklyPlanOrder ? `Ahorras ${money(weeklyDiscountAmount)}` : 'Sin descuento semanal'}</strong></p>
                </div>
              )}
              <div className="delivery-zone-card">
                <MapPin size={20} />
                <p><span>Zona disponible</span><strong>Lindavista, CDMX</strong></p>
                <b>Envío {money(29)}/día</b>
              </div>
              <label>Nombre<input name="name" autoComplete="name" required /></label>
              <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required /></label>
              <label>Dirección en Lindavista<input name="address" autoComplete="street-address" required minLength={8} value={deliveryAddress} onChange={(event) => updateDeliveryAddress(event.target.value)} placeholder="Calle y número" /></label>
              <label>Empresa, edificio u oficina<input name="office" autoComplete="organization" required minLength={2} placeholder="Empresa, edificio, piso u oficina" /></label>
              <div className="delivery-map-tools">
                <button type="button" onClick={pinDeliveryAddress}><Navigation size={15} /> Ubicar dirección</button>
                <button type="button" onClick={useCurrentLocation} disabled={locating}><LocateFixed size={15} /> {locating ? 'Ubicando…' : 'Usar mi ubicación'}</button>
              </div>
              <div className={`delivery-map ${hasDeliveryPin ? 'delivery-map--pinned' : ''}`}>
                <iframe title="Pin de entrega en Lindavista" src={deliveryMap.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                <div>
                  <span><i />{hasDeliveryPin ? 'Pin listo' : 'Vista de la zona'}</span>
                  <a href={deliveryMap.external} target="_blank" rel="noreferrer">Abrir en Google Maps <ArrowRight size={13} /></a>
                </div>
              </div>
              {deliveryError && <div className="delivery-error">{deliveryError}</div>}
              <label>Indicaciones opcionales<textarea name="notes" maxLength={300} /></label>

              <div className="payment-method">
                <span>Método de pago</span>
                <div className="payment-method__options">
                  <button type="button" className={paymentMethod === 'card' ? 'selected' : ''} onClick={() => setPaymentMethod('card')}><CreditCard size={16} /> Tarjeta</button>
                  <button type="button" className={paymentMethod === 'cash' ? 'selected' : ''} onClick={() => setPaymentMethod('cash')}><Banknote size={16} /> Efectivo</button>
                </div>
              </div>

              {orderError && <div className="inline-error"><span>{orderError}</span></div>}
              <div className="checkout-dialog__total"><span>Total</span><strong>{money(activeTotal)}</strong></div>
              <button className="checkout-button" disabled={submitting || !isOnline}>{submitting ? 'Confirmando…' : (isOnline ? 'Confirmar pedido' : 'Sin conexión')}</button>
              <small>Este prototipo no procesa pagos reales.</small>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

export default App
