import { ChangeEvent, CSSProperties, DragEvent, FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft, Ban, Banknote, Building2, Check, CheckCircle2, ClipboardList, CreditCard, Eye, EyeOff,
  ImagePlus, Landmark, Loader2, LogOut, MapPin, Navigation, PackageOpen, Pencil, Phone, Plus, Receipt,
  RefreshCw, RotateCcw, Save, ShoppingBag, StickyNote, Trash2, TriangleAlert, UtensilsCrossed, X,
} from 'lucide-react'
import {
  adminLogin, createAdminProduct, deleteAdminOrder, deleteAdminProduct, getAdminMenu, getAdminOrders,
  getAdminProducts, getMenuDays, saveAdminMenu, updateAdminOrderStatus, updateAdminProduct, uploadAdminImage,
} from './api'
import FloatingDecor from './components/FloatingDecor'
import Logo from './components/Logo'
import type { Meal, MenuDay, OrderStatus, SavedOrder } from './types'

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

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  accepted: 'Aceptado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const ORDER_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'accepted', label: 'Por entregar' },
  { key: 'completed', label: 'Completados' },
  { key: 'cancelled', label: 'Cancelados' },
] as const

type OrderFilter = (typeof ORDER_FILTERS)[number]['key']

function paymentLabel(method: SavedOrder['paymentMethod']) {
  if (method === 'card') return 'Tarjeta'
  if (method === 'cash') return 'Efectivo'
  return 'Transferencia'
}

function PaymentIcon({ method }: { method: SavedOrder['paymentMethod'] }) {
  if (method === 'card') return <CreditCard size={13} />
  if (method === 'cash') return <Banknote size={13} />
  return <Landmark size={13} />
}

function OrderCard({ order, index, busy, onStatus, onDelete }: {
  order: SavedOrder
  index: number
  busy: boolean
  onStatus: (status: OrderStatus) => void
  onDelete: () => void
}) {
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const address = order.delivery?.address || order.customer.address || ''
  const distanceKm = order.distanceKm ?? order.delivery?.distanceKm ?? null
  const outsideRadius = order.delivery?.withinRadius === false

  return (
    <article className={`order-card order-card--${order.status}`} style={{ '--i': index } as CSSProperties}>
      <div className="order-card__head">
        <div>
          <strong>{order.id}</strong>
          {order.isWeeklyPlan && <em className="plan-badge">Plan semanal</em>}
        </div>
        <span className={`order-status order-status--${order.status}`}><i />{ORDER_STATUS_LABELS[order.status]}</span>
      </div>

      <div className="order-card__grid">
        <div className="order-field">
          <span>Entrega</span>
          <strong>{longDate(order.deliveryDate)}</strong>
          <small>12:00 a 2:00 pm</small>
        </div>
        <div className="order-field">
          <span>Cliente</span>
          <strong>{order.customer.name}</strong>
          <a href={`tel:${order.customer.phone}`}><Phone size={11} /> {order.customer.phone}</a>
        </div>
        <div className="order-field">
          <span>Paquete</span>
          <strong>{order.items[0]?.packageLabel || '—'}</strong>
          <small>{units} {units === 1 ? 'persona' : 'personas'}{order.items[0]?.repeatGuisado ? ' · repite guisado' : ''}</small>
        </div>
        <div className="order-field">
          <span>Pago</span>
          <strong className="order-payment"><PaymentIcon method={order.paymentMethod} /> {paymentLabel(order.paymentMethod)}</strong>
          <small>{order.items[0]?.prepay ? 'Pagado por adelantado' : 'Al recibir'}</small>
        </div>
        <div className="order-field order-field--total">
          <span>Total</span>
          <strong>{money(order.total)}</strong>
          {order.discountAmount > 0 && <small className="order-discount">Descuento {money(order.discountAmount)}</small>}
        </div>
      </div>

      <div className="order-address-block">
        <MapPin size={16} />
        <div>
          <span>Dirección de entrega</span>
          <strong>{address || 'Sin dirección registrada'}</strong>
          {order.delivery?.office && <p><Building2 size={11} /> {order.delivery.office}</p>}
          <p className="order-address-block__zone">{order.delivery?.zone || 'Lindavista, CDMX'}</p>
          <div className="order-address-block__links">
            {order.delivery?.mapUrl && <a href={order.delivery.mapUrl} target="_blank" rel="noreferrer"><MapPin size={11} /> Ver pin en Google Maps</a>}
            {distanceKm !== null && (
              <b className={outsideRadius ? 'order-distance order-distance--out' : 'order-distance'}>
                {outsideRadius ? <TriangleAlert size={11} /> : <Navigation size={11} />}
                {distanceKm.toFixed(1)} km {outsideRadius ? `· fuera de ${order.delivery?.radiusKm ?? 3} km` : '· dentro del radio'}
              </b>
            )}
            {distanceKm === null && <b className="order-distance order-distance--unknown"><Navigation size={11} /> Distancia sin verificar</b>}
          </div>
        </div>
      </div>

      {order.customer.notes && (
        <p className="order-notes"><StickyNote size={13} /> {order.customer.notes}</p>
      )}

      <div className="order-card__actions">
        {order.status !== 'completed' && (
          <button className="order-action order-action--complete" onClick={() => onStatus('completed')} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Marcar completado
          </button>
        )}
        {order.status !== 'cancelled' && (
          <button className="order-action order-action--cancel" onClick={() => onStatus('cancelled')} disabled={busy}>
            <Ban size={13} /> Cancelar
          </button>
        )}
        {order.status !== 'accepted' && (
          <button className="order-action" onClick={() => onStatus('accepted')} disabled={busy}>
            <RotateCcw size={13} /> Reabrir
          </button>
        )}
        <button className="order-action order-action--delete" onClick={onDelete} disabled={busy}>
          <Trash2 size={13} /> Eliminar
        </button>
      </div>
    </article>
  )
}

function resizeImageToBase64(file: File, maxSize = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Ese archivo no es una imagen válida'))
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('No se pudo procesar la imagen')); return }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
      }
      image.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

type ProductDraft = {
  name: string
  description: string
  price: string
  protein: string
  kcal: string
  tagsText: string
  image: string
  available: boolean
}

function draftFromMeal(meal?: Meal): ProductDraft {
  return {
    name: meal?.name ?? '',
    description: meal?.description ?? '',
    price: meal ? String(meal.price) : '139',
    protein: meal ? String(meal.protein) : '30',
    kcal: meal ? String(meal.kcal) : '520',
    tagsText: meal?.tags.join(', ') ?? '',
    image: meal?.image ?? placeholderImages[0],
    available: meal?.available ?? true,
  }
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

function ProductCard({
  meal, index, token, isNew, alreadyToday, onSaved, onDeleted, onCancelNew, onQuickAdd,
}: {
  meal?: Meal
  index: number
  token: string
  isNew?: boolean
  alreadyToday?: boolean
  onSaved: (meal: Meal, wasNew: boolean) => void
  onDeleted: (id: string) => void
  onCancelNew?: () => void
  onQuickAdd: (meal: Meal) => void
}) {
  const fileInputId = useId()
  const [editing, setEditing] = useState(Boolean(isNew))
  const [draft, setDraft] = useState<ProductDraft>(() => draftFromMeal(meal))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState('')

  const field = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const startEdit = () => {
    setDraft(draftFromMeal(meal))
    setLocalError('')
    setEditing(true)
  }

  const cancel = () => {
    if (isNew) { onCancelNew?.(); return }
    setDraft(draftFromMeal(meal))
    setLocalError('')
    setEditing(false)
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setLocalError('')
    try {
      const base64 = await resizeImageToBase64(file)
      const { url } = await uploadAdminImage(base64, 'image/jpeg', token)
      field('image', url)
    } catch (uploadError) {
      setLocalError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const save = async () => {
    setSaving(true)
    setLocalError('')
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: Number(draft.price) || 0,
      protein: Number(draft.protein) || 0,
      kcal: Number(draft.kcal) || 0,
      tags: draft.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
      image: draft.image,
      available: draft.available,
    }
    try {
      const response = isNew || !meal
        ? await createAdminProduct(payload, token)
        : await updateAdminProduct(meal.id, payload, token)
      onSaved(response.product, Boolean(isNew))
      setEditing(false)
    } catch (saveError) {
      setLocalError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el producto')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!meal) return
    if (!window.confirm(`¿Eliminar "${meal.name}" del catálogo? Los días ya asignados no se verán afectados.`)) return
    setDeleting(true)
    setLocalError('')
    try {
      await deleteAdminProduct(meal.id, token)
      onDeleted(meal.id)
    } catch (deleteError) {
      setLocalError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar')
      setDeleting(false)
    }
  }

  return (
    <article
      className={`editor-row${isNew ? ' catalog-card--new' : ''}`}
      style={{ '--i': index } as CSSProperties}
      draggable={!editing && Boolean(meal)}
      onDragStart={(event: DragEvent<HTMLElement>) => {
        if (!meal) return
        event.dataTransfer.setData('text/plain', meal.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <div className="editor-photo" style={{ backgroundImage: `url(${editing ? draft.image : meal?.image})` }} />
      {editing ? (
        <>
          <div className="editor-fields">
            <label>Nombre<input value={draft.name} onChange={(event) => field('name', event.target.value)} placeholder="Pollo cítrico al grill" /></label>
            <label>Descripción<input value={draft.description} onChange={(event) => field('description', event.target.value)} placeholder="Ingredientes y acompañamientos" /></label>
            <label>Etiquetas<input value={draft.tagsText} onChange={(event) => field('tagsText', event.target.value)} placeholder="Sin gluten, Alto en proteína" /></label>
            <div>
              <label>Precio<input type="number" min="1" value={draft.price} onChange={(event) => field('price', event.target.value)} /></label>
              <label>Proteína<input type="number" min="0" value={draft.protein} onChange={(event) => field('protein', event.target.value)} /></label>
              <label>Calorías<input type="number" min="0" value={draft.kcal} onChange={(event) => field('kcal', event.target.value)} /></label>
            </div>
            <div className="image-picker">
              {placeholderImages.map((image) => (
                <button
                  type="button"
                  key={image}
                  className={draft.image === image ? 'selected' : ''}
                  style={{ backgroundImage: `url(${image})` }}
                  onClick={() => field('image', image)}
                  aria-label="Usar esta foto"
                />
              ))}
              <label className="image-upload-btn" htmlFor={fileInputId}>
                {uploading ? <Loader2 size={12} className="spin" /> : <ImagePlus size={12} />} {uploading ? 'Subiendo…' : 'Subir foto'}
              </label>
              <input id={fileInputId} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
            </div>
            {localError && <span className="inline-error inline-error--tight">{localError}</span>}
          </div>
          <div className="editor-controls">
            <button className="availability active" onClick={() => field('available', !draft.available)} type="button"><i />{draft.available ? 'Disponible' : 'Agotado'}</button>
            <button className="admin-primary" disabled={saving || uploading} onClick={save} type="button">{saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Guardar</button>
            <button className="admin-secondary" onClick={cancel} type="button"><X size={14} /> Cancelar</button>
          </div>
        </>
      ) : meal ? (
        <>
          <div className="editor-fields product-view">
            <strong>{meal.name}</strong>
            <p>{meal.description}</p>
            <div className="product-view__tags">{meal.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="product-view__stats"><span>{money(meal.price)}</span><span>{meal.protein}g proteína</span><span>{meal.kcal} kcal</span></div>
            {localError && <span className="inline-error inline-error--tight">{localError}</span>}
          </div>
          <div className="editor-controls">
            <button className={`quick-add${alreadyToday ? ' added' : ''}`} onClick={() => onQuickAdd(meal)} type="button">
              {alreadyToday ? <><Check size={12} /> En el día</> : <><Plus size={12} /> Agregar al día</>}
            </button>
            <button className="edit-toggle" onClick={startEdit} type="button"><Pencil size={12} /> Editar</button>
            <button className="delete-meal" onClick={remove} disabled={deleting} type="button">{deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Eliminar</button>
          </div>
        </>
      ) : null}
    </article>
  )
}

function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [tab, setTab] = useState<'menu' | 'orders'>('menu')
  const [days, setDays] = useState<MenuDay[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [meals, setMeals] = useState<Meal[]>([])
  const [products, setProducts] = useState<Meal[]>([])
  const [addingProduct, setAddingProduct] = useState(false)
  const [orders, setOrders] = useState<SavedOrder[]>([])
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')
  const [orderBusy, setOrderBusy] = useState('')
  const [ordersTick, setOrdersTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [dayBusy, setDayBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const dayQueueRef = useRef(Promise.resolve())

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
    if (!token || tab !== 'menu') return
    setProductsLoading(true)
    getAdminProducts(token)
      .then(({ products: catalog }) => setProducts(catalog))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el catálogo'))
      .finally(() => setProductsLoading(false))
  }, [tab, token])

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
    let active = true
    setLoading(true)
    setError('')
    getAdminOrders(token)
      .then(({ orders: currentOrders }) => { if (active) setOrders(currentOrders) })
      .catch((requestError) => {
        if (!active) return
        const text = requestError instanceof Error ? requestError.message : 'No se pudieron cargar los pedidos'
        setError(text)
        if (/sesión|acceso/i.test(text)) logout()
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tab, token, ordersTick])

  if (!token) return <Login onSuccess={setToken} />

  const dayQueue = dayQueueRef.current

  const mutateDay = (mutate: (current: Meal[]) => Meal[]) => {
    setError('')
    let previous: Meal[] = []
    let next: Meal[] = []
    setMeals((current) => {
      previous = current
      next = mutate(current)
      return next
    })

    dayQueueRef.current = dayQueue.then(async () => {
      setDayBusy(true)
      try {
        const response = await saveAdminMenu(selectedDate, next, token)
        setMeals(response.meals)
        setMessage('Guardado')
        window.setTimeout(() => setMessage((current) => current === 'Guardado' ? '' : current), 1800)
      } catch (requestError) {
        setMeals(previous)
        setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar el día')
      } finally {
        setDayBusy(false)
      }
    })
  }

  const assignProductToDay = (product: Meal) => {
    mutateDay((current) => current.some((meal) => meal.id === product.id) ? current : [...current, { ...product }])
  }

  const removeFromDay = (id: string) => {
    mutateDay((current) => current.filter((meal) => meal.id !== id))
  }

  const toggleDayAvailability = (id: string) => {
    mutateDay((current) => current.map((meal) => meal.id === id ? { ...meal, available: !meal.available } : meal))
  }

  const handleProductSaved = (product: Meal, wasNew: boolean) => {
    setProducts((current) => wasNew ? [...current, product] : current.map((item) => item.id === product.id ? product : item))
    if (wasNew) setAddingProduct(false)
    setMessage('Producto guardado')
    window.setTimeout(() => setMessage((current) => current === 'Producto guardado' ? '' : current), 1800)
  }

  const handleProductDeleted = (id: string) => {
    setProducts((current) => current.filter((item) => item.id !== id))
  }

  const flash = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage((current) => current === text ? '' : current), 1800)
  }

  const refreshOrders = () => setOrdersTick((tick) => tick + 1)

  const changeOrderStatus = async (order: SavedOrder, status: OrderStatus) => {
    if (order.status === status) return
    if (status === 'cancelled' && !window.confirm(`¿Cancelar el pedido ${order.id} de ${order.customer.name}?`)) return
    setOrderBusy(order.id)
    setError('')
    const previous = orders
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item))
    try {
      const { order: saved } = await updateAdminOrderStatus(order.id, status, token)
      setOrders((current) => current.map((item) => item.id === saved.id ? saved : item))
      flash(status === 'completed' ? 'Pedido completado' : status === 'cancelled' ? 'Pedido cancelado' : 'Pedido reabierto')
    } catch (requestError) {
      setOrders(previous)
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el pedido')
    } finally {
      setOrderBusy('')
    }
  }

  const removeOrder = async (order: SavedOrder) => {
    if (!window.confirm(`¿Eliminar el pedido ${order.id}? Esta acción no se puede deshacer.`)) return
    setOrderBusy(order.id)
    setError('')
    const previous = orders
    setOrders((current) => current.filter((item) => item.id !== order.id))
    try {
      await deleteAdminOrder(order.id, token)
      flash('Pedido eliminado')
    } catch (requestError) {
      setOrders(previous)
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar el pedido')
    } finally {
      setOrderBusy('')
    }
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragOver(false)
    const id = event.dataTransfer.getData('text/plain')
    const product = products.find((item) => item.id === id)
    if (product) assignProductToDay(product)
  }

  const availableCount = meals.filter((meal) => meal.available).length
  const activeOrders = orders.filter((order) => order.status === 'accepted')
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled')
  const visibleOrders = orderFilter === 'all' ? orders : orders.filter((order) => order.status === orderFilter)
  const totalRevenue = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.total, 0)

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <Logo compact theme="white" />
        <div>
          <button className={tab === 'menu' ? 'selected' : ''} onClick={() => setTab('menu')}><ClipboardList size={15} /> Menús</button>
          <button className={tab === 'orders' ? 'selected' : ''} onClick={() => setTab('orders')}><ShoppingBag size={15} /> Pedidos</button>
        </div>
        <button className="logout-button" onClick={logout}><LogOut size={15} /> Salir</button>
      </aside>

      <main className="admin-main">
        {tab === 'menu' ? <>
          <header className="admin-page-head">
            <div><p>Menú diario</p><h1>{selectedDate ? longDate(selectedDate) : 'Cargando…'}</h1><span>Arrastra un producto del catálogo al día, o usa el botón "Agregar al día".</span></div>
            <div className="admin-head-actions">
              {message && <span className="save-message"><Check size={14} /> {message}</span>}
              {dayBusy && <span className="save-message"><Loader2 size={14} className="spin" /> Guardando…</span>}
            </div>
          </header>

          <div className="admin-stats">
            <div className="admin-stat"><UtensilsCrossed size={20} /><span><b>{meals.length}</b>Platillos hoy</span></div>
            <div className="admin-stat admin-stat--accent"><CheckCircle2 size={20} /><span><b>{availableCount}</b>Disponibles</span></div>
            <div className="admin-stat"><PackageOpen size={20} /><span><b>{products.length}</b>En tu catálogo</span></div>
          </div>

          <div className="admin-date-strip">
            {days.map((day, index) => <button key={day.date} className={selectedDate === day.date ? 'selected' : ''} onClick={() => setSelectedDate(day.date)}><span>{index === 0 ? 'Mañana' : shortDay(day.date)}</span><strong>{dateFromKey(day.date).getDate()}</strong></button>)}
          </div>

          {error && <div className="inline-error">{error}</div>}

          <div className="planner-board">
            <section
              className={`planner-day${dragOver ? ' drag-over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="planner-day__head"><h2>Este día</h2><span>{meals.length} platillos</span></div>
              {loading ? (
                <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando menú…</div>
              ) : meals.length === 0 ? (
                <div className="planner-day__empty">Aún no hay nada aquí.<br />Arrastra un producto del catálogo o usa "Agregar al día".</div>
              ) : (
                <ul className="planner-day__list">
                  {meals.map((meal, index) => (
                    <li key={meal.id} style={{ '--i': index } as CSSProperties}>
                      <div className="planner-meal-thumb" style={{ backgroundImage: `url(${meal.image})` }} />
                      <div><strong>{meal.name}</strong><span>{money(meal.price)}</span></div>
                      <button className={`availability ${meal.available ? 'active' : ''}`} onClick={() => toggleDayAvailability(meal.id)}><i />{meal.available ? 'Disponible' : 'Agotado'}</button>
                      <button className="delete-meal" onClick={() => removeFromDay(meal.id)}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="planner-catalog">
              <div className="planner-catalog__head">
                <h2>Catálogo</h2>
                <button className="admin-secondary" onClick={() => setAddingProduct(true)} disabled={addingProduct}><Plus size={14} /> Nuevo producto</button>
              </div>
              <div className="catalog-grid">
                {addingProduct && (
                  <ProductCard
                    index={0}
                    token={token}
                    isNew
                    onSaved={handleProductSaved}
                    onDeleted={handleProductDeleted}
                    onCancelNew={() => setAddingProduct(false)}
                    onQuickAdd={() => {}}
                  />
                )}
                {productsLoading && <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando catálogo…</div>}
                {!productsLoading && products.length === 0 && !addingProduct && (
                  <div className="admin-empty"><PackageOpen size={26} /><strong>Aún no hay productos</strong>Crea el primero para empezar a armar tus menús.</div>
                )}
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    meal={product}
                    index={index + 1}
                    token={token}
                    alreadyToday={meals.some((meal) => meal.id === product.id)}
                    onSaved={handleProductSaved}
                    onDeleted={handleProductDeleted}
                    onQuickAdd={assignProductToDay}
                  />
                ))}
              </div>
            </section>
          </div>
        </> : <>
          <header className="admin-page-head">
            <div><p>Operación</p><h1>Pedidos</h1><span>Marca cada pedido como completado o cancelado, y elimina los que ya no necesites.</span></div>
            <div className="admin-head-actions">
              {message && <span className="save-message"><Check size={14} /> {message}</span>}
              <button className="admin-secondary" onClick={refreshOrders} disabled={loading}>
                {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Actualizar
              </button>
            </div>
          </header>

          <div className="admin-stats">
            <div className="admin-stat"><ShoppingBag size={20} /><span><b>{activeOrders.length}</b>Por entregar</span></div>
            <div className="admin-stat admin-stat--accent"><CheckCircle2 size={20} /><span><b>{completedOrders.length}</b>Completados</span></div>
            <div className="admin-stat"><Ban size={20} /><span><b>{cancelledOrders.length}</b>Cancelados</span></div>
            <div className="admin-stat"><Receipt size={20} /><span><b>{money(totalRevenue)}</b>Ingresos</span></div>
          </div>

          <div className="orders-filters" role="tablist" aria-label="Filtrar pedidos">
            {ORDER_FILTERS.map((filter) => (
              <button
                key={filter.key}
                role="tab"
                aria-selected={orderFilter === filter.key}
                className={orderFilter === filter.key ? 'selected' : ''}
                onClick={() => setOrderFilter(filter.key)}
              >
                {filter.label} <b>{filter.key === 'all' ? orders.length : orders.filter((order) => order.status === filter.key).length}</b>
              </button>
            ))}
          </div>

          {error && <div className="inline-error">{error}</div>}
          {loading && <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando pedidos…</div>}

          <div className="orders-list">
            {!loading && visibleOrders.map((order, index) => (
              <OrderCard
                key={order.id}
                order={order}
                index={index}
                busy={orderBusy === order.id}
                onStatus={(status) => changeOrderStatus(order, status)}
                onDelete={() => removeOrder(order)}
              />
            ))}
            {!loading && orders.length === 0 && (
              <div className="admin-empty"><PackageOpen size={26} /><strong>Todavía no hay pedidos</strong>Aquí aparecerán en cuanto lleguen.</div>
            )}
            {!loading && orders.length > 0 && visibleOrders.length === 0 && (
              <div className="admin-empty"><PackageOpen size={26} /><strong>Nada en este filtro</strong>Cambia de pestaña para ver los demás pedidos.</div>
            )}
          </div>
        </>}
      </main>
    </div>
  )
}

export default AdminApp
