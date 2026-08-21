import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addDays, orderPolicy } from './time.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.join(root, 'data')
const databasePath = path.join(dataDirectory, 'runtime.json')

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

function ensureDatabase() {
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
  writeDatabase(database)
  return database
}

export function readDatabase() {
  return ensureDatabase()
}

export function writeDatabase(database) {
  fs.mkdirSync(dataDirectory, { recursive: true })
  const temporaryPath = `${databasePath}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(database, null, 2))
  fs.renameSync(temporaryPath, databasePath)
}
