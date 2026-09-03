import type { PackageTier } from './packages'

export type PaymentMethod = 'card' | 'cash' | 'transfer'

export type Meal = {
  id: string
  name: string
  description: string
  price: number
  protein: number
  kcal: number
  tags: string[]
  image: string
  available: boolean
  packages: PackageTier[]
}

export type OrderPolicy = {
  timeZone: string
  today: string
  tomorrow: string
  isOpen: boolean
  opensAt: string
  closesAt: string
  currentTime: string
}

export type MenuResponse = {
  date: string
  meals: Meal[]
  canOrder: boolean
  policy: OrderPolicy
}

export type MenuDay = {
  date: string
  mealCount: number
}

export type PackageOrderInput = {
  orderMode: 'day' | 'week'
  date: string
  packageTier: PackageTier
  quantity: number
  repeatGuisado: boolean
  prepay: boolean
}

export type DeliveryLocation = {
  zone: 'Lindavista, CDMX'
  address: string
  office: string
  mapUrl: string
  coordinates?: {
    latitude: number
    longitude: number
  }
}

export type SavedOrder = {
  id: string
  createdAt: string
  deliveryDate: string
  status: string
  paymentMethod: PaymentMethod
  isWeeklyPlan: boolean
  customer: {
    name: string
    phone: string
    address?: string
    notes?: string
  }
  delivery?: DeliveryLocation
  items: Array<{
    packageTier: PackageTier
    packageLabel: string
    quantity: number
    unitPrice: number
    repeatGuisado: boolean
    prepay: boolean
    promo2x1?: boolean
    mealId?: string
    mealName?: string
    menuDate?: string
  }>
  subtotal: number
  deliveryFee: number
  discountRate: number
  discountAmount: number
  total: number
}
