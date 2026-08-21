import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { addDays, orderPolicy } from './time.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.join(root, 'data')
const databasePath = path.join(dataDirectory, 'runtime.json')
const menuTable = 'menu_days'
const orderTable = 'orders'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null

if (process.env.NODE_ENV === 'production' && !supabase) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production')
}

export const mealImages = [
  '/assets/meals/pollo-citrico.jpg',
  '/assets/meals/pasta-poblano.jpg',
  '/assets/meals/res-chipotle.jpg',
  '/assets/meals/salmon-verde.jpg',
  '/assets/meals/bowl-huerto.jpg',
]

export const mealTemplates = [
  {
    id: 'pollo-citrico',
    name: 'Pollo cítrico al grill',
    description: 'Quinoa, camote rostizado y vegetales de temporada.',
    price: 139,
    protein: 38,
    kcal: 540,
    tags: ['Sin gluten'],
    image: mealImages[0],
    available: true,
  },
  {
    id: 'pasta-poblano',
    name: 'Pasta cremosa poblano',
    description: 'Rigatoni, espinaca, queso fresco y cilantro.',
    price: 125,
    protein: 24,
    kcal: 610,
    tags: ['Vegetariano'],
    image: mealImages[1],
    available: true,
  },
  {
    id: 'res-chipotle',
    name: 'Bowl de res chipotle',
    description: 'Arroz integral, frijol negro, aguacate y pico de gallo.',
    price: 149,
    protein: 41,
    kcal: 650,
    tags: ['Alto en proteína'],
    image: mealImages[2],
    available: true,
  },
  {
    id: 'salmon-verde',
    name: 'Salmón, limón y hierbas',
    description: 'Salmón al grill con brócoli, ejotes y calabaza.',
    price: 169,
    protein: 36,
    kcal: 490,
    tags: ['Sin gluten'],
    image: mealImages[3],
    available: true,
  },
  {
    id: 'bowl-huerto',
    name: 'Bowl del huerto',
    description: 'Quinoa, aguacate, kale, pepita y col morada.',
    price: 129,
    protein: 22,
    kcal: 510,
    tags: ['Vegano'],
    image: mealImages[4],
    available: true,
  },
]

function seedMenus(database) {
  const { today } = orderPolicy()
  for (let offset = 1; offset <= 10; offset += 1) {
    const date = addDays(today, offset)
    if (!database.menus[date]) {
      database.menus[date] = Array.from({ length: 3 }, (_, index) => {
        const template = mealTemplates[(offset + index) % mealTemplates.length]
        return { ...template }
      })
    }
  }
  return database
}

function ensureLocalDatabase() {
  fs.mkdirSync(dataDirectory, { recursive: true })
  let database = { menus: {}, orders: [] }

  if (fs.existsSync(databasePath)) {
    try {
      database = JSON.parse(fs.readFileSync(databasePath, 'utf8'))
    } catch {
      database = { menus: {}, orders: [] }
    }
  }

  database.menus ||= {}
  database.orders ||= []
  seedMenus(database)
  writeLocalDatabase(database)
  return database
}

function writeLocalDatabase(database) {
  fs.mkdirSync(dataDirectory, { recursive: true })
  const temporaryPath = `${databasePath}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(database, null, 2))
  fs.renameSync(temporaryPath, databasePath)
}

function throwIfSupabaseError(operation, error) {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`)
}

function orderFromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    deliveryDate: row.delivery_date,
    status: row.status,
    paymentMethod: row.payment_method,
    isWeeklyPlan: row.is_weekly_plan,
    customer: row.customer,
    delivery: row.delivery,
    items: row.items,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    discountRate: Number(row.discount_rate),
    discountAmount: row.discount_amount,
    total: row.total,
  }
}

async function getSupabaseMenus() {
  const { data: rows, error } = await supabase
    .from(menuTable)
    .select('menu_date, meals')
    .order('menu_date', { ascending: true })
  throwIfSupabaseError('menu lookup', error)

  const menus = Object.fromEntries((rows || []).map((row) => [row.menu_date, row.meals || []]))
  const { today } = orderPolicy()
  const missingRows = []

  for (let offset = 1; offset <= 10; offset += 1) {
    const date = addDays(today, offset)
    if (!menus[date]) {
      const meals = Array.from({ length: 3 }, (_, index) => {
        const template = mealTemplates[(offset + index) % mealTemplates.length]
        return { ...template }
      })
      menus[date] = meals
      missingRows.push({ menu_date: date, meals })
    }
  }

  if (missingRows.length > 0) {
    const { error: seedError } = await supabase
      .from(menuTable)
      .upsert(missingRows, { onConflict: 'menu_date', ignoreDuplicates: true })
    throwIfSupabaseError('menu seed', seedError)
  }

  return menus
}

export function storageMode() {
  return supabase ? 'supabase' : 'local'
}

export async function getMenus() {
  if (!supabase) return ensureLocalDatabase().menus
  return getSupabaseMenus()
}

export async function getMenu(date) {
  const menus = await getMenus()
  return menus[date] || []
}

export async function saveMenu(date, meals) {
  if (!supabase) {
    const database = ensureLocalDatabase()
    database.menus[date] = meals
    writeLocalDatabase(database)
    return meals
  }

  const { error } = await supabase
    .from(menuTable)
    .upsert({ menu_date: date, meals, updated_at: new Date().toISOString() }, { onConflict: 'menu_date' })
  throwIfSupabaseError('menu save', error)
  return meals
}

export async function saveOrder(order) {
  if (!supabase) {
    const database = ensureLocalDatabase()
    database.orders.unshift(order)
    writeLocalDatabase(database)
    return order
  }

  const { error } = await supabase.from(orderTable).insert({
    id: order.id,
    created_at: order.createdAt,
    delivery_date: order.deliveryDate,
    status: order.status,
    payment_method: order.paymentMethod,
    is_weekly_plan: order.isWeeklyPlan,
    customer: order.customer,
    delivery: order.delivery,
    items: order.items,
    subtotal: order.subtotal,
    delivery_fee: order.deliveryFee,
    discount_rate: order.discountRate,
    discount_amount: order.discountAmount,
    total: order.total,
  })
  throwIfSupabaseError('order save', error)
  return order
}

export async function getOrders(limit = 200) {
  if (!supabase) return ensureLocalDatabase().orders.slice(0, limit)

  const { data: rows, error } = await supabase
    .from(orderTable)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwIfSupabaseError('order lookup', error)
  return (rows || []).map(orderFromRow)
}
