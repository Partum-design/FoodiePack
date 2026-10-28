import webpush from 'web-push'
import {
  deletePushSubscription, getMenu, getOrderIdsForDate, getPushSubscriptions, getSpecialDays, logBroadcast,
} from './store.js'
import { orderPolicy } from './time.js'

const publicKey = process.env.VAPID_PUBLIC_KEY || ''
const privateKey = process.env.VAPID_PRIVATE_KEY || ''
const subject = process.env.VAPID_SUBJECT || 'mailto:hola@foodiepack.com.mx'

export const pushEnabled = Boolean(publicKey && privateKey)
if (pushEnabled) webpush.setVapidDetails(subject, publicKey, privateKey)

export function vapidPublicKey() {
  return publicKey
}

const ICON = '/icons/icon-192.png'
const BADGE = '/icons/icon-96.png'

/** Sends one payload to many devices; drops subscriptions the browser says are gone. */
export async function sendToSubscriptions(subscriptions, payload) {
  if (!pushEnabled || subscriptions.length === 0) return { sent: 0, failed: 0 }
  const body = JSON.stringify({ icon: ICON, badge: BADGE, ...payload })
  let sent = 0
  let failed = 0
  const queue = [...subscriptions]
  const workers = Array.from({ length: Math.min(20, queue.length) }, async () => {
    while (queue.length) {
      const subscription = queue.shift()
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, body, { TTL: 60 * 60 * 6, urgency: 'high' })
        sent += 1
      } catch (error) {
        failed += 1
        if (error?.statusCode !== 404 && error?.statusCode !== 410) console.warn('push send failed', error?.statusCode || '', error?.body || error?.message)
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await deletePushSubscription(subscription.endpoint).catch(() => {})
        }
      }
    }
  })
  await Promise.all(workers)
  return { sent, failed }
}

/** Never lets a slow push provider hold up an API response for long. */
export async function safely(task, timeoutMs = 4500) {
  try {
    await Promise.race([task(), new Promise((resolve) => setTimeout(resolve, timeoutMs))])
  } catch (error) {
    console.error('push failed', error)
  }
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-MX')}`
}

function orderSummary(order) {
  const item = order.items?.[0]
  if (!item) return 'Pedido'
  const what = item.mealName ? `${item.mealName} · ${item.packageLabel}` : item.packageLabel
  return `${item.quantity}× ${what}${order.isWeeklyPlan ? ' (semana)' : ''}`
}

function longDate(date) {
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
  return value
}

export async function notifyAdminsNewOrder(order) {
  const admins = await getPushSubscriptions({ audience: 'admin' })
  return sendToSubscriptions(admins, {
    title: `🛎️ Nuevo pedido · ${money(order.total)}`,
    body: `${order.customer?.name || 'Cliente'} · ${orderSummary(order)}\nEntrega ${longDate(order.deliveryDate)} · ${order.delivery?.office || ''}`,
    url: '/admin?tab=orders',
    tag: `order-${order.id}`,
    requireInteraction: true,
    actions: [{ action: 'open', title: 'Ver pedido' }],
  })
}

export async function notifyOrderStatus(order) {
  const devices = await getPushSubscriptions({ orderId: order.id })
  if (order.status === 'accepted') {
    return sendToSubscriptions(devices, {
      title: '✅ ¡Tu pedido fue aceptado!',
      body: `${orderSummary(order)}. Llega ${longDate(order.deliveryDate)} entre 12:00 y 2:00 pm.`,
      url: `/?pedido=${order.id}`,
      tag: `order-${order.id}`,
    })
  }
  if (order.status === 'cancelled') {
    return sendToSubscriptions(devices, {
      title: 'Tu pedido fue cancelado',
      body: `${orderSummary(order)}. Si tienes dudas, escríbenos por WhatsApp y lo resolvemos.`,
      url: `/?pedido=${order.id}`,
      tag: `order-${order.id}`,
    })
  }
  return { sent: 0, failed: 0 }
}

function dayWord(date, today) {
  const diff = Math.round((new Date(`${date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000)
  if (diff === 1) return 'mañana'
  const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  return `el ${weekday}`
}

/**
 * Daily reminders, run by Vercel Cron.
 * lunch (11 am): invite to order the next delivery day's menu.
 * evening (5 pm): last call before ordering closes at 6 pm; skips people who already ordered.
 */
export async function runReminder(slot) {
  const policy = orderPolicy()
  const weekday = new Date(`${policy.today}T12:00:00Z`).getUTCDay()
  if (weekday === 0 || weekday === 6) return { skipped: 'fin de semana' }
  if (!policy.isOpen) return { skipped: 'pedidos cerrados' }

  const date = policy.tomorrow
  const specialDays = await getSpecialDays()
  const special = specialDays[date]
  if (special?.kind === 'closed') return { skipped: 'día cerrado' }
  const meals = (await getMenu(date)).filter((meal) => meal.available)
  const names = [
    ...(special?.kind === 'special_package' && special.packageName ? [special.packageName] : []),
    ...meals.map((meal) => meal.name),
  ]
  if (names.length === 0) return { skipped: 'sin menú publicado' }

  const when = dayWord(date, policy.today)
  const dishes = names.length > 1 ? `${names.slice(0, -1).join(', ')} o ${names.at(-1)}` : names[0]
  let subscriptions = await getPushSubscriptions({ remindersOnly: true })
  subscriptions = subscriptions.filter((item) => item.audience === 'customer')

  let payload
  if (slot === 'lunch') {
    payload = {
      title: `🍲 ¿Ya sabes qué vas a comer ${when}?`,
      body: `Hay ${dishes}. Pide hoy y te lo llevamos a tu oficina.`,
      url: '/?utm_source=push&utm_campaign=lunch#menu',
      tag: 'daily-reminder',
    }
  } else {
    const alreadyOrdered = new Set(await getOrderIdsForDate(date))
    subscriptions = subscriptions.filter((item) => !item.orderIds.some((id) => alreadyOrdered.has(id)))
    payload = {
      title: `⏰ Última llamada: ¿ya tienes comida para ${when}?`,
      body: `Cerramos pedidos a las 6:00 pm. Hoy toca ${dishes}.`,
      url: '/?utm_source=push&utm_campaign=evening#menu',
      tag: 'daily-reminder',
    }
  }

  const result = await sendToSubscriptions(subscriptions, payload)
  await logBroadcast({ kind: slot, title: payload.title, body: payload.body, url: payload.url, ...result })
  return { ...result, date }
}

export async function sendCampaign({ title, body, url, kind = 'campaign', audience = 'customer' }) {
  const subscriptions = await getPushSubscriptions({ audience, remindersOnly: audience === 'customer' })
  const result = await sendToSubscriptions(subscriptions, { title, body, url, tag: `campaign-${Date.now()}` })
  await logBroadcast({ kind, title, body, url, ...result })
  return result
}
