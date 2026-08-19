export type Meal = {
  id: string
  name: string
  description: string
  price: number
  protein: number
  kcal: number
  tags: string[]
  position: string
  available: boolean
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

export type CartItem = {
  meal: Meal
  quantity: number
  date: string
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
  customer: {
    name: string
    phone: string
    address?: string
    notes?: string
  }
  delivery?: DeliveryLocation
  items: Array<{
    mealId: string
    date: string
    quantity: number
    name: string
    unitPrice: number
  }>
  subtotal: number
  deliveryFee: number
  total: number
}
