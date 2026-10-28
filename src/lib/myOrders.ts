// Order ids placed from this device, so customers can follow their status without an account.
const KEY = 'foodiepack:my-orders'

export function getMyOrderIds(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as string[] } catch { return [] }
}

export function rememberOrder(id: string) {
  try {
    const ids = [id, ...getMyOrderIds().filter((item) => item !== id)].slice(0, 15)
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch { /* private mode */ }
}

export type TrackedOrder = {
  id: string
  status: 'pending' | 'accepted' | 'cancelled' | string
  createdAt: string
  deliveryDate: string
  isWeeklyPlan: boolean
  total: number
  paymentMethod: string
  items: Array<{ packageLabel: string; mealName?: string; quantity: number }>
}

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '')

export async function fetchMyOrders(extraId?: string): Promise<TrackedOrder[]> {
  const ids = [...new Set([...(extraId ? [extraId] : []), ...getMyOrderIds()])]
  if (!ids.length) return []
  const response = await fetch(`${API_URL}/orders/status?ids=${encodeURIComponent(ids.join(','))}`)
  if (!response.ok) throw new Error('No pudimos cargar tus pedidos')
  const { orders } = await response.json() as { orders: TrackedOrder[] }
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const STATUS_COPY: Record<string, { label: string; hint: string; tone: string }> = {
  pending: { label: 'Recibido', hint: 'La cocina lo está revisando', tone: 'pending' },
  accepted: { label: 'Aceptado', hint: 'Ya está en la producción del día', tone: 'accepted' },
  cancelled: { label: 'Cancelado', hint: 'Escríbenos si tienes dudas', tone: 'cancelled' },
}
