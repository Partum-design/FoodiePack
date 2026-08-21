import type { Meal, MenuDay, MenuResponse, OrderPolicy, PaymentMethod, SavedOrder } from './types'

const configuredUrl = import.meta.env.VITE_API_URL as string | undefined
const API_URL = (configuredUrl || '/api').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'No se pudo conectar con FoodiePack')
    return data as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Revisa tu conexión e intenta de nuevo.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function getMenuDays() {
  return request<{ days: MenuDay[]; policy: OrderPolicy }>('/menu-days')
}

export function getMenu(date: string) {
  return request<MenuResponse>(`/menu?date=${encodeURIComponent(date)}`)
}

export function createOrder(payload: {
  customer: { name: string; phone: string; notes: string }
  delivery: {
    zone: 'Lindavista, CDMX'
    address: string
    office: string
    pinConfirmed: true
    coordinates?: { latitude: number; longitude: number }
  }
  paymentMethod: PaymentMethod
  isWeeklyPlan: boolean
  items: Array<{ mealId: string; date: string; quantity: number }>
}) {
  return request<{ order: SavedOrder }>('/orders', { method: 'POST', body: JSON.stringify(payload) })
}

export function adminLogin(password: string) {
  return request<{ token: string }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) })
}

function adminHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export function getAdminMenu(date: string, token: string) {
  return request<{ date: string; meals: Meal[] }>(`/admin/menu/${date}`, { headers: adminHeaders(token) })
}

export function saveAdminMenu(date: string, meals: Meal[], token: string) {
  return request<{ date: string; meals: Meal[] }>(`/admin/menu/${date}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify({ meals }),
  })
}

export function getAdminOrders(token: string) {
  return request<{ orders: SavedOrder[] }>('/admin/orders', { headers: adminHeaders(token) })
}
