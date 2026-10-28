import { useSyncExternalStore } from 'react'
import { trackEvent } from './analytics'
import { isIos } from './install'

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '')

export type PushPermission = 'unsupported' | 'needs-install' | NotificationPermission

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Until the server confirms it has push keys, don't offer notifications at all.
let serverEnabled: boolean | null = null

function currentPermission(): PushPermission {
  if (typeof window === 'undefined' || serverEnabled === false) return 'unsupported'
  // iPhone only allows web push from the app added to the home screen (iOS 16.4+).
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

let permission: PushPermission = currentPermission()
const listeners = new Set<() => void>()
function emit() {
  permission = currentPermission()
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  fetch(`${API_URL}/push/key`)
    .then((response) => response.json() as Promise<{ enabled: boolean }>)
    .then(({ enabled }) => { serverEnabled = Boolean(enabled); emit() })
    .catch(() => { /* offline: keep current state */ })
}

export function usePushPermission() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => permission, () => permission)
}

function base64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

async function getSubscription(create: boolean) {
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing || !create) return existing
  const response = await fetch(`${API_URL}/push/key`)
  const { enabled, publicKey } = await response.json() as { enabled: boolean; publicKey: string }
  if (!enabled || !publicKey) throw new Error('Las notificaciones aún no están disponibles.')
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(publicKey) })
}

async function post(path: string, body: unknown, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('No pudimos activar las notificaciones.')
}

/** Asks for permission (if needed) and registers this device. Returns true when active. */
export async function enablePush({ orderId, admin, source }: { orderId?: string; admin?: string; source: string }) {
  if (currentPermission() !== 'default' && currentPermission() !== 'granted') return false
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  emit()
  trackEvent('push_permission', { result, source })
  if (result !== 'granted') return false
  const subscription = await getSubscription(true)
  if (!subscription) return false
  if (admin) await post('/admin/push/subscribe', { subscription: subscription.toJSON() }, admin)
  else await post('/push/subscribe', { subscription: subscription.toJSON(), ...(orderId ? { orderId } : {}) })
  return true
}

/** Links a new order to this device silently when the person already allowed notifications. */
export async function linkOrderToPush(orderId: string) {
  if (currentPermission() !== 'granted') return false
  try {
    const subscription = await getSubscription(true)
    if (!subscription) return false
    await post('/push/subscribe', { subscription: subscription.toJSON(), orderId })
    return true
  } catch {
    return false
  }
}

export async function disablePush() {
  try {
    const subscription = await getSubscription(false)
    if (subscription) {
      await post('/push/unsubscribe', { endpoint: subscription.endpoint })
      await subscription.unsubscribe()
    }
  } finally {
    emit()
  }
}
