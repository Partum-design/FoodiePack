import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight, Banknote, CalendarDays, Check, ChevronRight, Clock3, CreditCard, Heart, Landmark, MapPin, Menu, Minus,
  PartyPopper, Plus, RefreshCw, Search, ShoppingBag, SlidersHorizontal, Sparkles, Truck, Utensils, WifiOff, X,
} from 'lucide-react'
import { createOrder, getMenu, getMenuDays } from './api'
import AddressSearch from './components/AddressSearch'
import AppDownload from './components/AppDownload'
import AppMenu from './components/AppMenu'
import Footer from './components/Footer'
import Logo from './components/Logo'
import { trackAddPaymentInfo, trackAddToCart, trackBeginCheckout, trackPurchase } from './lib/analytics'
import type { AnalyticsItem } from './lib/analytics'
import { dateFromKey, dayName, fullDate } from './lib/dates'
import { money } from './lib/format'
import { externalMapUrl, isNearLindavista, reverseGeocode } from './lib/geo'
import type { AddressSuggestion, Coordinates } from './lib/geo'
import { useReveal } from './lib/useReveal'
import {
  BANK_TRANSFER, GARNISH_OPTIONS, ORDER_KEY_POINTS, PACKAGE_ORDER, PACKAGES, REPEAT_GUISADO_SURCHARGE,
  REPEAT_GUISADO_TIER,
} from './packages'
import type { Garnish, PackageTier } from './packages'
import type { Meal, MenuDay, MenuResponse, OrderPolicy, PaymentMethod, SavedOrder, SpecialDay } from './types'

// Leaflet (~40 KB gzip) is only needed once the checkout opens, so it lives in its own chunk.
const DeliveryMap = lazy(() => import('./components/DeliveryMap'))

const DELIVERY_ZONE = 'Lindavista, CDMX' as const
const MAX_WEEKLY_SAVINGS = Math.max(...PACKAGE_ORDER.map((tier) => PACKAGES[tier].weeklyRegular - PACKAGES[tier].weeklyPrepay))

type OrderMode = 'day' | 'week'

const TIER_STYLE: Record<PackageTier, { tone: string; tagline: string }> = {
  economico: { tone: 'cream', tagline: 'Rico y rendidor' },
  ejecutivo: { tone: 'green', tagline: 'El favorito de la oficina' },
  completo: { tone: 'orange', tagline: 'Para los de buen diente' },
}

// GA4 line item for a package. Prices are per person: daily price, or the weekly price (5 days) in week mode.
function packageLineItem(
  tier: PackageTier, mode: OrderMode, quantity: number,
  extras: { prepay?: boolean; surcharge?: number; mealName?: string } = {},
): AnalyticsItem {
  const pack = PACKAGES[tier]
  return {
    item_id: tier,
    item_name: pack.label,
    item_category: mode === 'week' ? 'plan_semanal' : 'menu_del_dia',
    ...(extras.mealName ? { item_variant: extras.mealName } : {}),
    price: mode === 'week' ? (extras.prepay ? pack.weeklyPrepay : pack.weeklyRegular) : pack.dailyPrice + (extras.surcharge ?? 0),
    quantity,
  }
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('foodiepack:v2:favorites') || '[]') as string[]
  } catch {
    return []
  }
}

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' }

function BrandPreloader() {
  return (
    <div className="fp-preloader" role="status" aria-label="Cargando FoodiePack">
      <div className="fp-preloader__lockup">
        <Logo hero theme="white" />
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
    <div className="fp-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`fp-toast fp-toast--${toast.tone}`} key={toast.id}>
          <i>{toast.tone === 'success' ? <Check size={14} /> : <Sparkles size={14} />}</i>
          <span>{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso"><X size={13} /></button>
        </div>
      ))}
    </div>
  )
}

function Counter({ value, onChange }: { value: number; onChange: (change: number) => void }) {
  return (
    <div className="fp-counter">
      <button type="button" onClick={() => onChange(-1)} disabled={value <= 1} aria-label="Quitar una persona"><Minus size={14} /></button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(1)} disabled={value >= 10} aria-label="Agregar una persona"><Plus size={14} /></button>
    </div>
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
  const tiers = PACKAGE_ORDER.filter((tier) => meal.packages.includes(tier))
  const isChosen = selectedMealId === meal.id && Boolean(selectedPackage)
  const [tier, setTier] = useState<PackageTier>(() => (isChosen && selectedPackage) || (tiers.includes('ejecutivo') ? 'ejecutivo' : tiers[0]))
  const activeTier = isChosen && selectedPackage ? selectedPackage : tier
  const badge = index === 0 && meal.available ? 'Más pedido' : meal.tags[0]

  return (
    <article
      ref={ref}
      className={`fp-dish reveal ${meal.available ? '' : 'is-soldout'} ${isChosen ? 'is-chosen' : ''} ${visible ? 'reveal--visible' : ''}`}
      style={{ transitionDelay: visible ? `${Math.min(index, 8) * 60}ms` : '0ms' }}
    >
      <div className="fp-dish__media">
        <img src={meal.image} alt={meal.name} loading="lazy" decoding="async" />
        {badge && <span className={`fp-dish__badge ${index === 0 ? 'is-hot' : ''}`}>{badge}</span>}
        {!meal.available && <span className="fp-dish__soldout">Agotado</span>}
        <button
          type="button"
          className={`fp-dish__fav ${isFavorite ? 'is-active' : ''}`}
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Quitar ${meal.name} de favoritos` : `Guardar ${meal.name} en favoritos`}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="fp-dish__body">
        <h3>{meal.name}</h3>
        <p>{meal.description}</p>
        {tiers.length > 0 && (
          <div className="fp-dish__tiers" role="radiogroup" aria-label={`Paquete para ${meal.name}`}>
            {tiers.map((option) => (
              <button
                type="button"
                key={option}
                role="radio"
                aria-checked={activeTier === option}
                className={activeTier === option ? 'is-active' : ''}
                disabled={!meal.available}
                onClick={() => { setTier(option); if (isChosen) onChoosePackage(meal.id, option) }}
              >
                {PACKAGES[option].label}
              </button>
            ))}
          </div>
        )}
        <div className="fp-dish__foot">
          <p><small>{PACKAGES[activeTier]?.label || 'Paquete'}</small><strong>{money(PACKAGES[activeTier]?.dailyPrice || 0)}</strong></p>
          <button
            type="button"
            className={`fp-dish__add ${isChosen ? 'is-chosen' : ''}`}
            disabled={!meal.available || !tiers.length}
            onClick={() => onChoosePackage(meal.id, activeTier)}
            aria-label={isChosen ? `${meal.name} elegido` : `Elegir ${meal.name} con paquete ${PACKAGES[activeTier]?.label}`}
          >
            {isChosen ? <Check size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>
    </article>
  )
}

function SpecialDayCard({ specialDay, chosen, onChoose }: { specialDay: SpecialDay; chosen: boolean; onChoose: () => void }) {
  return (
    <div className={`fp-special ${chosen ? 'is-chosen' : ''}`}>
      {specialDay.image && (
        <div className="fp-special__media">
          <img src={specialDay.image} alt={specialDay.packageName || 'Menú especial'} loading="lazy" decoding="async" />
        </div>
      )}
      <div className="fp-special__body">
        <span className="fp-pill fp-pill--yellow"><Sparkles size={13} /> Menú especial de este día</span>
        <h3>{specialDay.packageName}</h3>
        {specialDay.reason && <p>{specialDay.reason}</p>}
        {Boolean(specialDay.packageIncludes?.length) && (
          <ul>
            {specialDay.packageIncludes!.map((item) => <li key={item}><Check size={14} /> {item}</li>)}
          </ul>
        )}
        <div className="fp-special__foot">
          <strong>{money(specialDay.packagePrice || 0)}<small>precio único</small></strong>
          <button type="button" className={`fp-btn ${chosen ? 'fp-btn--dark' : 'fp-btn--primary'}`} onClick={onChoose}>
            {chosen ? <><Check size={16} /> Elegido</> : <>Elegir este menú <ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}

function GarnishPicker({ garnish, onGarnish }: { garnish: Garnish; onGarnish: (value: Garnish) => void }) {
  return (
    <div className="fp-field-group">
      <span>Guarnición</span>
      <div className="fp-segment fp-segment--small">
        {GARNISH_OPTIONS.map((option) => (
          <button type="button" key={option.value} className={garnish === option.value ? 'is-active' : ''} onClick={() => onGarnish(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PackagesSection({ selected, onSelect }: { selected: PackageTier | null; onSelect: (tier: PackageTier) => void }) {
  return (
    <section className="fp-section fp-packages" id="paquetes" aria-labelledby="packages-title">
      <div className="fp-section__head fp-section__head--center">
        <span className="fp-eyebrow">Paquetes</span>
        <h2 id="packages-title">Elige cuánto <em>quieres comer</em></h2>
        <p>Precio fijo por día y envío gratis. La cocina prepara los guisados del día; tú eliges el paquete.</p>
      </div>

      <div className="fp-packages__grid">
        {PACKAGE_ORDER.map((tier) => {
          const pack = PACKAGES[tier]
          const isSelected = selected === tier
          const { tone, tagline } = TIER_STYLE[tier]
          return (
            <article className={`fp-package fp-package--${tone} ${isSelected ? 'is-selected' : ''}`} key={tier}>
              {tier === 'ejecutivo' && <span className="fp-package__ribbon">Más pedido</span>}
              <div className="fp-package__top">
                <small>{tagline}</small>
                <h3>{pack.label}</h3>
              </div>
              <p className="fp-package__price"><b>{money(pack.dailyPrice)}</b><span>por día</span></p>
              <ul>
                {pack.includes.map((item) => <li key={item}><Check size={15} /> {item}</li>)}
              </ul>
              <div className="fp-package__week">
                <span>Semana completa</span>
                <p><s>{money(pack.weeklyRegular)}</s> <strong>{money(pack.weeklyPrepay)}</strong></p>
                <small>pagando por adelantado</small>
              </div>
              <button type="button" className="fp-package__cta" onClick={() => onSelect(tier)}>
                {isSelected ? <><Check size={17} /> Elegido</> : <>Elegir {pack.label} <ArrowRight size={17} /></>}
              </button>
            </article>
          )
        })}
      </div>
      <p className="fp-packages__note">*En Foodie+ puedes repetir el mismo guisado por +{money(REPEAT_GUISADO_SURCHARGE)}.</p>

      <div className="fp-steps">
        {ORDER_KEY_POINTS.slice(0, 4).map((point, index) => (
          <div className="fp-step" key={point.title}>
            <b>{index + 1}</b>
            <p><strong>{point.title}</strong><span>{point.detail}</span></p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SummaryShell({ title, label, children, footer }: { title: string; label: string; children: ReactNode; footer: ReactNode }) {
  return (
    <aside className="fp-summary" id="pedido" aria-label="Tu pedido">
      <div className="fp-summary__head">
        <i><ShoppingBag size={20} /></i>
        <p><span>{title}</span><strong>{label}</strong></p>
      </div>
      {children}
      {footer}
    </aside>
  )
}

function SummaryFooter({ lines, total, ready, canOrder, onCheckout }: {
  lines: Array<{ label: string; value: string; tone?: 'discount' }>
  total: number
  ready: boolean
  canOrder: boolean
  onCheckout: () => void
}) {
  return (
    <>
      <div className="fp-summary__totals">
        {lines.map((line) => (
          <p key={line.label} className={line.tone === 'discount' ? 'is-discount' : ''}><span>{line.label}</span><strong>{line.value}</strong></p>
        ))}
        <p><span>Envío</span><strong className="is-free">Gratis</strong></p>
        <p className="is-total"><span>Total</span><strong>{money(total)}</strong></p>
      </div>
      <button className="fp-btn fp-btn--primary fp-btn--block fp-btn--lg" disabled={!ready || !canOrder} onClick={onCheckout}>
        {canOrder ? <>Continuar pedido <ArrowRight size={18} /></> : 'Pedidos cerrados por hoy'}
      </button>
      {!canOrder && <small className="fp-summary__hint">Recibimos pedidos de 8:00 am a 6:00 pm.</small>}
    </>
  )
}

function OrderSummary({
  packageTier, quantity, repeatGuisado, garnish, deliveryDate, meal, canOrder, specialDay, specialDayChosen,
  specialAddons, onQuantity, onToggleRepeat, onGarnish, onToggleAddon, onCheckout,
}: {
  packageTier: PackageTier | null
  quantity: number
  repeatGuisado: boolean
  garnish: Garnish
  deliveryDate: string
  meal: Meal | null
  canOrder: boolean
  specialDay: SpecialDay | null
  specialDayChosen: boolean
  specialAddons: string[]
  onQuantity: (change: number) => void
  onToggleRepeat: () => void
  onGarnish: (value: Garnish) => void
  onToggleAddon: (name: string) => void
  onCheckout: () => void
}) {
  const pack = packageTier ? PACKAGES[packageTier] : null
  const canRepeat = packageTier === REPEAT_GUISADO_TIER
  const surcharge = pack && canRepeat && repeatGuisado ? REPEAT_GUISADO_SURCHARGE * quantity : 0
  const subtotal = pack ? pack.dailyPrice * quantity : 0
  const addonsUnit = specialDay ? specialAddons.reduce((sum, name) => sum + (specialDay.addons?.find((addon) => addon.name === name)?.price || 0), 0) : 0
  const specialUnit = specialDay ? (specialDay.packagePrice || 0) + addonsUnit : 0
  const specialSubtotal = specialDayChosen ? specialUnit * quantity : 0
  const usingSpecial = Boolean(specialDay) && specialDayChosen
  const total = usingSpecial ? specialSubtotal : subtotal + surcharge
  const ready = usingSpecial || Boolean(pack && meal)

  const lines = usingSpecial
    ? [{ label: specialDay!.packageName || 'Menú especial', value: money(specialSubtotal) }]
    : [
      { label: `Paquete × ${quantity}`, value: money(subtotal) },
      ...(surcharge > 0 ? [{ label: 'Repetir guisado', value: money(surcharge) }] : []),
    ]

  return (
    <SummaryShell
      title="Tu pedido"
      label={usingSpecial ? specialDay!.packageName || 'Menú especial' : (pack ? pack.label : 'Aún vacío')}
      footer={<SummaryFooter lines={lines} total={total} ready={ready} canOrder={canOrder} onCheckout={onCheckout} />}
    >
      <div className="fp-summary__date">
        <Truck size={18} />
        <p><span>Entrega</span><strong>{deliveryDate ? fullDate(deliveryDate) : 'Próximo día hábil'}</strong><small>12:00 a 2:00 pm</small></p>
      </div>
      {!usingSpecial && (!pack || !meal) && (
        <div className="fp-summary__empty">
          <span aria-hidden="true">🍲</span>
          <p>{specialDay
            ? 'Elige el menú especial o un guisado del menú.'
            : (pack ? 'Ahora toca el + de un guisado del menú.' : 'Toca el + de un guisado para empezar tu pedido.')}</p>
        </div>
      )}
      {usingSpecial && (
        <div className="fp-summary__items">
          <div className="fp-summary__line">
            {specialDay!.image && <img src={specialDay!.image} alt="" />}
            <p><strong>{specialDay!.packageName}</strong><span>{money(specialDay!.packagePrice || 0)} c/u</span></p>
            <Counter value={quantity} onChange={onQuantity} />
          </div>
          {Boolean(specialDay!.addons?.length) && (
            <div className="fp-field-group">
              <span>Extras</span>
              {specialDay!.addons!.map((addon) => (
                <label className="fp-check" key={addon.name}>
                  <input type="checkbox" checked={specialAddons.includes(addon.name)} onChange={() => onToggleAddon(addon.name)} />
                  <i><Check size={13} /></i>
                  <span>{addon.name}</span>
                  <b>+{money(addon.price)}</b>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {!usingSpecial && pack && (
        <div className="fp-summary__items">
          <div className="fp-summary__line">
            {meal ? <img src={meal.image} alt="" /> : <span className="fp-summary__ph"><Utensils size={18} /></span>}
            <p><strong>{meal ? meal.name : 'Elige un guisado'}</strong><span>{pack.label} · {money(pack.dailyPrice)}</span></p>
            <Counter value={quantity} onChange={onQuantity} />
          </div>
          {canRepeat && (
            <label className="fp-check">
              <input type="checkbox" checked={repeatGuisado} onChange={onToggleRepeat} />
              <i><Check size={13} /></i>
              <span>Repetir el mismo guisado</span>
              <b>+{money(REPEAT_GUISADO_SURCHARGE)}</b>
            </label>
          )}
          <GarnishPicker garnish={garnish} onGarnish={onGarnish} />
        </div>
      )}
    </SummaryShell>
  )
}

function WeeklySummary({ packageTier, quantity, prepay, garnish, canOrder, onQuantity, onTogglePrepay, onGarnish, onCheckout }: {
  packageTier: PackageTier | null
  quantity: number
  prepay: boolean
  garnish: Garnish
  canOrder: boolean
  onQuantity: (change: number) => void
  onTogglePrepay: () => void
  onGarnish: (value: Garnish) => void
  onCheckout: () => void
}) {
  const pack = packageTier ? PACKAGES[packageTier] : null
  const regular = pack ? pack.weeklyRegular * quantity : 0
  const special = pack ? pack.weeklyPrepay * quantity : 0
  const savings = regular - special
  const total = prepay ? special : regular

  const lines = [
    { label: `Semana × ${quantity}`, value: money(regular) },
    ...(prepay ? [{ label: 'Pago adelantado', value: `-${money(savings)}`, tone: 'discount' as const }] : []),
  ]

  return (
    <SummaryShell
      title="Tu semana"
      label={pack ? `${pack.label} · 5 días` : 'Elige un paquete'}
      footer={<SummaryFooter lines={lines} total={total} ready={Boolean(pack)} canOrder={canOrder} onCheckout={onCheckout} />}
    >
      {!pack && (
        <div className="fp-summary__empty">
          <span aria-hidden="true">🗓️</span>
          <p>Elige uno de los 3 paquetes y recibe comida toda la semana.</p>
        </div>
      )}
      {pack && (
        <div className="fp-summary__items">
          <div className="fp-summary__line">
            <span className="fp-summary__ph"><CalendarDays size={18} /></span>
            <p><strong>{pack.label}</strong><span>Lunes a viernes</span></p>
            <Counter value={quantity} onChange={onQuantity} />
          </div>
          <label className={`fp-saver ${prepay ? 'is-on' : ''}`}>
            <input type="checkbox" checked={prepay} onChange={onTogglePrepay} />
            <span className="fp-switch" aria-hidden="true"><i /></span>
            <span><strong>Pagar la semana por adelantado</strong><small>Por transferencia · ahorras {money(savings)}</small></span>
          </label>
          <GarnishPicker garnish={garnish} onGarnish={onGarnish} />
        </div>
      )}
    </SummaryShell>
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
  const [garnish, setGarnish] = useState<Garnish>('arroz')
  const [specialAddons, setSpecialAddons] = useState<string[]>([])
  const [specialDayChosen, setSpecialDayChosen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<SavedOrder | null>(null)
  const [orderError, setOrderError] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null)
  const [deliveryError, setDeliveryError] = useState('')
  const [locating, setLocating] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [search, setSearch] = useState('')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [retryTick, setRetryTick] = useState(0)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const toastId = useRef(0)
  // True while the address text came from the map pin, so moving the pin may replace it.
  const addressFromPin = useRef(true)

  const dismissToast = (id: number) => setToasts((items) => items.filter((item) => item.id !== id))

  const pushToast = (message: string, tone: Toast['tone'] = 'info') => {
    const id = (toastId.current += 1)
    setToasts((items) => [...items.slice(-2), { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 2800)
  }

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setPreloading(false), reducedMotion ? 150 : 1100)
    return () => window.clearTimeout(timer)
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
    if (!checkoutOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [checkoutOpen])

  useEffect(() => {
    getMenuDays()
      .then(({ days: availableDays, policy: currentPolicy }) => {
        setDays(availableDays)
        setPolicy(currentPolicy)
        setSelectedDate((current) => current || currentPolicy.tomorrow)
        setActiveWeekDay((current) => current || availableDays[0]?.date || '')
      })
      .catch(() => {
        setError('No pudimos conectar con la cocina. Intenta nuevamente en un momento.')
        setLoading(false)
      })
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
    try { localStorage.setItem('foodiepack:v2:favorites', JSON.stringify(favorites)) } catch { /* private mode */ }
  }, [favorites])

  useEffect(() => {
    if (packageTier !== REPEAT_GUISADO_TIER) setRepeatGuisado(false)
  }, [packageTier])

  useEffect(() => {
    if (selectedMealId && menu && !menu.meals.some((meal) => meal.id === selectedMealId)) setSelectedMealId(null)
  }, [menu, selectedMealId])

  useEffect(() => {
    setSpecialAddons([])
    setSpecialDayChosen(false)
  }, [selectedDate])

  const orderingOpen = Boolean(policy?.isOpen)
  const isNextAvailable = menu?.policy.tomorrow === selectedDate
  const featuredMeal = menu?.meals.find((meal) => meal.available) || menu?.meals[0]
  const selectedMeal = menu?.meals.find((meal) => meal.id === selectedMealId) || null
  const hasDeliveryPin = Boolean(deliveryCoordinates)
  const pinInsideZone = deliveryCoordinates ? isNearLindavista(deliveryCoordinates) : false
  const specialDay = orderMode === 'day' ? (menu?.specialDay ?? null) : null
  // A day can offer a special package (e.g. pozole) alongside a normal curated menu — the
  // customer picks one or the other, so `hasSpecialDay` only says the option exists, while
  // `usingSpecial` says which one is actually being ordered.
  const hasSpecialDay = specialDay?.kind === 'special_package'
  const usingSpecial = hasSpecialDay && specialDayChosen
  const nextDelivery = policy?.tomorrow || ''

  const currentMeals = useMemo(
    () => orderMode === 'day' ? (menu?.meals || []) : (weeklyMenus[activeWeekDay]?.meals || []),
    [orderMode, menu, weeklyMenus, activeWeekDay],
  )
  const tagCategories = useMemo(() => {
    const tags = Array.from(new Set(currentMeals.flatMap((meal) => meal.tags))).filter(Boolean)
    return tags.map((tag) => ({ tag, image: currentMeals.find((meal) => meal.tags.includes(tag))?.image }))
  }, [currentMeals])
  const visibleMeals = useMemo(() => {
    const query = normalize(search.trim())
    return currentMeals
      .filter((meal) => !activeTag || meal.tags.includes(activeTag))
      .filter((meal) => !onlyFavorites || favorites.includes(meal.id))
      .filter((meal) => !query || normalize(`${meal.name} ${meal.description} ${meal.tags.join(' ')}`).includes(query))
  }, [currentMeals, activeTag, onlyFavorites, favorites, search])
  const isLoadingCurrent = orderMode === 'day' ? loading : weeklyLoading
  const filtersActive = Boolean(activeTag || onlyFavorites || search.trim())

  const activePackage = packageTier ? PACKAGES[packageTier] : null
  const canRepeatGuisado = packageTier === REPEAT_GUISADO_TIER
  const daySurcharge = activePackage && canRepeatGuisado && repeatGuisado ? REPEAT_GUISADO_SURCHARGE * quantity : 0
  const dayTotal = activePackage ? activePackage.dailyPrice * quantity + daySurcharge : 0
  const weekRegularTotal = activePackage ? activePackage.weeklyRegular * quantity : 0
  const weekSpecialTotal = activePackage ? activePackage.weeklyPrepay * quantity : 0
  const weekSavings = weekRegularTotal - weekSpecialTotal
  const weekTotal = prepay ? weekSpecialTotal : weekRegularTotal
  const specialAddonsUnit = specialDay ? specialAddons.reduce((sum, name) => sum + (specialDay.addons?.find((addon) => addon.name === name)?.price || 0), 0) : 0
  const specialUnitPrice = specialDay ? (specialDay.packagePrice || 0) + specialAddonsUnit : 0
  const specialTotal = specialUnitPrice * quantity
  const activeTotal = usingSpecial ? specialTotal : (orderMode === 'week' ? weekTotal : dayTotal)
  const badgeCount = usingSpecial ? quantity : (activePackage ? quantity : 0)
  const orderReady = orderMode === 'week' ? Boolean(activePackage) : (usingSpecial || Boolean(activePackage && selectedMeal))
  const cartLabel = usingSpecial
    ? specialDay?.packageName || 'Menú especial'
    : orderMode === 'week'
      ? (activePackage ? `${activePackage.label} · semana` : '')
      : (selectedMeal ? selectedMeal.name : (activePackage ? `${activePackage.label} · elige guisado` : ''))

  const toggleFavorite = (mealId: string) => {
    setFavorites((current) => current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId])
  }

  // What is in the order right now, as GA4 line items (used by begin_checkout / add_payment_info).
  const cartItems = (): AnalyticsItem[] => {
    if (usingSpecial && specialDay) {
      return [{ item_id: 'especial', item_name: specialDay.packageName || 'Menú especial', item_category: 'menu_especial', price: specialUnitPrice, quantity }]
    }
    if (!packageTier) return []
    return [packageLineItem(packageTier, orderMode, quantity, {
      prepay,
      surcharge: canRepeatGuisado && repeatGuisado ? REPEAT_GUISADO_SURCHARGE : 0,
      mealName: selectedMeal?.name,
    })]
  }

  const openCheckout = () => {
    setCheckoutOpen(true)
    trackBeginCheckout(cartItems(), activeTotal)
  }

  const closeCheckout = () => { setCheckoutOpen(false); setOrder(null); setOrderError('') }

  // add_to_cart fires only when the order goes from empty to non-empty, so picking a package and then a
  // dish (or switching tiers) doesn't count as several separate additions.
  const choosePackage = (tier: PackageTier) => {
    if (!packageTier) {
      const item = packageLineItem(tier, orderMode, quantity)
      trackAddToCart([item], item.price * quantity)
    }
    setPackageTier(tier)
    setSpecialDayChosen(false)
    pushToast(orderMode === 'week' || selectedMealId ? `${PACKAGES[tier].label} listo` : `${PACKAGES[tier].label} elegido · ahora elige tu guisado`, 'success')
    if (orderMode === 'day' && !selectedMealId) window.setTimeout(() => scrollToMenu(), 350)
  }

  const chooseMealPackage = (mealId: string, tier: PackageTier) => {
    if (!packageTier) {
      const item = packageLineItem(tier, orderMode, quantity, { mealName: currentMeals.find((meal) => meal.id === mealId)?.name })
      trackAddToCart([item], item.price * quantity)
    }
    setSelectedMealId(mealId)
    setPackageTier(tier)
    setSpecialDayChosen(false)
    pushToast(`${currentMeals.find((meal) => meal.id === mealId)?.name || 'Guisado'} · ${PACKAGES[tier].label}`, 'success')
  }

  const changeQuantity = (change: number) => {
    setQuantity((current) => Math.min(10, Math.max(1, current + change)))
  }

  const toggleSpecialAddon = (name: string) => {
    setSpecialAddons((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  }

  const updateDeliveryAddress = (value: string) => {
    addressFromPin.current = value.trim() === ''
    setDeliveryAddress(value)
    setDeliveryError('')
  }

  const fillAddressFromPin = async (location: Coordinates) => {
    if (!addressFromPin.current) return
    const street = await reverseGeocode(location)
    if (street && addressFromPin.current) setDeliveryAddress(street)
  }

  const placePin = (location: Coordinates, fromSearch = false) => {
    setDeliveryCoordinates(location)
    setDeliveryError(isNearLindavista(location) ? '' : 'Ese punto está fuera de nuestra zona de entrega (Lindavista).')
    if (!fromSearch) void fillAddressFromPin(location)
  }

  const pickAddress = (suggestion: AddressSuggestion) => {
    addressFromPin.current = false
    placePin({ latitude: suggestion.latitude, longitude: suggestion.longitude }, true)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setDeliveryError('Este dispositivo no permite obtener la ubicación. Toca el mapa para marcar tu punto.')
      return
    }

    setLocating(true)
    setDeliveryError('')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const location = { latitude: coords.latitude, longitude: coords.longitude }
      setLocating(false)
      addressFromPin.current = true
      placePin(location)
      if (!isNearLindavista(location)) {
        setDeliveryError('Tu ubicación actual parece estar fuera de Lindavista. Mueve el pin hasta la dirección de entrega.')
      }
    }, () => {
      setLocating(false)
      setDeliveryError('No pudimos obtener tu ubicación. Revisa los permisos o toca el mapa para marcar tu punto.')
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 })
  }

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isOnline) {
      setOrderError('Sin conexión a internet. Reconéctate para confirmar tu pedido.')
      return
    }
    if (!hasDeliveryPin) {
      setDeliveryError('Busca tu dirección o toca el mapa para marcar dónde entregamos.')
      document.querySelector('#paso-ubicacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (hasSpecialDay) {
      if (!specialDayChosen && !packageTier) {
        setOrderError('Elige el menú especial o una comida del menú.')
        return
      }
    } else if (!packageTier) {
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
    trackAddPaymentInfo(cartItems(), activeTotal, paymentMethod)
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
        ...(usingSpecial ? {} : { packageTier: packageTier! }),
        quantity,
        repeatGuisado: orderMode === 'day' && !usingSpecial && canRepeatGuisado && repeatGuisado,
        prepay: orderMode === 'week' && prepay,
        ...(usingSpecial ? {} : { garnish }),
        ...(orderMode === 'day' && usingSpecial ? { mealId: 'special' } : {}),
        ...(orderMode === 'day' && !usingSpecial && selectedMealId ? { mealId: selectedMealId } : {}),
        ...(usingSpecial ? { specialAddons } : {}),
      })
      setOrder(response.order)
      trackPurchase({
        transactionId: response.order.id,
        value: response.order.total,
        shipping: response.order.deliveryFee,
        paymentType: response.order.paymentMethod,
        items: response.order.items.map((item) => ({
          item_id: item.packageTier,
          item_name: item.packageLabel,
          item_category: response.order.isWeeklyPlan ? 'plan_semanal' : ((item.packageTier as string) === 'especial' ? 'menu_especial' : 'menu_del_dia'),
          ...(item.mealName ? { item_variant: item.mealName } : {}),
          price: item.unitPrice,
          quantity: item.quantity,
        })),
      })
      setPackageTier(null)
      setSelectedMealId(null)
      setQuantity(1)
      setRepeatGuisado(false)
      setPrepay(false)
      setGarnish('arroz')
      setSpecialAddons([])
      setSpecialDayChosen(false)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo confirmar el pedido'
      setOrderError(message)
      pushToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const scrollTo = (selector: string) => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const scrollToMenu = () => scrollTo('#menu')
  const scrollToSummary = () => scrollTo('#pedido')
  const scrollToPackages = () => scrollTo('#paquetes')
  const scrollToApp = () => scrollTo('#app')
  const goToDayMenu = () => { setOrderMode('day'); scrollToMenu() }
  const goToWeekPlan = () => { setOrderMode('week'); scrollToMenu() }
  const onCartBar = () => (orderReady && orderingOpen ? openCheckout() : scrollToSummary())
  const clearFilters = () => { setActiveTag(null); setOnlyFavorites(false); setSearch('') }

  const dateStrip = (mode: OrderMode) => (
    <div className="fp-days" aria-label={mode === 'day' ? 'Elige el día de entrega' : 'Días de tu plan'}>
      {days.map((day, index) => {
        const active = mode === 'day' ? selectedDate === day.date : activeWeekDay === day.date
        return (
          <button
            key={day.date}
            className={`${active ? 'is-active' : ''} ${day.specialDay ? 'is-special' : ''}`}
            onClick={() => (mode === 'day' ? setSelectedDate(day.date) : setActiveWeekDay(day.date))}
            aria-pressed={active}
          >
            <span>{index === 0 ? 'Mañana' : dayName(day.date)}</span>
            <strong>{dateFromKey(day.date).getDate()}</strong>
            <small>{day.specialDay ? (day.specialDay.packageName || 'Especial') : `${day.mealCount} platillos`}</small>
          </button>
        )
      })}
      {days.length === 0 && Array.from({ length: 5 }, (_, index) => <div className="fp-days__ph" key={index} />)}
    </div>
  )

  return (
    <div className="fp">
      {preloading && <BrandPreloader />}
      {!isOnline && (
        <div className="fp-offline" role="alert">
          <WifiOff size={14} /> Sin conexión a internet. Algunas acciones no estarán disponibles.
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <header className={`fp-header ${headerScrolled ? 'is-scrolled' : ''}`}>
        <div className="fp-header__inner">
          <a className="fp-header__logo" href="/" aria-label="FoodiePack, inicio"><Logo horizontal /></a>

          <nav className="fp-header__nav" aria-label="Secciones">
            <button type="button" className={orderMode === 'day' ? 'is-active' : ''} onClick={goToDayMenu}>Menú del día</button>
            <button type="button" className={orderMode === 'week' ? 'is-active' : ''} onClick={goToWeekPlan}>Plan semanal</button>
            <button type="button" onClick={scrollToPackages}>Paquetes</button>
            <a href="/menu-semana">Carta semanal</a>
            <button type="button" onClick={scrollToApp}>App</button>
          </nav>

          <div className="fp-header__actions">
            <span className={`fp-status ${orderingOpen ? 'is-open' : ''}`}><i />{policy ? (orderingOpen ? 'Abierto' : 'Cerrado') : '…'}</span>
            <button className="fp-cart-btn" onClick={scrollToSummary} aria-label={`Ver pedido${badgeCount ? `, ${badgeCount} personas` : ''}`}>
              <ShoppingBag size={20} />
              <span>{badgeCount > 0 ? money(activeTotal) : 'Pedido'}</span>
              {badgeCount > 0 && <b key={badgeCount}>{badgeCount}</b>}
            </button>
            <button
              type="button"
              className="fp-icon-btn fp-header__menu"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="app-menu"
              aria-label="Abrir menú"
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>

      <AppMenu
        open={menuOpen}
        badgeCount={badgeCount}
        weeklySavings={MAX_WEEKLY_SAVINGS}
        onClose={() => setMenuOpen(false)}
        onGoMenu={goToDayMenu}
        onGoWeek={goToWeekPlan}
        onGoPackages={scrollToPackages}
        onGoOrder={scrollToSummary}
        onGoApp={scrollToApp}
      />

      <section className="fp-hero" aria-labelledby="hero-title">
        <div className="fp-hero__card">
          <div className="fp-hero__blob fp-hero__blob--1" aria-hidden="true" />
          <div className="fp-hero__blob fp-hero__blob--2" aria-hidden="true" />
          <div className="fp-hero__copy">
            <span className="fp-pill fp-pill--glass"><Truck size={14} /> Entrega {nextDelivery ? fullDate(nextDelivery).toLowerCase() : 'el próximo día hábil'}</span>
            <h1 id="hero-title">Tu cocina<br />en la <em>oficina.</em></h1>
            <p>Comida casera recién hecha, con entrega gratis en Lindavista. Pide hoy, come rico mañana.</p>
            <div className="fp-hero__actions">
              <button type="button" className="fp-btn fp-btn--primary fp-btn--lg fp-btn--arrow" onClick={goToDayMenu}>
                Pedir ahora <i><ArrowRight size={18} /></i>
              </button>
              <button type="button" className="fp-btn fp-btn--glass fp-btn--lg" onClick={scrollToPackages}>Ver paquetes</button>
            </div>
            <ul className="fp-hero__stats">
              <li><strong>{money(PACKAGES.economico.dailyPrice)}</strong><span>desde, por día</span></li>
              <li><strong>$0</strong><span>de envío</span></li>
              <li><strong>12–2 pm</strong><span>entrega</span></li>
            </ul>
          </div>
          <div className="fp-hero__visual">
            <div className="fp-hero__ring" aria-hidden="true" />
            <div
              className="fp-hero__plate"
              style={{ backgroundImage: `url(${featuredMeal?.image || '/assets/meals/weekly-hero.jpg'})` }}
              role="img"
              aria-label={featuredMeal?.name || 'Comida preparada por FoodiePack'}
            />
            <div className="fp-hero__burst">
              <small>Desde</small>
              <strong>{PACKAGES.economico.dailyPrice}</strong>
              <span>MXN</span>
            </div>
            <div className="fp-hero__tag">
              <i><Utensils size={16} /></i>
              <p><span>Menú de mañana</span><strong>{featuredMeal?.name || 'Cocinando el menú…'}</strong></p>
            </div>
            <Sparkles className="fp-hero__spark fp-hero__spark--1" size={22} aria-hidden="true" />
            <Sparkles className="fp-hero__spark fp-hero__spark--2" size={16} aria-hidden="true" />
          </div>
        </div>

        <div className="fp-perks">
          <div className="fp-perk"><i><Truck size={20} /></i><p><strong>Envío gratis</strong><span>Lindavista y San Felipe</span></p></div>
          <div className="fp-perk"><i><Clock3 size={20} /></i><p><strong>Pide 8 am – 6 pm</strong><span>Recibe al día siguiente</span></p></div>
          <div className="fp-perk"><i><CalendarDays size={20} /></i><p><strong>Plan semanal</strong><span>Ahorra hasta {money(MAX_WEEKLY_SAVINGS)}</span></p></div>
          <button type="button" className="fp-btn fp-btn--dark" onClick={goToWeekPlan}>Armar mi semana</button>
        </div>
      </section>

      <PackagesSection selected={packageTier} onSelect={choosePackage} />

      <main className="fp-section fp-order" id="menu">
        <div className="fp-order__main">
          <div className="fp-order__head">
            <div>
              <span className="fp-eyebrow">{orderMode === 'day' ? (isNextAvailable ? 'Próxima entrega' : 'Menú') : 'Plan semanal'}</span>
              <h2>{orderMode === 'day'
                ? (selectedDate ? fullDate(selectedDate) : 'Menú del día')
                : (activeWeekDay ? fullDate(activeWeekDay) : 'Tu semana')}</h2>
              <p>{orderMode === 'week'
                ? 'Elige tu paquete y recibe comida de lunes a viernes. Aquí ves por adelantado lo que cocinaremos cada día.'
                : (hasSpecialDay && specialDay
                  ? specialDay.reason
                  : (isNextAvailable
                    ? (orderingOpen ? 'Pide hoy antes de las 6:00 pm para reservar este día.' : 'Los pedidos abren de 8:00 am a 6:00 pm.')
                    : 'Puedes ver este menú desde ahora; se reserva cuando sea el próximo día disponible.'))}</p>
            </div>
            <div className="fp-segment" role="tablist" aria-label="Tipo de pedido">
              <button role="tab" aria-selected={orderMode === 'day'} className={orderMode === 'day' ? 'is-active' : ''} onClick={() => setOrderMode('day')}>
                <Utensils size={16} /> Un día
              </button>
              <button role="tab" aria-selected={orderMode === 'week'} className={orderMode === 'week' ? 'is-active' : ''} onClick={() => setOrderMode('week')}>
                <CalendarDays size={16} /> Semana <b>-{money(MAX_WEEKLY_SAVINGS)}</b>
              </button>
            </div>
          </div>

          {dateStrip(orderMode)}

          <div className="fp-search">
            <label className="fp-search__field">
              <Search size={19} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Busca tu guisado favorito…"
                aria-label="Buscar platillo"
              />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={15} /></button>}
            </label>
            <button
              type="button"
              className={`fp-search__filter ${filtersActive ? 'is-active' : ''}`}
              onClick={filtersActive ? clearFilters : () => setOnlyFavorites((value) => !value)}
              aria-label={filtersActive ? 'Quitar filtros' : 'Ver favoritos'}
            >
              {filtersActive ? <X size={19} /> : <SlidersHorizontal size={19} />}
            </button>
          </div>

          {!isLoadingCurrent && currentMeals.length > 0 && (
            <div className="fp-cats" aria-label="Categorías">
              <button className={!activeTag && !onlyFavorites ? 'is-active' : ''} onClick={() => { setActiveTag(null); setOnlyFavorites(false) }}>
                <i style={{ backgroundImage: featuredMeal ? `url(${featuredMeal.image})` : undefined }} />
                <span>Todo</span>
              </button>
              {tagCategories.map(({ tag, image }) => (
                <button key={tag} className={activeTag === tag ? 'is-active' : ''} onClick={() => setActiveTag((current) => current === tag ? null : tag)}>
                  <i style={{ backgroundImage: image ? `url(${image})` : undefined }} />
                  <span>{tag}</span>
                </button>
              ))}
              <button className={`fp-cats__fav ${onlyFavorites ? 'is-active' : ''}`} onClick={() => setOnlyFavorites((value) => !value)}>
                <i><Heart size={22} fill={onlyFavorites ? 'currentColor' : 'none'} /></i>
                <span>Favoritos{favorites.length > 0 ? ` (${favorites.length})` : ''}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="fp-alert">
              <span>{error}</span>
              <button type="button" onClick={() => setRetryTick((tick) => tick + 1)}><RefreshCw size={13} /> Reintentar</button>
            </div>
          )}

          {orderMode === 'day' && hasSpecialDay && specialDay && (
            <SpecialDayCard
              specialDay={specialDay}
              chosen={specialDayChosen}
              onChoose={() => {
                const next = !specialDayChosen
                setSpecialDayChosen(next)
                if (next) {
                  setSelectedMealId(null)
                  setPackageTier(null)
                  const price = specialDay.packagePrice || 0
                  trackAddToCart([{ item_id: 'especial', item_name: specialDay.packageName || 'Menú especial', item_category: 'menu_especial', price, quantity }], price * quantity)
                }
              }}
            />
          )}

          {(orderMode !== 'day' || !hasSpecialDay || currentMeals.length > 0) && (
            <>
              {!isLoadingCurrent && currentMeals.length > 0 && (
                <div className="fp-list-head">
                  <h3>{orderMode === 'day' ? 'Guisados del día' : 'Lo que cocinaremos'}</h3>
                  <span>{visibleMeals.length} {visibleMeals.length === 1 ? 'opción' : 'opciones'}</span>
                </div>
              )}
              <div className="fp-dishes">
                {isLoadingCurrent && Array.from({ length: 3 }, (_, index) => <div className="fp-dish-skeleton" key={index}><i /><b /><b /><b /></div>)}
                {!isLoadingCurrent && visibleMeals.map((meal, index) => (
                  <DishCard
                    key={`${orderMode}-${activeWeekDay}-${meal.id}`}
                    meal={meal}
                    index={index}
                    isFavorite={favorites.includes(meal.id)}
                    onToggleFavorite={() => toggleFavorite(meal.id)}
                    selectedPackage={packageTier}
                    selectedMealId={orderMode === 'day' ? selectedMealId : null}
                    onChoosePackage={orderMode === 'day' ? chooseMealPackage : (_mealId, tier) => choosePackage(tier)}
                  />
                ))}
              </div>
              {!isLoadingCurrent && !error && currentMeals.length === 0 && (
                <div className="fp-empty"><span aria-hidden="true">👩‍🍳</span><h3>Menú en preparación</h3><p>La cocina todavía no publica los guisados de este día. Prueba con otro día.</p></div>
              )}
              {!isLoadingCurrent && currentMeals.length > 0 && visibleMeals.length === 0 && (
                <div className="fp-empty"><span aria-hidden="true">🔍</span><h3>Sin resultados</h3><p>Ningún guisado coincide con tu búsqueda.</p><button type="button" className="fp-btn fp-btn--soft" onClick={clearFilters}>Ver todo el menú</button></div>
              )}
            </>
          )}
        </div>

        <div className="fp-order__side">
          {orderMode === 'day' ? (
            <OrderSummary
              packageTier={packageTier}
              quantity={quantity}
              repeatGuisado={repeatGuisado}
              garnish={garnish}
              deliveryDate={selectedDate}
              meal={selectedMeal}
              canOrder={orderingOpen}
              specialDay={hasSpecialDay ? specialDay : null}
              specialDayChosen={specialDayChosen}
              specialAddons={specialAddons}
              onQuantity={changeQuantity}
              onToggleRepeat={() => setRepeatGuisado((value) => !value)}
              onGarnish={setGarnish}
              onToggleAddon={toggleSpecialAddon}
              onCheckout={openCheckout}
            />
          ) : (
            <WeeklySummary
              packageTier={packageTier}
              quantity={quantity}
              prepay={prepay}
              garnish={garnish}
              canOrder={orderingOpen}
              onQuantity={changeQuantity}
              onTogglePrepay={() => setPrepay((value) => !value)}
              onGarnish={setGarnish}
              onCheckout={openCheckout}
            />
          )}
        </div>
      </main>

      <section className="fp-section">
        <div className="fp-promo">
          <div className="fp-promo__copy">
            <span className="fp-eyebrow">Oferta exclusiva</span>
            <h2>Arma tu semana y <em>ahorra.</em></h2>
            <p>Paga tu plan de lunes a viernes por adelantado y llévate el mejor precio en cualquier paquete.</p>
            <button type="button" className="fp-btn fp-btn--primary fp-btn--arrow" onClick={() => { setOrderMode('week'); scrollToPackages() }}>
              Armar mi semana <i><ArrowRight size={17} /></i>
            </button>
          </div>
          <div className="fp-promo__media">
            <img src="/assets/meals/weekly-hero.jpg" alt="Comidas de la semana en contenedores" loading="lazy" />
          </div>
          <div className="fp-promo__badge"><small>Hasta</small><strong>-{money(MAX_WEEKLY_SAVINGS)}</strong><span>por semana</span></div>
        </div>
      </section>

      <AppDownload meals={currentMeals.length ? currentMeals : (menu?.meals || [])} />

      <Footer />

      {badgeCount > 0 && !checkoutOpen && (
        <div className="fp-cartbar" role="region" aria-label="Resumen rápido del pedido">
          <button type="button" onClick={onCartBar}>
            <b>{badgeCount}</b>
            <span><small>{cartLabel}</small><strong>{money(activeTotal)}</strong></span>
            <em>{orderReady && orderingOpen ? 'Continuar' : 'Ver pedido'} <ChevronRight size={17} /></em>
          </button>
        </div>
      )}

      <nav className="fp-tabbar" aria-label="Navegación">
        <button className={orderMode === 'day' ? 'is-active' : ''} onClick={goToDayMenu}>
          <Utensils size={21} /><span>Menú</span>
        </button>
        <button className={orderMode === 'week' ? 'is-active' : ''} onClick={goToWeekPlan}>
          <CalendarDays size={21} /><span>Semana</span>
        </button>
        <button className="fp-tabbar__main" onClick={onCartBar} aria-label="Mi pedido">
          <i><ShoppingBag size={24} />{badgeCount > 0 && <b>{badgeCount}</b>}</i>
          <span>Pedido</span>
        </button>
        <button onClick={scrollToPackages}>
          <Sparkles size={21} /><span>Paquetes</span>
        </button>
        <button className={menuOpen ? 'is-active' : ''} onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="app-menu">
          <Menu size={21} /><span>Más</span>
        </button>
      </nav>

      {checkoutOpen && <button className="fp-sheet-backdrop" aria-label="Cerrar" onClick={closeCheckout} />}
      {checkoutOpen && (
        <section className="fp-checkout" role="dialog" aria-modal="true" aria-label="Confirmar pedido">
          <div className="fp-sheet-handle" aria-hidden="true" />
          {order ? (
            <div className="fp-confirmed">
              <button className="fp-icon-btn fp-checkout__close" onClick={closeCheckout} aria-label="Cerrar"><X size={19} /></button>
              <AcceptedOrderAnimation />
              <span className="fp-pill fp-pill--green"><PartyPopper size={14} /> Pedido {order.id}</span>
              <h2>{order.isWeeklyPlan ? '¡Tu semana está lista!' : `¡Nos vemos el ${fullDate(order.deliveryDate).toLowerCase()}!`}</h2>
              <p>
                Llegará a {order.delivery?.office || 'tu oficina'} entre 12:00 y 2:00 pm.
                {order.items[0]?.garnish && <> Guarnición: {order.items[0].garnish === 'arroz' ? 'arroz' : 'frijoles'}.</>}
              </p>
              <div className="fp-confirmed__pay">
                {order.paymentMethod === 'transfer' ? <Landmark size={20} /> : order.paymentMethod === 'terminal' ? <CreditCard size={20} /> : <Banknote size={20} />}
                <p>{order.paymentMethod === 'transfer'
                  ? 'Envía tu comprobante de transferencia por WhatsApp para que tu pedido entre a producción.'
                  : order.paymentMethod === 'terminal'
                    ? 'El repartidor llevará terminal para que pagues con tarjeta al recibir.'
                    : 'Pagarás en efectivo al recibir. ¡Ten tu cambio listo!'}</p>
              </div>
              {order.delivery?.mapUrl && <a className="fp-link" href={order.delivery.mapUrl} target="_blank" rel="noreferrer"><MapPin size={15} /> Ver dirección guardada</a>}
              <button className="fp-btn fp-btn--primary fp-btn--block fp-btn--lg" onClick={closeCheckout}>Listo</button>
            </div>
          ) : (
            <form onSubmit={placeOrder} className="fp-checkout__form">
              <div className="fp-checkout__top">
                <div>
                  <span className="fp-eyebrow">Último paso</span>
                  <h2>Confirma tu pedido</h2>
                </div>
                <button type="button" className="fp-icon-btn" onClick={closeCheckout} aria-label="Cerrar"><X size={19} /></button>
              </div>

              <div className="fp-checkout__scroll">
                <div className="fp-recap">
                  {orderMode === 'day' && !usingSpecial && selectedMeal && <img src={selectedMeal.image} alt="" />}
                  {usingSpecial && specialDay?.image && <img src={specialDay.image} alt="" />}
                  {(orderMode === 'week' || (!usingSpecial && !selectedMeal) || (usingSpecial && !specialDay?.image)) && <span className="fp-recap__ph"><CalendarDays size={20} /></span>}
                  <p>
                    <strong>{usingSpecial ? specialDay?.packageName : (orderMode === 'week' ? `Plan semanal ${activePackage?.label || ''}` : selectedMeal?.name)}</strong>
                    <span>
                      {quantity} {quantity === 1 ? 'persona' : 'personas'}
                      {!usingSpecial && activePackage && orderMode === 'day' ? ` · ${activePackage.label}` : ''}
                      {!usingSpecial ? ` · ${garnish === 'arroz' ? 'Arroz' : 'Frijoles'}` : ''}
                      {usingSpecial && specialAddons.length ? ` · ${specialAddons.join(', ')}` : ''}
                      {orderMode === 'week' && prepay ? ` · ahorras ${money(weekSavings)}` : ''}
                    </span>
                    <small><Truck size={13} /> {orderMode === 'day' && selectedDate ? fullDate(selectedDate) : 'Desde el próximo día hábil'} · 12–2 pm</small>
                  </p>
                </div>

                <fieldset className="fp-step-block">
                  <legend><b>1</b> ¿Quién recibe?</legend>
                  <div className="fp-grid-2">
                    <label className="fp-input">Nombre<input name="name" autoComplete="name" required placeholder="Tu nombre" /></label>
                    <label className="fp-input">Teléfono<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="55 1234 5678" /></label>
                  </div>
                  <label className="fp-input">Empresa, edificio u oficina<input name="office" autoComplete="organization" required minLength={2} placeholder="Ej. Torre Lindavista, piso 3" /></label>
                </fieldset>

                <fieldset className="fp-step-block" id="paso-ubicacion">
                  <legend><b>2</b> ¿Dónde entregamos?</legend>
                  <AddressSearch
                    value={deliveryAddress}
                    onChange={updateDeliveryAddress}
                    onPick={pickAddress}
                    onLocate={useCurrentLocation}
                    locating={locating}
                  />
                  <div className={`fp-map ${hasDeliveryPin ? (pinInsideZone ? 'is-ok' : 'is-out') : ''}`}>
                    <Suspense fallback={<div className="fp-map__canvas fp-map__canvas--loading" />}>
                      <DeliveryMap coordinates={deliveryCoordinates} onMove={(location) => { addressFromPin.current = addressFromPin.current || !deliveryAddress.trim(); placePin(location) }} />
                    </Suspense>
                    <div className="fp-map__bar">
                      <span className="fp-map__state">
                        <i />{hasDeliveryPin ? (pinInsideZone ? 'Dentro de la zona de entrega' : 'Fuera de la zona de entrega') : 'Toca el mapa o busca tu calle'}
                      </span>
                      <a href={externalMapUrl(deliveryCoordinates)} target="_blank" rel="noreferrer">Google Maps <ArrowRight size={13} /></a>
                    </div>
                  </div>
                  <p className="fp-hint"><MapPin size={13} /> Zona: Lindavista Sur y San Felipe de Jesús (área punteada). Arrastra el pin para afinar.</p>
                  {deliveryError && <div className="fp-alert fp-alert--soft">{deliveryError}</div>}
                  <label className="fp-input">Indicaciones (opcional)<textarea name="notes" maxLength={300} placeholder="Ej. Dejar en recepción, preguntar por Ana" /></label>
                </fieldset>

                <fieldset className="fp-step-block">
                  <legend><b>3</b> ¿Cómo pagas?</legend>
                  <div className="fp-pay">
                    <button type="button" className={paymentMethod === 'transfer' ? 'is-active' : ''} onClick={() => setPaymentMethod('transfer')}>
                      <Landmark size={22} /><span>Transferencia</span>{paymentMethod === 'transfer' && <Check size={15} className="fp-pay__check" />}
                    </button>
                    <button type="button" className={paymentMethod === 'cash' ? 'is-active' : ''} onClick={() => { setPaymentMethod('cash'); setPrepay(false) }}>
                      <Banknote size={22} /><span>Efectivo</span>{paymentMethod === 'cash' && <Check size={15} className="fp-pay__check" />}
                    </button>
                    <button type="button" className={paymentMethod === 'terminal' ? 'is-active' : ''} onClick={() => { setPaymentMethod('terminal'); setPrepay(false) }}>
                      <CreditCard size={22} /><span>Tarjeta</span>{paymentMethod === 'terminal' && <Check size={15} className="fp-pay__check" />}
                    </button>
                  </div>
                  {paymentMethod === 'transfer' && (
                    <div className="fp-bank">
                      <p>Transfiere y envía tu comprobante por WhatsApp</p>
                      <dl>
                        <div><dt>Banco</dt><dd>{BANK_TRANSFER.bank}</dd></div>
                        <div><dt>CLABE</dt><dd>{BANK_TRANSFER.clabe}</dd></div>
                        <div><dt>Titular</dt><dd>{BANK_TRANSFER.holder}</dd></div>
                      </dl>
                    </div>
                  )}
                  {paymentMethod === 'terminal' && <p className="fp-hint"><CreditCard size={13} /> El repartidor llevará terminal para que pagues con tarjeta al recibir.</p>}
                  {paymentMethod === 'cash' && <p className="fp-hint"><Banknote size={13} /> Pagas al recibir tu comida.</p>}
                </fieldset>

                {orderError && <div className="fp-alert"><span>{orderError}</span></div>}
                <p className="fp-legal">Al confirmar aceptas nuestro <a href="/privacidad" target="_blank" rel="noreferrer">Aviso de privacidad</a>.</p>
              </div>

              <div className="fp-checkout__foot">
                <p><span>Total · envío gratis</span><strong>{money(activeTotal)}</strong></p>
                <button className="fp-btn fp-btn--primary fp-btn--lg" disabled={submitting || !isOnline}>
                  {submitting ? 'Confirmando…' : (isOnline ? <>Confirmar pedido <Check size={18} /></> : 'Sin conexión')}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

export default App
