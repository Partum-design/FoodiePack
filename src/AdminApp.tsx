import { ChangeEvent, CSSProperties, DragEvent, FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft, Banknote, CalendarOff, Check, CheckCircle2, CircleX, ClipboardList, CreditCard, Eye, EyeOff,
  ImagePlus, Landmark, Loader2, LogOut, MapPin, PackageOpen, Pencil, Phone, Plus, Receipt, Save, ShoppingBag,
  Trash2, UtensilsCrossed, X,
} from 'lucide-react'
import {
  adminLogin, createAdminProduct, deleteAdminOrder, deleteAdminProduct, deleteAdminSpecialDay, getAdminMenu,
  getAdminOrders, getAdminProducts, getAdminSpecialDays, getMenuDays, saveAdminMenu, saveAdminSpecialDay,
  updateAdminOrderStatus, updateAdminProduct, uploadAdminImage,
} from './api'
import FloatingDecor from './components/FloatingDecor'
import Logo from './components/Logo'
import Reveal from './components/Reveal'
import { useRipple } from './motion'
import { PACKAGE_ORDER } from './packages'
import type { Meal, MenuDay, SavedOrder, SpecialDay } from './types'

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
  useRipple()
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
            <div className="editor-fields__price">
              <label>Precio<input type="number" min="1" value={draft.price} onChange={(event) => field('price', event.target.value)} /></label>
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
            <div className="product-view__stats"><span>{money(meal.price)}</span></div>
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

type SpecialDayDraft = {
  date: string
  kind: 'closed' | 'special_package'
  label: string
  reason: string
  packageName: string
  packagePrice: string
  packageIncludesText: string
  addons: Array<{ name: string; price: string }>
  image: string
}

function emptySpecialDayDraft(): SpecialDayDraft {
  return { date: '', kind: 'special_package', label: '', reason: '', packageName: '', packagePrice: '', packageIncludesText: '', addons: [], image: '' }
}

function draftFromSpecialDay(day: SpecialDay): SpecialDayDraft {
  return {
    date: day.date,
    kind: day.kind,
    label: day.label,
    reason: day.reason || '',
    packageName: day.packageName || '',
    packagePrice: day.packagePrice != null ? String(day.packagePrice) : '',
    packageIncludesText: (day.packageIncludes || []).join(', '),
    addons: (day.addons || []).map((addon) => ({ name: addon.name, price: String(addon.price) })),
    image: day.image || '',
  }
}

function SpecialDayRow({ specialDay, token, isNew, onSaved, onDeleted, onCancelNew }: {
  specialDay?: SpecialDay
  token: string
  isNew?: boolean
  onSaved: (day: SpecialDay, wasNew: boolean) => void
  onDeleted: (date: string) => void
  onCancelNew?: () => void
}) {
  const fileInputId = useId()
  const [editing, setEditing] = useState(Boolean(isNew))
  const [draft, setDraft] = useState<SpecialDayDraft>(() => specialDay ? draftFromSpecialDay(specialDay) : emptySpecialDayDraft())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState('')

  const field = <K extends keyof SpecialDayDraft>(key: K, value: SpecialDayDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

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

  const startEdit = () => {
    if (specialDay) setDraft(draftFromSpecialDay(specialDay))
    setLocalError('')
    setEditing(true)
  }

  const cancel = () => {
    if (isNew) { onCancelNew?.(); return }
    if (specialDay) setDraft(draftFromSpecialDay(specialDay))
    setLocalError('')
    setEditing(false)
  }

  const addAddon = () => field('addons', [...draft.addons, { name: '', price: '' }])
  const updateAddon = (index: number, patch: Partial<{ name: string; price: string }>) =>
    field('addons', draft.addons.map((addon, i) => i === index ? { ...addon, ...patch } : addon))
  const removeAddon = (index: number) => field('addons', draft.addons.filter((_, i) => i !== index))

  const save = async () => {
    const date = isNew ? draft.date : specialDay?.date
    if (!date) { setLocalError('Elige una fecha.'); return }
    if (!draft.label.trim()) { setLocalError('Escribe una etiqueta para identificar este día.'); return }
    setSaving(true)
    setLocalError('')
    const payload = {
      kind: draft.kind,
      label: draft.label.trim(),
      reason: draft.reason.trim(),
      ...(draft.kind === 'special_package' ? {
        packageName: draft.packageName.trim(),
        packagePrice: Number(draft.packagePrice) || 0,
        packageIncludes: draft.packageIncludesText.split(',').map((item) => item.trim()).filter(Boolean),
        addons: draft.addons.map((addon) => ({ name: addon.name.trim(), price: Number(addon.price) || 0 })).filter((addon) => addon.name),
        ...(draft.image ? { image: draft.image } : {}),
      } : { packageIncludes: [], addons: [] }),
    }
    try {
      const { specialDay: saved } = await saveAdminSpecialDay(date, payload, token)
      onSaved(saved, Boolean(isNew))
      if (!isNew) setEditing(false)
    } catch (saveError) {
      setLocalError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el día especial')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!specialDay) return
    if (!window.confirm(`¿Eliminar el día especial del ${longDate(specialDay.date)}?`)) return
    setDeleting(true)
    setLocalError('')
    try {
      await deleteAdminSpecialDay(specialDay.date, token)
      onDeleted(specialDay.date)
    } catch (deleteError) {
      setLocalError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar')
      setDeleting(false)
    }
  }

  return (
    <article className={`editor-row special-day-row${isNew ? ' catalog-card--new' : ''}`}>
      {editing ? (
        <>
          <div className="editor-fields">
            {isNew && <label>Fecha<input type="date" value={draft.date} onChange={(event) => field('date', event.target.value)} required /></label>}
            <div className="special-day-kind-toggle">
              <button type="button" className={draft.kind === 'special_package' ? 'selected' : ''} onClick={() => field('kind', 'special_package')}>Menú especial</button>
              <button type="button" className={draft.kind === 'closed' ? 'selected' : ''} onClick={() => field('kind', 'closed')}>Día cerrado</button>
            </div>
            <label>Etiqueta interna<input value={draft.label} onChange={(event) => field('label', event.target.value)} placeholder="Menú especial de pozole" /></label>
            <label>Mensaje para el cliente<input value={draft.reason} onChange={(event) => field('reason', event.target.value)} placeholder="Solo pozole este día, precio único." /></label>
            {draft.kind === 'special_package' && (
              <>
                <div>
                  <label>Nombre del menú<input value={draft.packageName} onChange={(event) => field('packageName', event.target.value)} placeholder="Pozole" /></label>
                  <label>Precio único<input type="number" min="0" value={draft.packagePrice} onChange={(event) => field('packagePrice', event.target.value)} /></label>
                </div>
                <label>Incluye (separado por comas)<input value={draft.packageIncludesText} onChange={(event) => field('packageIncludesText', event.target.value)} placeholder="Crema, Tostadas, Verdura" /></label>
                <div className="special-day-image-picker">
                  {draft.image && <div className="special-day-image-picker__preview" style={{ backgroundImage: `url(${draft.image})` }} />}
                  <label className="image-upload-btn" htmlFor={fileInputId}>
                    {uploading ? <Loader2 size={12} className="spin" /> : <ImagePlus size={12} />} {uploading ? 'Subiendo…' : draft.image ? 'Cambiar foto' : 'Subir foto'}
                  </label>
                  <input id={fileInputId} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
                </div>
                <div className="special-day-addons-editor">
                  <span>Extras opcionales</span>
                  {draft.addons.map((addon, index) => (
                    <div key={index} className="special-day-addons-editor__row">
                      <input value={addon.name} onChange={(event) => updateAddon(index, { name: event.target.value })} placeholder="Agua de sabor" />
                      <input type="number" min="0" value={addon.price} onChange={(event) => updateAddon(index, { price: event.target.value })} placeholder="15" />
                      <button type="button" onClick={() => removeAddon(index)} aria-label="Quitar extra"><X size={13} /></button>
                    </div>
                  ))}
                  <button type="button" className="admin-secondary" onClick={addAddon}><Plus size={13} /> Agregar extra</button>
                </div>
              </>
            )}
            {localError && <span className="inline-error inline-error--tight">{localError}</span>}
          </div>
          <div className="editor-controls">
            <button className="admin-primary" disabled={saving} onClick={save} type="button">{saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Guardar</button>
            <button className="admin-secondary" onClick={cancel} type="button"><X size={14} /> Cancelar</button>
          </div>
        </>
      ) : specialDay ? (
        <>
          {specialDay.kind === 'special_package' && specialDay.image && (
            <div className="editor-photo" style={{ backgroundImage: `url(${specialDay.image})` }} />
          )}
          <div className="editor-fields product-view">
            <strong>{longDate(specialDay.date)}</strong>
            <p>{specialDay.kind === 'closed' ? (specialDay.reason || 'Cerrado, sin pedidos') : `${specialDay.packageName} · ${money(specialDay.packagePrice || 0)}`}</p>
            {specialDay.kind === 'special_package' && Boolean(specialDay.packageIncludes?.length) && (
              <div className="product-view__tags">{specialDay.packageIncludes!.map((item) => <span key={item}>{item}</span>)}</div>
            )}
            {localError && <span className="inline-error inline-error--tight">{localError}</span>}
          </div>
          <div className="editor-controls">
            <button className="edit-toggle" onClick={startEdit} type="button"><Pencil size={12} /> Editar</button>
            <button className="delete-meal" onClick={remove} disabled={deleting} type="button">{deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Eliminar</button>
          </div>
        </>
      ) : null}
    </article>
  )
}

function SpecialDaysPanel({ token }: { token: string }) {
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addingNew, setAddingNew] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAdminSpecialDays(token)
      .then(({ specialDays: list }) => setSpecialDays([...list].sort((a, b) => a.date.localeCompare(b.date))))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los días especiales'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSaved = (day: SpecialDay, wasNew: boolean) => {
    setSpecialDays((current) => {
      const next = wasNew ? [...current, day] : current.map((item) => item.date === day.date ? day : item)
      return next.sort((a, b) => a.date.localeCompare(b.date))
    })
    if (wasNew) setAddingNew(false)
  }

  const handleDeleted = (date: string) => setSpecialDays((current) => current.filter((item) => item.date !== date))

  return (
    <>
      <header className="admin-page-head">
        <div>
          <p>Días especiales</p>
          <h1>Feriados y menús especiales</h1>
          <span>Cierra un día por feriado, o crea un paquete de precio único fuera de los 3 paquetes estándar (como el menú de pozole).</span>
        </div>
        <div className="admin-head-actions">
          <button className="admin-primary" onClick={() => setAddingNew(true)} disabled={addingNew}><Plus size={14} /> Nuevo día especial</button>
        </div>
      </header>

      {error && <div className="inline-error">{error}</div>}

      {loading ? (
        <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando…</div>
      ) : (
        <div className="special-days-list">
          {addingNew && (
            <SpecialDayRow isNew token={token} onSaved={handleSaved} onDeleted={handleDeleted} onCancelNew={() => setAddingNew(false)} />
          )}
          {!addingNew && specialDays.length === 0 && (
            <div className="admin-empty"><PackageOpen size={26} /><strong>Sin días especiales</strong>Agrega un feriado o un menú de precio único cuando lo necesites.</div>
          )}
          {specialDays.map((day) => (
            <SpecialDayRow key={day.date} specialDay={day} token={token} onSaved={handleSaved} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </>
  )
}

function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [tab, setTab] = useState<'menu' | 'orders' | 'special'>('menu')
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
  useRipple()

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
        <Logo compact theme="white" />
        <div>
          <button className={tab === 'menu' ? 'selected' : ''} onClick={() => setTab('menu')}><ClipboardList size={15} /> Menús</button>
          <button className={tab === 'special' ? 'selected' : ''} onClick={() => setTab('special')}><CalendarOff size={15} /> Días especiales</button>
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

          <Reveal className="admin-stats" variant="up">
            <div className="admin-stat"><UtensilsCrossed size={20} /><span><b>{meals.length}</b>Platillos hoy</span></div>
            <div className="admin-stat admin-stat--accent"><CheckCircle2 size={20} /><span><b>{availableCount}</b>Disponibles</span></div>
            <div className="admin-stat"><PackageOpen size={20} /><span><b>{products.length}</b>En tu catálogo</span></div>
          </Reveal>

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
        </> : tab === 'special' ? <>
          <SpecialDaysPanel token={token} />
        </> : <>
          <header className="admin-page-head"><div><p>Foodie Pack · Operación</p><h1>Pedidos</h1><span>Aquí llegan los pedidos aceptados.</span></div></header>

          <Reveal className="admin-stats" variant="up">
            <div className="admin-stat"><ShoppingBag size={20} /><span><b>{orders.length}</b>Pedidos</span></div>
            <div className="admin-stat admin-stat--accent"><Receipt size={20} /><span><b>{money(totalRevenue)}</b>Ingresos</span></div>
          </Reveal>

          {error && <div className="inline-error">{error}</div>}
          {loading && <div className="admin-loading"><Loader2 size={22} className="spin" /> Cargando pedidos…</div>}
          <div className="orders-table">
            <div className="orders-table__head"><span>Pedido</span><span>Entrega</span><span>Cliente</span><span>Dirección</span><span>Paquete</span><span>Pago</span><span>Total</span><span>Estado</span><span>Acciones</span></div>
            {!loading && orders.map((order, index) => (
              <div className="orders-table__row" key={order.id} style={{ '--i': index } as CSSProperties}>
                <strong>{order.id}{order.isWeeklyPlan && <em className="plan-badge">Plan semanal</em>}</strong>
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
