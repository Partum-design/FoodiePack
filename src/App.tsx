import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Banknote, CalendarDays, Check, ChevronDown, Clock3, Heart, Landmark, LocateFixed,
  MapPin, Minus, Navigation, Plus, RefreshCw, ShoppingBag, Sparkles, Utensils, WifiOff, X,
} from 'lucide-react'
import { createOrder, getMenu, getMenuDays } from './api'
import FloatingDecor from './components/FloatingDecor'
import Logo from './components/Logo'
import {
  BANK_TRANSFER, ORDER_KEY_POINTS, PACKAGE_ORDER, PACKAGES, REPEAT_GUISADO_SURCHARGE, REPEAT_GUISADO_TIER,
} from './packages'
import type { PackageTier } from './packages'
import type { Meal, MenuDay, MenuResponse, OrderPolicy, PaymentMethod, SavedOrder } from './types'

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)

const DELIVERY_ZONE = 'Lindavista, CDMX' as const
const LINDAVISTA_QUERY = 'Lindavista, Gustavo A. Madero, Ciudad de México'
const MAX_WEEKLY_SAVINGS = Math.max(...PACKAGE_ORDER.map((tier) => PACKAGES[tier].weeklyRegular - PACKAGES[tier].weeklyPrepay))

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
      <FloatingDecor />
      <div className="brand-preloader__lockup">
        <Logo hero theme="white" />
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

function PromoPopup({ dateLabel, onClose, onExplore }: { dateLabel: string; onClose: () => void; onExplore: () => void }) {
  return (
    <>
      <button className="modal-backdrop" aria-label="Cerrar" onClick={onClose} />
      <section className="promo-popup" role="dialog" aria-modal="true" aria-label="Promoción de lanzamiento 2x1">
        <button className="dialog-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        <span className="promo-popup__badge"><Sparkles size={13} /> Lanzamiento</span>
        <h2>2x1 <em>en tu pedido</em></h2>
        <p>Solo el <strong>{dateLabel}</strong>: paga la mitad de tus paquetes y llévate el doble para tu equipo.</p>
        <button type="button" className="promo-popup__cta" onClick={onExplore}>Aprovechar el 2x1 <ArrowRight size={16} /></button>
        <small>La promo ya está activada en tu pedido.</small>
      </section>
    </>
  )
}

function DishCard({ meal, index, isFavorite, onToggleFavorite, selectedPackage, selectedMealId, onChoosePackage }: {
  meal: Meal
  index: number
  isFavorite: boolean
  onToggleFavorite: () => void
  selectedPackage: PackageTier | null
  selectedMealId: string | null
  onChoosePackage: (mealId: string, tier: PackageTier) => void
}) {
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
          <span>{meal.tags[0] || 'Guisado del día'}</span>
        </div>
      </div>
      <div className="meal-card__content">
        <h2>{meal.name}</h2>
        <p>{meal.description}</p>
        <div className="meal-card__packages">
          <span>Elige paquete</span>
          <div>
            {PACKAGE_ORDER.filter((tier) => meal.packages.includes(tier)).map((tier) => {
              const pack = PACKAGES[tier]
              const selected = selectedMealId === meal.id && selectedPackage === tier
              return (
                <button
                  type="button"
                  key={tier}
                  className={selected ? 'selected' : ''}
                  disabled={!meal.available}
                  onClick={() => onChoosePackage(meal.id, tier)}
                >
                  <b>{pack.label}</b><small>{money(pack.dailyPrice)}/día</small>
                </button>
              )
            })}
          </div>
        </div>
        <div className="meal-card__bottom">
          <b className={`dish-availability ${meal.available ? '' : 'dish-availability--out'}`}>{meal.available ? 'Disponible' : 'Agotado'}</b>
        </div>
      </div>
    </article>
  )
}

function PackagePicker({ selected, onSelect }: { selected: PackageTier | null; onSelect: (tier: PackageTier) => void }) {
  return (
    <div className="package-grid">
      {PACKAGE_ORDER.map((tier) => {
        const pack = PACKAGES[tier]
        const isSelected = selected === tier
        return (
          <article className={`package-card ${isSelected ? 'package-card--selected' : ''} ${tier === 'ejecutivo' ? 'package-card--popular' : ''}`} key={tier}>
            {tier === 'ejecutivo' && <span className="package-card__badge">Más pedido</span>}
            <h3>{pack.label}</h3>
            <p className="package-card__price"><b>{money(pack.dailyPrice)}</b><span>/día</span></p>
            <ul>
              {pack.includes.map((item) => <li key={item}><span>{item}</span></li>)}
              <li><span>Semanal regular · 5 días</span><strong>{money(pack.weeklyRegular)}</strong></li>
              <li><span>Pago por adelantado</span><strong>{money(pack.weeklyPrepay)}</strong></li>
            </ul>
            <button type="button" className={isSelected ? 'selected' : ''} onClick={() => onSelect(tier)}>
              {isSelected ? <><Check size={15} /> Elegido</> : 'Elegir este paquete'}
            </button>
          </article>
        )
      })}
    </div>
  )
}

function PackagesSection({ selected, onSelect }: { selected: PackageTier | null; onSelect: (tier: PackageTier) => void }) {
  return (
    <section className="packages-section" id="paquetes" aria-labelledby="packages-title">
      <div className="packages-section__head">
        <p>Paquetes</p>
        <h2 id="packages-title">Elige tu paquete</h2>
        <span>Precio fijo por día. Tú eliges cuánto comer, la cocina decide el guisado del día.</span>
      </div>

      <PackagePicker selected={selected} onSelect={onSelect} />
      <p className="packages-footnote">*Si prefieres repetir el mismo guisado en el Menú Completo, aplica un cargo de +{money(REPEAT_GUISADO_SURCHARGE)}.</p>

      <div className="packages-info">
        <div className="key-points">
          <h3>Puntos clave para tu pedido</h3>
          <ul>
            {ORDER_KEY_POINTS.map((point) => (
              <li key={point.title}><strong>{point.title}:</strong> {point.detail}</li>
            ))}
          </ul>
        </div>

      </div>
    </section>
  )
}

function OrderSummary({ packageTier, quantity, repeatGuisado, promo2x1, deliveryDate, meal, canOrder, onQuantity, onToggleRepeat, onTogglePromo2x1, onCheckout }: {
  packageTier: PackageTier | null
  quantity: number
  repeatGuisado: boolean
  promo2x1: boolean
  deliveryDate: string
  meal: Meal | null
  canOrder: boolean
  onQuantity: (change: number) => void
  onToggleRepeat: () => void
  onTogglePromo2x1: () => void
  onCheckout: () => void
}) {
  const pack = packageTier ? PACKAGES[packageTier] : null
  const canRepeat = packageTier === REPEAT_GUISADO_TIER
  const surcharge = pack && canRepeat && repeatGuisado ? REPEAT_GUISADO_SURCHARGE * quantity : 0
  const subtotal = pack ? pack.dailyPrice * quantity : 0
  const paidQuantity = promo2x1 ? Math.ceil(quantity / 2) : quantity
  const promoDiscount = pack && promo2x1 ? pack.dailyPrice * (quantity - paidQuantity) : 0
  const total = subtotal + surcharge - promoDiscount

  return (
    <aside className="order-summary" id="pedido">
      <div className="order-summary__head">
        <span>Tu pedido</span>
        <strong>{pack ? pack.label : 'Elige un paquete'}</strong>
      </div>
      <div className="order-summary__date">
        <Clock3 size={18} />
        <p><span>Entrega</span><strong>{deliveryDate ? fullDate(deliveryDate) : 'Próximo día hábil'} · 12:00 a 2:00 pm</strong></p>
      </div>
      {(!pack || !meal) && <div className="summary-empty"><ShoppingBag size={24} /><p>{pack ? 'Elige una comida del menú para continuar.' : 'Elige una comida y uno de los 3 paquetes para continuar.'}</p></div>}
      {pack && (
        <div className="summary-items">
          {meal && <div className="summary-meal"><span>Comida elegida</span><strong>{meal.name}</strong></div>}
          <div className="summary-package">
            <p><strong>{pack.label}</strong><span>{money(pack.dailyPrice)} por día</span></p>
            <div className="counter">
              <button onClick={() => onQuantity(-1)} aria-label="Quitar una persona"><Minus size={12} /></button>
              <span>{quantity}</span>
              <button onClick={() => onQuantity(1)} aria-label="Agregar una persona"><Plus size={12} /></button>
            </div>
          </div>
          <label className="weekly-discount promo-toggle">
            <input type="checkbox" checked={promo2x1} onChange={onTogglePromo2x1} />
            <span>
              <strong>Promo 2x1 · {deliveryDate ? fullDate(deliveryDate).toLowerCase() : 'lanzamiento'}</strong>
              <small>Paga la mitad de tus paquetes, llévate todos</small>
            </span>
            <b>-{money(promoDiscount)}</b>
          </label>
          {canRepeat && (
            <label className="repeat-guisado">
              <input type="checkbox" checked={repeatGuisado} onChange={onToggleRepeat} />
              <span>Repetir el mismo guisado</span>
              <b>+{money(REPEAT_GUISADO_SURCHARGE)}</b>
            </label>
          )}
        </div>
      )}
      <div className="summary-totals">
        <p><span>Paquete</span><strong>{money(subtotal)}</strong></p>
        {surcharge > 0 && <p><span>Repetir guisado</span><strong>{money(surcharge)}</strong></p>}
        {promoDiscount > 0 && <p className="summary-discount"><span>Promo 2x1</span><strong>-{money(promoDiscount)}</strong></p>}
        <p><span>Envío</span><strong>Gratis</strong></p>
        <p className="summary-total"><span>Total</span><strong>{money(total)}</strong></p>
      </div>
      <button className="checkout-button" disabled={!pack || !meal || !canOrder} onClick={onCheckout}>Continuar <ArrowRight size={17} /></button>
      <small>Pedido de demostración. No se realizará un cargo real.</small>
    </aside>
  )
}

function WeeklySummary({ packageTier, quantity, prepay, canOrder, onQuantity, onTogglePrepay, onCheckout }: {
  packageTier: PackageTier | null
  quantity: number
  prepay: boolean
  canOrder: boolean
  onQuantity: (change: number) => void
  onTogglePrepay: () => void
  onCheckout: () => void
}) {
  const pack = packageTier ? PACKAGES[packageTier] : null
  const regular = pack ? pack.weeklyRegular * quantity : 0
  const special = pack ? pack.weeklyPrepay * quantity : 0
  const savings = regular - special
  const total = prepay ? special : regular

  return (
    <aside className="order-summary" id="pedido">
      <div className="order-summary__head">
        <span>Tu semana</span>
        <strong>{pack ? pack.label : 'Elige un paquete'}</strong>
      </div>
      {!pack && <div className="summary-empty"><ShoppingBag size={24} /><p>Elige uno de los 3 paquetes para tu semana.</p></div>}
      {pack && (
        <div className="summary-items">
          <div className="summary-package">
            <p><strong>{pack.label}</strong><span>5 días de comida</span></p>
            <div className="counter">
              <button onClick={() => onQuantity(-1)} aria-label="Quitar una persona"><Minus size={12} /></button>
              <span>{quantity}</span>
              <button onClick={() => onQuantity(1)} aria-label="Agregar una persona"><Plus size={12} /></button>
            </div>
          </div>
          <label className="weekly-discount">
            <input type="checkbox" checked={prepay} onChange={onTogglePrepay} />
            <span>
              <strong>Pagar toda la semana por adelantado</strong>
              <small>Precio especial vía transferencia</small>
            </span>
            <b>-{money(savings)}</b>
          </label>
        </div>
      )}
      <div className="summary-totals">
        <p><span>Semanal regular</span><strong>{money(regular)}</strong></p>
        {prepay && <p className="summary-discount"><span>Pago adelantado</span><strong>-{money(savings)}</strong></p>}
        <p><span>Envío</span><strong>Gratis</strong></p>
        <p className="summary-total"><span>Total</span><strong>{money(total)}</strong></p>
      </div>
      <button className="checkout-button" disabled={!pack || !canOrder} onClick={onCheckout}>Continuar <ArrowRight size={17} /></button>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeWeekDay, setActiveWeekDay] = useState('')
  const [weeklyMenus, setWeeklyMenus] = useState<Record<string, MenuResponse>>({})
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [packageTier, setPackageTier] = useState<PackageTier | null>(null)
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [repeatGuisado, setRepeatGuisado] = useState(false)
  const [prepay, setPrepay] = useState(false)
  const [promo2x1, setPromo2x1] = useState(true)
  const [showPromoPopup, setShowPromoPopup] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer')
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
    if (preloading) return
    if (sessionStorage.getItem('foodiepack:v2:promo-2x1-seen')) return
    const timer = window.setTimeout(() => setShowPromoPopup(true), 500)
    return () => window.clearTimeout(timer)
  }, [preloading])

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
        setDays(availableDays)
        setPolicy(currentPolicy)
        setSelectedDate((current) => current || currentPolicy.tomorrow)
        setActiveWeekDay((current) => current || availableDays[0]?.date || '')
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
    localStorage.setItem('foodiepack:v2:favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    if (packageTier !== REPEAT_GUISADO_TIER) setRepeatGuisado(false)
  }, [packageTier])

  useEffect(() => {
    if (selectedMealId && menu && !menu.meals.some((meal) => meal.id === selectedMealId)) setSelectedMealId(null)
  }, [menu, selectedMealId])

  const orderingOpen = Boolean(policy?.isOpen)
  const promoDateLabel = policy?.tomorrow ? fullDate(policy.tomorrow) : 'el próximo día hábil'
  const isNextAvailable = menu?.policy.tomorrow === selectedDate
  const featuredMeal = menu?.meals.find((meal) => meal.available) || menu?.meals[0]
  const selectedMeal = menu?.meals.find((meal) => meal.id === selectedMealId) || null
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

  const activePackage = packageTier ? PACKAGES[packageTier] : null
  const canRepeatGuisado = packageTier === REPEAT_GUISADO_TIER
  const daySurcharge = activePackage && canRepeatGuisado && repeatGuisado ? REPEAT_GUISADO_SURCHARGE * quantity : 0
  const dayPaidQuantity = promo2x1 ? Math.ceil(quantity / 2) : quantity
  const dayPromoDiscount = activePackage && promo2x1 ? activePackage.dailyPrice * (quantity - dayPaidQuantity) : 0
  const dayTotal = activePackage ? activePackage.dailyPrice * quantity + daySurcharge - dayPromoDiscount : 0
  const weekRegularTotal = activePackage ? activePackage.weeklyRegular * quantity : 0
  const weekSpecialTotal = activePackage ? activePackage.weeklyPrepay * quantity : 0
  const weekSavings = weekRegularTotal - weekSpecialTotal
  const weekTotal = prepay ? weekSpecialTotal : weekRegularTotal
  const activeTotal = orderMode === 'week' ? weekTotal : dayTotal
  const badgeCount = activePackage ? quantity : 0

  const dismissPromoPopup = () => {
    setShowPromoPopup(false)
    sessionStorage.setItem('foodiepack:v2:promo-2x1-seen', '1')
  }

  const explorePromoPopup = () => {
    setPromo2x1(true)
    dismissPromoPopup()
    document.querySelector('#paquetes')?.scrollIntoView({ behavior: 'smooth' })
  }

  const toggleFavorite = (mealId: string) => {
    setFavorites((current) => current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId])
  }

  const choosePackage = (tier: PackageTier) => {
    setPackageTier(tier)
    pushToast(`${PACKAGES[tier].label} seleccionado`, 'success')
  }

  const chooseMealPackage = (mealId: string, tier: PackageTier) => {
    setSelectedMealId(mealId)
    setPackageTier(tier)
    pushToast(`${PACKAGES[tier].label} · comida seleccionada`, 'success')
  }

  const changeQuantity = (change: number) => {
    setQuantity((current) => Math.min(10, Math.max(1, current + change)))
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
    if (!packageTier) {
      setOrderError('Elige uno de los 3 paquetes antes de continuar.')
      return
    }
    if (orderMode === 'week' && prepay && paymentMethod !== 'transfer') {
      setOrderError('Selecciona Transferencia para usar el precio especial de pago adelantado.')
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
        orderMode,
        date: orderMode === 'day' ? selectedDate : (policy?.tomorrow || days[0]?.date || ''),
        packageTier,
        quantity,
        repeatGuisado: orderMode === 'day' && canRepeatGuisado && repeatGuisado,
        prepay: orderMode === 'week' && prepay,
        promo2x1: orderMode === 'day' && promo2x1,
        ...(orderMode === 'day' && selectedMealId ? { mealId: selectedMealId } : {}),
      })
      setOrder(response.order)
      setPackageTier(null)
      setSelectedMealId(null)
      setQuantity(1)
      setRepeatGuisado(false)
      setPrepay(false)
      setPromo2x1(true)
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
  const scrollToPackages = () => document.querySelector('#paquetes')?.scrollIntoView({ behavior: 'smooth' })

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
        <a className="store-header__logo" href="/" aria-label="Inicio"><Logo horizontal /></a>
        <div className="store-header__delivery">
          <span>Envío gratis</span>
          <button onClick={scrollToMenu}>Lindavista, CDMX <ChevronDown size={14} /></button>
        </div>
        <button className="header-cart" onClick={scrollToSummary}>
          <ShoppingBag size={18} /><span>Pedido</span>{badgeCount > 0 && <b key={badgeCount} className="header-cart__badge">{badgeCount}</b>}
        </button>
      </header>

      <section className="brand-landing" aria-labelledby="landing-title">
        <FloatingDecor />
        <div className="brand-landing__inner">
          <div className="brand-landing__copy">
            <div className="brand-landing__logo"><Logo hero theme="white" /></div>
            <p>FoodiePack · Lindavista</p>
            <h1 id="landing-title">Tu cocina<br />en la <em>oficina.</em></h1>
            <span>Resérvalo hoy y te llevamos comida fresca hasta tu oficina en Lindavista. <strong>¡2x1 de lanzamiento!</strong></span>
            <div className="brand-landing__actions">
              <a href="#paquetes" onClick={(event) => { event.preventDefault(); scrollToPackages() }}>Ver paquetes <ArrowRight size={17} /></a>
              <small><Clock3 size={15} /> Pide hoy de 8:00 am a 6:00 pm</small>
            </div>
          </div>
          <div className="brand-landing__visual">
            <div className="landing-dish" style={{ backgroundImage: featuredMeal ? `url(${featuredMeal.image})` : undefined }} role="img" aria-label={featuredMeal?.name || 'Comida preparada por FoodiePack'}>
              <div className="landing-date"><span>Entrega</span><strong>{menu?.policy.tomorrow ? dateFromKey(menu.policy.tomorrow).getDate() : '...'}</strong><small>{menu?.policy.tomorrow ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(dateFromKey(menu.policy.tomorrow)).replace('.', '') : 'pronto'}</small></div>
            </div>
            <div className="landing-caption">
              <span>2x1 de lanzamiento</span>
              <strong>{featuredMeal?.name || 'Cocinando el menú…'}</strong>
              <b>Desde {money(PACKAGES.economico.dailyPrice)}/día</b>
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
            <p>Elige tu paquete, paga por adelantado y ahorra hasta {money(MAX_WEEKLY_SAVINGS)} en tu semana.</p>
            <button type="button" onClick={() => { setOrderMode('week'); scrollToPackages() }}>Armar mi semana <ArrowRight size={16} /></button>
          </div>
        </div>
      </section>

      <PackagesSection selected={packageTier} onSelect={choosePackage} />

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
            <button role="tab" aria-selected={orderMode === 'week'} className={orderMode === 'week' ? 'selected' : ''} onClick={() => setOrderMode('week')}>Plan semanal <b>Ahorra</b></button>
          </div>

          {orderMode === 'day' ? (
            <>
              <div className="menu-title">
                <p>{isNextAvailable ? 'Próxima entrega disponible' : 'Próximamente'}</p>
                <h1>{selectedDate ? fullDate(selectedDate) : 'Menú'}</h1>
                <span>{isNextAvailable
                  ? (orderingOpen ? 'Haz tu pedido hoy antes de las 6:00 pm para reservar este día.' : 'La ventana de pedido está cerrada. Vuelve entre 8:00 am y 6:00 pm.')
                  : 'Puedes revisar este menú. Las reservaciones abren cuando sea el próximo día disponible.'}</span>
              </div>

              <div className="date-strip" aria-label="Próximos menús">
                {days.map((day, index) => (
                  <button key={day.date} className={selectedDate === day.date ? 'selected' : ''} onClick={() => setSelectedDate(day.date)}>
                    <span>{index === 0 ? 'Próximo día hábil' : dayName(day.date)}</span>
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
                <span>Elige tu paquete arriba. La cocina decide el guisado de cada día; aquí puedes verlo por adelantado.</span>
              </div>

              <div className="date-strip" aria-label="Días de tu plan semanal">
                {days.map((day, index) => (
                  <button key={day.date} className={activeWeekDay === day.date ? 'selected' : ''} onClick={() => setActiveWeekDay(day.date)}>
                    <span>{index === 0 ? 'Próximo día hábil' : dayName(day.date)}</span>
                    <strong>{dateFromKey(day.date).getDate()}</strong>
                    <small>{day.mealCount} opciones</small>
                  </button>
                ))}
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
              <DishCard
                key={meal.id}
                meal={meal}
                index={index}
                isFavorite={favorites.includes(meal.id)}
                onToggleFavorite={() => toggleFavorite(meal.id)}
                selectedPackage={packageTier}
                selectedMealId={selectedMealId}
                onChoosePackage={chooseMealPackage}
              />
            ))}
            {!isLoadingCurrent && currentMeals.length === 0 && <div className="menu-empty"><h2>Menú pendiente</h2><p>La cocina todavía no publica las opciones para este día.</p></div>}
            {!isLoadingCurrent && Boolean(currentMeals.length) && visibleMeals.length === 0 && (
              <div className="menu-empty"><h2>Sin resultados</h2><p>Ningún platillo coincide con este filtro. Prueba con otro.</p></div>
            )}
          </div>
        </section>

        {orderMode === 'day' ? (
          <OrderSummary
            packageTier={packageTier}
            quantity={quantity}
            repeatGuisado={repeatGuisado}
            promo2x1={promo2x1}
            deliveryDate={selectedDate}
            meal={selectedMeal}
            canOrder={orderingOpen}
            onQuantity={changeQuantity}
            onToggleRepeat={() => setRepeatGuisado((value) => !value)}
            onTogglePromo2x1={() => setPromo2x1((value) => !value)}
            onCheckout={() => setCheckoutOpen(true)}
          />
        ) : (
          <WeeklySummary
            packageTier={packageTier}
            quantity={quantity}
            prepay={prepay}
            canOrder={orderingOpen}
            onQuantity={changeQuantity}
            onTogglePrepay={() => setPrepay((value) => !value)}
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
          <span className="app-tabbar__cart"><ShoppingBag size={20} />{badgeCount > 0 && <b>{badgeCount}</b>}</span>
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
              <h2>{order.isWeeklyPlan ? 'Tu semana está lista.' : `Nos vemos el ${fullDate(order.deliveryDate).toLowerCase()}.`}</h2>
              <small>
                La cocina aceptó tu pedido{order.isWeeklyPlan ? ', con tu paquete semanal' : ''}
                {order.items[0]?.promo2x1 ? ', con la promo 2x1 aplicada' : ''}. Llegará a {order.delivery?.office || 'tu oficina'} entre 12:00 y 2:00 pm.
                {' '}{order.paymentMethod === 'transfer'
                  ? 'Envía tu comprobante de transferencia al WhatsApp del código QR para entrar en producción.'
                  : 'Pagarás en efectivo al recibir.'}
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
                  <p><span>{activePackage?.label || 'Sin paquete'} · {quantity} {quantity === 1 ? 'persona' : 'personas'}</span>
                    <strong>{prepay ? `Ahorras ${money(weekSavings)}` : 'Pago regular, sin adelanto'}</strong></p>
                </div>
              )}
              {orderMode === 'day' && promo2x1 && dayPromoDiscount > 0 && (
                <div className="weekly-recap">
                  <Sparkles size={16} />
                  <p><span>Promo 2x1 aplicada</span><strong>Ahorras {money(dayPromoDiscount)}</strong></p>
                </div>
              )}
              <div className="delivery-zone-card">
                <MapPin size={20} />
                <p><span>Zona disponible</span><strong>Lindavista Sur y San Felipe de Jesús</strong></p>
                <b>Envío gratis · menos de 3 km</b>
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
                  <button type="button" className={paymentMethod === 'transfer' ? 'selected' : ''} onClick={() => setPaymentMethod('transfer')}><Landmark size={16} /> Transferencia</button>
                  <button type="button" className={paymentMethod === 'cash' ? 'selected' : ''} onClick={() => { setPaymentMethod('cash'); setPrepay(false) }}><Banknote size={16} /> Efectivo</button>
                </div>
                {paymentMethod === 'transfer' && (
                  <div className="bank-transfer-card bank-transfer-card--inline">
                    <Landmark size={20} />
                    <div>
                      <p>Transfiere y envía tu comprobante por WhatsApp</p>
                      <strong>{BANK_TRANSFER.bank}</strong>
                      <span>CLABE {BANK_TRANSFER.clabe}</span>
                      <span>Titular: {BANK_TRANSFER.holder}</span>
                    </div>
                  </div>
                )}
              </div>

              {orderError && <div className="inline-error"><span>{orderError}</span></div>}
              <div className="checkout-dialog__total"><span>Total</span><strong>{money(activeTotal)}</strong></div>
              <button className="checkout-button" disabled={submitting || !isOnline}>{submitting ? 'Confirmando…' : (isOnline ? 'Confirmar pedido' : 'Sin conexión')}</button>
              <small>Este prototipo no procesa pagos reales.</small>
            </form>
          )}
        </section>
      )}

      {showPromoPopup && !checkoutOpen && (
        <PromoPopup dateLabel={promoDateLabel.toLowerCase()} onClose={dismissPromoPopup} onExplore={explorePromoPopup} />
      )}
    </div>
  )
}

export default App
