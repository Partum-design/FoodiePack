import { ChangeEvent, CSSProperties, DragEvent, FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft, Banknote, Check, CheckCircle2, CircleX, ClipboardList, CreditCard, Eye, EyeOff,
  ImagePlus, Landmark, Loader2, LogOut, MapPin, PackageOpen, Pencil, Phone, Plus, Receipt, Save, ShoppingBag,
  Trash2, UtensilsCrossed, X,
} from 'lucide-react'
import {
  adminLogin, createAdminProduct, deleteAdminOrder, deleteAdminProduct, getAdminMenu, getAdminOrders,
  getAdminProducts, getMenuDays, saveAdminMenu, updateAdminOrderStatus, updateAdminProduct, uploadAdminImage,
} from './api'
import FloatingDecor from './components/FloatingDecor'
import Logo from './components/Logo'
import { PACKAGE_ORDER } from './packages'
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

function orderStatusLabel(status: string) {
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'accepted') return 'Aceptado'
  return 'Confirmado'
}

function longDate(date: string) {
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(date))
  return value.charAt(0).toUpperCase() + value.slice(1)
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
      packages: [...PACKAGE_ORDER],
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
            <div className="product-view__tags">{meal.tags.map((tag) => <span key={tag}>{tag}</span>)}<span>3 paquetes</span></div>
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
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [dayBusy, setDayBusy] = useState(false)
  const [orderBusyId, setOrderBusyId] = useState('')
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
    setLoading(true)
    getAdminOrders(token)
      .then(({ orders: currentOrders }) => setOrders(currentOrders))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los pedidos'))
      .finally(() => setLoading(false))
  }, [tab, token])

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

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragOver(false)
    const id = event.dataTransfer.getData('text/plain')
    const product = products.find((item) => item.id === id)
    if (product) assignProductToDay(product)
  }

  const availableCount = meals.filter((meal) => meal.available).length
  const totalRevenue = orders.reduce((sum, order) => order.status === 'cancelled' ? sum : sum + order.total, 0)

  const cancelOrder = async (order: SavedOrder) => {
    if (order.status === 'cancelled' || !window.confirm(`¿Cancelar el pedido ${order.id}? Se conservará el registro con estado cancelado.`)) return
    setOrderBusyId(order.id)
    setError('')
    try {
      const { order: updatedOrder } = await updateAdminOrderStatus(order.id, 'cancelled', token)
      setOrders((current) => current.map((item) => item.id === updatedOrder.id ? updatedOrder : item))
      setMessage('Pedido cancelado')
      window.setTimeout(() => setMessage((current) => current === 'Pedido cancelado' ? '' : current), 1800)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cancelar el pedido')
    } finally {
      setOrderBusyId('')
    }
  }

  const removeOrder = async (order: SavedOrder) => {
    if (!window.confirm(`¿Eliminar definitivamente el pedido ${order.id}? Esta acción no se puede deshacer.`)) return
    setOrderBusyId(order.id)
    setError('')
    try {
      await deleteAdminOrder(order.id, token)
      setOrders((current) => current.filter((item) => item.id !== order.id))
      setMessage('Pedido eliminado')
      window.setTimeout(() => setMessage((current) => current === 'Pedido eliminado' ? '' : current), 1800)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar el pedido')
    } finally {
      setOrderBusyId('')
    }
  }

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
        <div className="admin-main__brand">
          <Logo />
          <div className="admin-main__brand-copy">
            <strong>FOODIE PACK</strong>
            <span>foodiepack.com.mx · Administración</span>
          </div>
          <span className="admin-main__status"><i /> Sistema operativo</span>
        </div>
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
            {days.map((day, index) => <button key={day.date} className={selectedDate === day.date ? 'selected' : ''} onClick={() => setSelectedDate(day.date)}><span>{index === 0 ? 'Próximo hábil' : shortDay(day.date)}</span><strong>{dateFromKey(day.date).getDate()}</strong></button>)}
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
          <header className="admin-page-head"><div><p>Foodie Pack · Operación</p><h1>Pedidos</h1><span>Aquí llegan los pedidos aceptados.</span></div></header>

          <div className="admin-stats">
            <div className="admin-stat"><ShoppingBag size={20} /><span><b>{orders.length}</b>Pedidos</span></div>
            <div className="admin-stat admin-stat--accent"><Receipt size={20} /><span><b>{money(totalRevenue)}</b>Ingresos</span></div>
          </div>

          {error && <div className="inline-error">{error}</div>}
          {loading && <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando pedidos…</div>}
          <div className="orders-table">
            <div className="orders-table__head"><span>Pedido</span><span>Entrega</span><span>Cliente</span><span>Dirección</span><span>Paquete</span><span>Pago</span><span>Total</span><span>Estado</span><span>Acciones</span></div>
            {!loading && orders.map((order, index) => (
              <div className="orders-table__row" key={order.id} style={{ '--i': index } as CSSProperties}>
                <strong>{order.id}{order.isWeeklyPlan && <em className="plan-badge">Plan semanal</em>}{order.items[0]?.promo2x1 && <em className="plan-badge">2x1</em>}</strong>
                <span>{longDate(order.deliveryDate)}</span>
                <span className="order-customer">
                  <strong>{order.customer.name}</strong>
                  {order.customer.phone && <a href={`tel:${order.customer.phone}`}><Phone size={11} /> {order.customer.phone}</a>}
                </span>
                <span className="order-address">
                  <strong>{order.delivery?.address || order.customer.address || 'Sin dirección'}</strong>
                  {order.delivery?.office && <small>{order.delivery.office}</small>}
                  {order.delivery?.mapUrl && <a href={order.delivery.mapUrl} target="_blank" rel="noreferrer"><MapPin size={12} /> Ver pin</a>}
                </span>
                <span>{order.items[0]?.packageLabel || '—'} · {order.items.reduce((sum, item) => sum + item.quantity, 0)}{order.items[0]?.mealName ? <small className="order-meal-name">{order.items[0].mealName}</small> : null}{order.items[0]?.garnish ? <small className="order-meal-name">Guarnición: {order.items[0].garnish === 'arroz' ? 'Arroz' : 'Frijoles'}</small> : null}</span>
                <span className="order-payment">
                  {order.paymentMethod === 'card' || order.paymentMethod === 'terminal' ? <CreditCard size={13} /> : order.paymentMethod === 'cash' ? <Banknote size={13} /> : <Landmark size={13} />}
                  {' '}{order.paymentMethod === 'card' ? 'Tarjeta' : order.paymentMethod === 'terminal' ? 'Terminal' : order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                </span>
                <strong>{money(order.total)}{order.discountAmount > 0 && <small className="order-discount">-{money(order.discountAmount)}</small>}</strong>
                <b className={`order-status ${order.status === 'accepted' ? '' : order.status === 'cancelled' ? 'order-status--cancelled' : 'status-confirmed'}`}>{orderStatusLabel(order.status)}</b>
                <span className="order-actions" aria-label={`Acciones del pedido ${order.id}`}>
                  <button className="order-action order-action--cancel" type="button" title={order.status === 'cancelled' ? 'Pedido ya cancelado' : 'Cancelar pedido'} disabled={order.status === 'cancelled' || orderBusyId === order.id} onClick={() => cancelOrder(order)}><CircleX size={13} /><span>Cancelar</span></button>
                  <button className="order-action order-action--delete" type="button" title="Eliminar pedido" disabled={orderBusyId === order.id} onClick={() => removeOrder(order)}><Trash2 size={13} /><span>Eliminar</span></button>
                </span>
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
