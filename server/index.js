import 'dotenv/config'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import {
  ORDER_STATUSES, createProduct, deleteOrder, deleteProduct, getMenu, getMenus, getOrders,
  getProducts, saveMenu, saveOrder, storageMode, updateOrderStatus, updateProduct, uploadProductImage,
} from './store.js'
import {
  FREE_DELIVERY_RADIUS_KM, KITCHEN_LOCATION, evaluateDeliveryPoint, resolveDeliveryLocation,
} from './delivery.js'
import { addDays, orderPolicy } from './time.js'
import { PACKAGES, REPEAT_GUISADO_SURCHARGE, REPEAT_GUISADO_TIER, WEEKLY_PLAN_DAYS } from './packages.js'

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
  paymentMethod: z.enum(['card', 'cash', 'transfer']),
  orderMode: z.enum(['day', 'week']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  packageTier: z.enum(['economico', 'ejecutivo', 'completo']),
  quantity: z.number().int().min(1).max(10),
  repeatGuisado: z.boolean().optional().default(false),
  prepay: z.boolean().optional().default(false),
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
})
const deliveryCheckSchema = z.object({
  address: z.string().trim().max(180).optional().default(''),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
})
const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) })
const uploadSchema = z.object({
  fileBase64: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})
const MAX_UPLOAD_BYTES = 3_500_000

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
  response.json({
    ok: true,
    service: 'foodiepack-api',
    storage: storageMode(),
    policy: orderPolicy(),
    delivery: { zone: deliveryZone, radiusKm: FREE_DELIVERY_RADIUS_KM, kitchen: KITCHEN_LOCATION },
  })
})

app.get('/api/menu', async (request, response) => {
  const policy = orderPolicy()
  const date = typeof request.query.date === 'string' ? request.query.date : policy.tomorrow
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return response.status(400).json({ error: 'Fecha inválida' })

  const eligibleDates = Array.from({ length: WEEKLY_PLAN_DAYS }, (_, index) => addDays(policy.tomorrow, index))
  const meals = await getMenu(date)
  response.json({
    date,
    meals,
    canOrder: eligibleDates.includes(date) && policy.isOpen,
    policy,
  })
})

app.get('/api/menu-days', async (_request, response) => {
  const policy = orderPolicy()
  const dates = Array.from({ length: WEEKLY_PLAN_DAYS }, (_, index) => addDays(policy.today, index + 1))
  const menus = await getMenus()
  const days = dates.map((date) => {
    return { date, mealCount: (menus[date] || []).filter((meal) => meal.available).length }
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

  const eligibleDates = Array.from({ length: WEEKLY_PLAN_DAYS }, (_, index) => addDays(policy.tomorrow, index))
  if (!eligibleDates.includes(parsed.data.date)) {
    return response.status(409).json({ error: 'Solo puedes reservar dentro de los próximos 5 días disponibles.', policy })
  }

  const location = await resolveDeliveryLocation({
    address: parsed.data.delivery.address,
    coordinates: parsed.data.delivery.coordinates,
  })
  if (location && !location.withinRadius) {
    return response.status(409).json({
      error: `Tu dirección está a ${location.distanceKm.toFixed(1)} km de la cocina y entregamos dentro de ${FREE_DELIVERY_RADIUS_KM} km a la redonda. Escríbenos por WhatsApp para revisar tu caso.`,
      delivery: location,
    })
  }

  const { orderMode, packageTier, quantity, repeatGuisado, prepay } = parsed.data
  const pack = PACKAGES[packageTier]
  const canRepeatGuisado = orderMode === 'day' && packageTier === REPEAT_GUISADO_TIER && repeatGuisado

  let subtotal
  let discountAmount = 0
  if (orderMode === 'week') {
    subtotal = pack.weeklyRegular * quantity
    discountAmount = prepay ? (pack.weeklyRegular - pack.weeklyPrepay) * quantity : 0
  } else {
    subtotal = pack.dailyPrice * quantity + (canRepeatGuisado ? REPEAT_GUISADO_SURCHARGE * quantity : 0)
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
      mapUrl: googleMapsUrl({ ...parsed.data.delivery, coordinates: parsed.data.delivery.coordinates || location?.coordinates }),
      ...(parsed.data.delivery.coordinates || location?.coordinates
        ? { coordinates: parsed.data.delivery.coordinates || location.coordinates }
        : {}),
      radiusKm: FREE_DELIVERY_RADIUS_KM,
      ...(location
        ? { distanceKm: location.distanceKm, withinRadius: location.withinRadius, locationSource: location.source }
        : { distanceKm: null, withinRadius: null, locationSource: 'unverified' }),
    },
    items: [{
      packageTier,
      packageLabel: pack.label,
      quantity,
      unitPrice: orderMode === 'week' ? (prepay ? pack.weeklyPrepay : pack.weeklyRegular) : pack.dailyPrice,
      repeatGuisado: canRepeatGuisado,
      prepay: orderMode === 'week' && prepay,
    }],
    subtotal,
    deliveryFee: 0,
    discountRate,
    discountAmount,
    total,
    distanceKm: location ? location.distanceKm : null,
  }
  await saveOrder(order)
  response.status(201).json({ order })
})

const deliveryCheckAttempts = new Map()

app.post('/api/delivery/check', async (request, response) => {
  const ip = request.ip
  const attempt = deliveryCheckAttempts.get(ip) || { count: 0, resetAt: Date.now() + 60_000 }
  if (Date.now() > attempt.resetAt) {
    attempt.count = 0
    attempt.resetAt = Date.now() + 60_000
  }
  attempt.count += 1
  deliveryCheckAttempts.set(ip, attempt)
  if (attempt.count > 30) return response.status(429).json({ error: 'Demasiadas consultas seguidas. Espera un minuto.' })

  const parsed = deliveryCheckSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Revisa la dirección' })

  const fromPin = evaluateDeliveryPoint(parsed.data.coordinates)
  const location = fromPin
    ? { ...fromPin, source: 'pin', label: '' }
    : await resolveDeliveryLocation({ address: parsed.data.address })

  if (!location) {
    return response.json({
      resolved: false,
      radiusKm: FREE_DELIVERY_RADIUS_KM,
      kitchen: KITCHEN_LOCATION,
    })
  }

  response.json({
    resolved: true,
    radiusKm: FREE_DELIVERY_RADIUS_KM,
    kitchen: KITCHEN_LOCATION,
    coordinates: location.coordinates,
    distanceKm: location.distanceKm,
    withinRadius: location.withinRadius,
    source: location.source,
    label: location.label,
  })
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

app.get('/api/admin/orders', requireAdmin, async (_request, response) => {
  const orders = await getOrders()
  response.json({ orders })
})

app.patch('/api/admin/orders/:id', requireAdmin, async (request, response) => {
  const parsed = orderStatusSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Estado no válido' })
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
