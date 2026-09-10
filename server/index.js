import 'dotenv/config'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import {
  createProduct, deleteOrder, deleteProduct, deleteSpecialDay, getMenu, getMenus, getOrders, getProducts,
  getSpecialDays, saveMenu, saveOrder, saveSpecialDay, storageMode, updateOrderStatus, updateProduct,
  uploadProductImage,
} from './store.js'
import { addBusinessDays, MIN_ORDER_DATE, orderPolicy } from './time.js'
import {
  GARNISH_OPTIONS, PACKAGES, PACKAGE_ORDER, REPEAT_GUISADO_SURCHARGE, REPEAT_GUISADO_TIER, WEEKLY_PLAN_DAYS,
} from './packages.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const isProduction = process.env.NODE_ENV === 'production'
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'foodiepack-local')
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'local-secret-change-before-deploying')
const configuredOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
const deployedOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((origin) => origin.startsWith('http') ? origin : `https://${origin}`)
const allowedOrigins = [...new Set([...configuredOrigins, ...deployedOrigins])]
const deliveryZone = 'Lindavista, CDMX'

if (!adminPassword || !jwtSecret) {
  throw new Error('ADMIN_PASSWORD and JWT_SECRET are required in production')
}

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopmentOrigin = !isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '')
    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) return callback(null, true)
    return callback(new Error('Origin not allowed'))
  },
}))
app.use(express.json({ limit: '4mb' }))

const loginAttempts = new Map()
const loginSchema = z.object({ password: z.string().min(8).max(200) })
const packagesSchema = z.array(z.enum(PACKAGE_ORDER)).length(3).refine((packages) => new Set(packages).size === 3)
const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(24),
  notes: z.string().trim().max(300).optional().default(''),
})
const deliverySchema = z.object({
  zone: z.literal(deliveryZone),
  address: z.string().trim().min(8).max(180),
  office: z.string().trim().min(2).max(100),
  pinConfirmed: z.literal(true),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
})
const orderSchema = z.object({
  customer: customerSchema,
  delivery: deliverySchema,
  paymentMethod: z.enum(['cash', 'transfer', 'terminal']),
  orderMode: z.enum(['day', 'week']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  packageTier: z.enum(['economico', 'ejecutivo', 'completo']).optional(),
  quantity: z.number().int().min(1).max(10),
  repeatGuisado: z.boolean().optional().default(false),
  prepay: z.boolean().optional().default(false),
  promo2x1: z.boolean().optional().default(false),
  garnish: z.enum(GARNISH_OPTIONS).optional(),
  mealId: z.string().trim().min(1).max(100).optional(),
  specialAddons: z.array(z.string().trim().min(1).max(60)).max(5).optional().default([]),
}).superRefine((data, context) => {
  if (data.prepay && data.paymentMethod !== 'transfer') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['prepay'], message: 'El precio de adelanto requiere transferencia.' })
  }
  // A special-package day (see below) needs neither mealId nor packageTier, so that
  // check is deferred to the route handler once the day's special config is known.
})
const mealSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(3).max(240),
  price: z.number().int().min(1).max(5000),
  protein: z.number().int().min(0).max(300),
  kcal: z.number().int().min(0).max(3000),
  tags: z.array(z.string().trim().min(1).max(40)).max(4),
  image: z.string().min(1).max(300).default('/assets/meals/pollo-citrico.jpg'),
  available: z.boolean(),
  packages: packagesSchema.default([...PACKAGE_ORDER]),
})
const menuSchema = z.object({ meals: z.array(mealSchema).max(20) })
const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(3).max(240),
  price: z.number().int().min(1).max(5000),
  protein: z.number().int().min(0).max(300),
  kcal: z.number().int().min(0).max(3000),
  tags: z.array(z.string().trim().min(1).max(40)).max(4),
  image: z.string().min(1).max(300).default('/assets/meals/pollo-citrico.jpg'),
  available: z.boolean().default(true),
  packages: packagesSchema.default([...PACKAGE_ORDER]),
})
const orderStatusSchema = z.object({ status: z.enum(['accepted', 'cancelled']) })
const uploadSchema = z.object({
  fileBase64: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})
const MAX_UPLOAD_BYTES = 3_500_000
const specialDayAddonSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z.number().int().min(0).max(2000),
})
const specialDaySchema = z.object({
  kind: z.enum(['closed', 'special_package']),
  label: z.string().trim().min(2).max(80),
  reason: z.string().trim().max(240).optional().default(''),
  packageName: z.string().trim().min(2).max(80).optional(),
  packagePrice: z.number().int().min(0).max(5000).optional(),
  packageIncludes: z.array(z.string().trim().min(1).max(80)).max(10).optional().default([]),
  addons: z.array(specialDayAddonSchema).max(5).optional().default([]),
}).superRefine((data, context) => {
  if (data.kind === 'special_package') {
    if (!data.packageName) context.addIssue({ code: z.ZodIssueCode.custom, path: ['packageName'], message: 'Escribe el nombre del menú especial.' })
    if (data.packagePrice === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['packagePrice'], message: 'Escribe el precio único del menú especial.' })
  }
})

// Skips weekends (isBusinessDay via addBusinessDays) and any date marked 'closed' in
// special_menu_days, sliding the window forward so a holiday never shrinks the number
// of orderable days a customer sees.
async function eligibleOrderDates(today, count) {
  const specialDays = await getSpecialDays()
  const dates = []
  let cursor = today
  let guard = 0
  while (dates.length < count && guard < 60) {
    cursor = addBusinessDays(cursor, 1)
    guard += 1
    if (cursor < MIN_ORDER_DATE) continue
    if (specialDays[cursor]?.kind === 'closed') continue
    dates.push(cursor)
  }
  return { dates, specialDays }
}

function googleMapsUrl(delivery) {
  const query = delivery.coordinates
    ? `${delivery.coordinates.latitude},${delivery.coordinates.longitude}`
    : `${delivery.address}, Lindavista, Gustavo A. Madero, Ciudad de México`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function safePasswordMatch(candidate) {
  const expected = Buffer.from(adminPassword)
  const received = Buffer.from(candidate)
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return response.status(401).json({ error: 'Acceso requerido' })

  try {
    request.admin = jwt.verify(token, jwtSecret)
    return next()
  } catch {
    return response.status(401).json({ error: 'La sesión venció' })
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'foodiepack-api', storage: storageMode(), policy: orderPolicy() })
})

app.get('/api/menu', async (request, response) => {
  const policy = orderPolicy()
  const date = typeof request.query.date === 'string' ? request.query.date : policy.tomorrow
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return response.status(400).json({ error: 'Fecha inválida' })

  const { dates: eligibleDates, specialDays } = await eligibleOrderDates(policy.today, WEEKLY_PLAN_DAYS)
  const specialDay = specialDays[date] || null
  const meals = specialDay ? [] : await getMenu(date)
  response.json({
    date,
    meals,
    canOrder: eligibleDates.includes(date) && policy.isOpen,
    policy,
    specialDay,
  })
})

app.get('/api/menu-days', async (_request, response) => {
  const policy = orderPolicy()
  const { dates, specialDays } = await eligibleOrderDates(policy.today, WEEKLY_PLAN_DAYS)
  const menus = await getMenus()
  const days = dates.map((date) => {
    const specialDay = specialDays[date] || null
    return {
      date,
      mealCount: specialDay ? 1 : (menus[date] || []).filter((meal) => meal.available).length,
      specialDay,
    }
  })
  response.json({ days, policy })
})

app.post('/api/orders', async (request, response) => {
  const parsed = orderSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Revisa los datos del pedido' })

  const policy = orderPolicy()
  if (!policy.isOpen) {
    return response.status(409).json({
      error: 'Los pedidos para mañana se reciben de 8:00 a 18:00, hora de Ciudad de México.',
      policy,
    })
  }

  const { dates: eligibleDates, specialDays } = await eligibleOrderDates(policy.today, WEEKLY_PLAN_DAYS)
  const { orderMode, packageTier, quantity, repeatGuisado, prepay, promo2x1, garnish, specialAddons } = parsed.data
  const specialDay = orderMode === 'day' ? specialDays[parsed.data.date] : null

  if (specialDay?.kind === 'closed') {
    return response.status(409).json({ error: specialDay.reason || 'No se reciben pedidos para este día.', policy })
  }
  if (!eligibleDates.includes(parsed.data.date)) {
    return response.status(409).json({ error: 'Solo puedes reservar dentro de los próximos 5 días disponibles.', policy })
  }

  let selectedMeal = null
  let pack = null
  let packageLabel
  let unitPrice
  let subtotal
  let discountAmount = 0
  let canRepeatGuisado = false
  let appliedPromo2x1 = false
  let chosenGarnish = null
  let chosenAddons = []

  if (specialDay?.kind === 'special_package') {
    chosenAddons = (specialDay.addons || []).filter((addon) => specialAddons.includes(addon.name))
    unitPrice = specialDay.packagePrice + chosenAddons.reduce((sum, addon) => sum + addon.price, 0)
    packageLabel = specialDay.packageName
    subtotal = unitPrice * quantity
  } else {
    if (!packageTier) return response.status(400).json({ error: 'Elige uno de los 3 paquetes.', policy })
    pack = PACKAGES[packageTier]
    packageLabel = pack.label
    if (orderMode === 'day') {
      const menu = await getMenu(parsed.data.date)
      selectedMeal = menu.find((meal) => meal.id === parsed.data.mealId) || null
      if (!selectedMeal) return response.status(409).json({ error: 'Selecciona un guisado disponible para ese día.', policy })
      if (!selectedMeal.available) return response.status(409).json({ error: 'Ese guisado ya no está disponible.', policy })
      if (!selectedMeal.packages?.includes(packageTier)) {
        return response.status(409).json({ error: 'Ese guisado no tiene disponible el paquete seleccionado.', policy })
      }
    }
    canRepeatGuisado = orderMode === 'day' && packageTier === REPEAT_GUISADO_TIER && repeatGuisado
    appliedPromo2x1 = orderMode === 'day' && promo2x1
    chosenGarnish = garnish || 'arroz'

    if (orderMode === 'week') {
      subtotal = pack.weeklyRegular * quantity
      discountAmount = prepay ? (pack.weeklyRegular - pack.weeklyPrepay) * quantity : 0
      unitPrice = prepay ? pack.weeklyPrepay : pack.weeklyRegular
    } else {
      const surcharge = canRepeatGuisado ? REPEAT_GUISADO_SURCHARGE * quantity : 0
      subtotal = pack.dailyPrice * quantity + surcharge
      const paidQuantity = appliedPromo2x1 ? Math.ceil(quantity / 2) : quantity
      discountAmount = appliedPromo2x1 ? pack.dailyPrice * (quantity - paidQuantity) : 0
      unitPrice = pack.dailyPrice
    }
  }
  const discountRate = subtotal > 0 ? Number((discountAmount / subtotal).toFixed(4)) : 0
  const total = subtotal - discountAmount

  const order = {
    id: `FP-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    deliveryDate: orderMode === 'week' ? policy.tomorrow : parsed.data.date,
    status: 'accepted',
    paymentMethod: parsed.data.paymentMethod,
    isWeeklyPlan: orderMode === 'week',
    customer: parsed.data.customer,
    delivery: {
      zone: deliveryZone,
      address: parsed.data.delivery.address,
      office: parsed.data.delivery.office,
      mapUrl: googleMapsUrl(parsed.data.delivery),
      ...(parsed.data.delivery.coordinates ? { coordinates: parsed.data.delivery.coordinates } : {}),
    },
    items: [{
      packageTier: specialDay?.kind === 'special_package' ? 'especial' : packageTier,
      packageLabel,
      quantity,
      unitPrice,
      repeatGuisado: canRepeatGuisado,
      prepay: orderMode === 'week' && prepay,
      promo2x1: appliedPromo2x1,
      ...(chosenGarnish ? { garnish: chosenGarnish } : {}),
      ...(selectedMeal ? { mealId: selectedMeal.id, mealName: selectedMeal.name, menuDate: parsed.data.date } : {}),
      ...(chosenAddons.length > 0 ? { specialAddons: chosenAddons.map((addon) => addon.name) } : {}),
    }],
    subtotal,
    deliveryFee: 0,
    discountRate,
    discountAmount,
    total,
  }
  await saveOrder(order)
  response.status(201).json({ order })
})

app.post('/api/admin/login', (request, response) => {
  const ip = request.ip
  const attempt = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 15 * 60_000 }
  if (Date.now() > attempt.resetAt) {
    attempt.count = 0
    attempt.resetAt = Date.now() + 15 * 60_000
  }
  if (attempt.count >= 8) return response.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' })

  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success || !safePasswordMatch(parsed.data.password)) {
    attempt.count += 1
    loginAttempts.set(ip, attempt)
    return response.status(401).json({ error: 'Contraseña incorrecta' })
  }

  loginAttempts.delete(ip)
  const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '8h', issuer: 'foodiepack-api' })
  response.json({ token })
})

app.get('/api/admin/menu/:date', requireAdmin, async (request, response) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) return response.status(400).json({ error: 'Fecha inválida' })
  const meals = await getMenu(request.params.date)
  response.json({ date: request.params.date, meals })
})

app.put('/api/admin/menu/:date', requireAdmin, async (request, response) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) return response.status(400).json({ error: 'Fecha inválida' })
  const parsed = menuSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'El menú contiene datos inválidos' })
  const meals = await saveMenu(request.params.date, parsed.data.meals)
  response.json({ date: request.params.date, meals })
})

app.get('/api/admin/special-days', requireAdmin, async (_request, response) => {
  const specialDays = await getSpecialDays()
  response.json({ specialDays: Object.values(specialDays) })
})

app.put('/api/admin/special-days/:date', requireAdmin, async (request, response) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) return response.status(400).json({ error: 'Fecha inválida' })
  const parsed = specialDaySchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Revisa los datos del día especial' })
  const specialDay = await saveSpecialDay(request.params.date, parsed.data)
  response.json({ specialDay })
})

app.delete('/api/admin/special-days/:date', requireAdmin, async (request, response) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) return response.status(400).json({ error: 'Fecha inválida' })
  const removed = await deleteSpecialDay(request.params.date)
  if (!removed) return response.status(404).json({ error: 'Día especial no encontrado' })
  response.status(204).end()
})

app.get('/api/admin/orders', requireAdmin, async (_request, response) => {
  const orders = await getOrders()
  response.json({ orders })
})

app.patch('/api/admin/orders/:id', requireAdmin, async (request, response) => {
  const parsed = orderStatusSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Estado de pedido inválido' })
  const order = await updateOrderStatus(request.params.id, parsed.data.status)
  if (!order) return response.status(404).json({ error: 'Pedido no encontrado' })
  response.json({ order })
})

app.delete('/api/admin/orders/:id', requireAdmin, async (request, response) => {
  const removed = await deleteOrder(request.params.id)
  if (!removed) return response.status(404).json({ error: 'Pedido no encontrado' })
  response.status(204).end()
})

app.get('/api/admin/products', requireAdmin, async (_request, response) => {
  const products = await getProducts()
  response.json({ products })
})

app.post('/api/admin/products', requireAdmin, async (request, response) => {
  const parsed = productSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Revisa los datos del producto' })
  const id = `producto-${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`
  const product = await createProduct({ id, ...parsed.data })
  response.status(201).json({ product })
})

app.put('/api/admin/products/:id', requireAdmin, async (request, response) => {
  const parsed = productSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Revisa los datos del producto' })
  const product = await updateProduct(request.params.id, parsed.data)
  if (!product) return response.status(404).json({ error: 'Producto no encontrado' })
  response.json({ product })
})

app.delete('/api/admin/products/:id', requireAdmin, async (request, response) => {
  const removed = await deleteProduct(request.params.id)
  if (!removed) return response.status(404).json({ error: 'Producto no encontrado' })
  response.status(204).end()
})

app.post('/api/admin/uploads', requireAdmin, async (request, response) => {
  const parsed = uploadSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Imagen inválida' })

  const buffer = Buffer.from(parsed.data.fileBase64, 'base64')
  if (buffer.byteLength > MAX_UPLOAD_BYTES) return response.status(413).json({ error: 'La imagen es muy pesada' })

  const extension = parsed.data.contentType.split('/')[1]
  const fileName = `product-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}.${extension}`
  const url = await uploadProductImage(buffer, fileName, parsed.data.contentType)
  response.status(201).json({ url })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'El servidor no pudo completar la operación' })
})

const isDirectExecution = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectExecution) {
  app.listen(port, () => {
    console.log(`FoodiePack API listening on http://localhost:${port}`)
    if (!isProduction && process.env.ADMIN_PASSWORD === undefined) {
      console.log('Local admin password: foodiepack-local')
    }
  })
}

export default app
