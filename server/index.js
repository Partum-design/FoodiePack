import 'dotenv/config'
import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { readDatabase, writeDatabase } from './store.js'
import { addDays, orderPolicy } from './time.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const isProduction = process.env.NODE_ENV === 'production'
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'foodiepack-local')
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'local-secret-change-before-deploying')
const allowedOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())

if (!adminPassword || !jwtSecret) {
  throw new Error('ADMIN_PASSWORD and JWT_SECRET are required in production')
}

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Origin not allowed'))
  },
}))
app.use(express.json({ limit: '64kb' }))

const loginAttempts = new Map()
const loginSchema = z.object({ password: z.string().min(8).max(200) })
const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(24),
  address: z.string().trim().min(8).max(180),
  notes: z.string().trim().max(300).optional().default(''),
})
const orderSchema = z.object({
  customer: customerSchema,
  items: z.array(z.object({
    mealId: z.string().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(20),
})
const mealSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(3).max(240),
  price: z.number().int().min(1).max(5000),
  protein: z.number().int().min(0).max(300),
  kcal: z.number().int().min(0).max(3000),
  tags: z.array(z.string().trim().min(1).max(40)).max(4),
  position: z.string().max(30).default('50% 50%'),
  available: z.boolean(),
})
const menuSchema = z.object({ meals: z.array(mealSchema).max(20) })

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
  response.json({ ok: true, service: 'foodiepack-api', policy: orderPolicy() })
})

app.get('/api/menu', (request, response) => {
  const policy = orderPolicy()
  const date = typeof request.query.date === 'string' ? request.query.date : policy.tomorrow
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return response.status(400).json({ error: 'Fecha inválida' })

  const database = readDatabase()
  response.json({
    date,
    meals: database.menus[date] || [],
    canOrder: date === policy.tomorrow && policy.isOpen,
    policy,
  })
})

app.get('/api/menu-days', (_request, response) => {
  const policy = orderPolicy()
  const database = readDatabase()
  const days = Array.from({ length: 5 }, (_, index) => {
    const date = addDays(policy.today, index + 1)
    return { date, mealCount: (database.menus[date] || []).filter((meal) => meal.available).length }
  })
  response.json({ days, policy })
})

app.post('/api/orders', (request, response) => {
  const parsed = orderSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Revisa los datos del pedido' })

  const policy = orderPolicy()
  if (!policy.isOpen) {
    return response.status(409).json({
      error: 'Los pedidos para mañana se reciben de 8:00 a 18:00, hora de Ciudad de México.',
      policy,
    })
  }

  if (parsed.data.items.some((item) => item.date !== policy.tomorrow)) {
    return response.status(409).json({ error: 'Hoy solo puedes reservar comida para mañana.', policy })
  }

  const database = readDatabase()
  const menu = database.menus[policy.tomorrow] || []
  let subtotal = 0
  const items = []

  for (const requestedItem of parsed.data.items) {
    const meal = menu.find((candidate) => candidate.id === requestedItem.mealId && candidate.available)
    if (!meal) return response.status(409).json({ error: 'Uno de los platillos ya no está disponible.' })
    subtotal += meal.price * requestedItem.quantity
    items.push({ ...requestedItem, name: meal.name, unitPrice: meal.price })
  }

  const deliveryFee = 29
  const order = {
    id: `FP-${Date.now().toString().slice(-7)}`,
    createdAt: new Date().toISOString(),
    deliveryDate: policy.tomorrow,
    status: 'confirmed',
    customer: parsed.data.customer,
    items,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
  }
  database.orders.unshift(order)
  writeDatabase(database)
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

app.get('/api/admin/menu/:date', requireAdmin, (request, response) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) return response.status(400).json({ error: 'Fecha inválida' })
  const database = readDatabase()
  response.json({ date: request.params.date, meals: database.menus[request.params.date] || [] })
})

app.put('/api/admin/menu/:date', requireAdmin, (request, response) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) return response.status(400).json({ error: 'Fecha inválida' })
  const parsed = menuSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'El menú contiene datos inválidos' })
  const database = readDatabase()
  database.menus[request.params.date] = parsed.data.meals
  writeDatabase(database)
  response.json({ date: request.params.date, meals: database.menus[request.params.date] })
})

app.get('/api/admin/orders', requireAdmin, (_request, response) => {
  const database = readDatabase()
  response.json({ orders: database.orders.slice(0, 200) })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'El servidor no pudo completar la operación' })
})

app.listen(port, () => {
  console.log(`FoodiePack API listening on http://localhost:${port}`)
  if (!isProduction && process.env.ADMIN_PASSWORD === undefined) {
    console.log('Local admin password: foodiepack-local')
  }
})
