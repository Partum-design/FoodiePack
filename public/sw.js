const RUNTIME_CACHE = 'foodiepack-runtime-v3'

// The kitchen admin tool has no offline use case, and a shared/kiosk device
// shouldn't keep its login screen around in the cache after someone leaves.
const NEVER_CACHE_PATHS = ['/admin', '/gestion-cocina']

function isNeverCache(pathname) {
  return pathname.startsWith('/api/') || NEVER_CACHE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== RUNTIME_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only ever cache same-origin, non-sensitive responses — API calls (which carry
  // auth tokens and personal/order data) and the admin tool always go straight
  // to the network and are never written to disk by this worker.
  if (url.origin !== self.location.origin || isNeverCache(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || networkFetch
    }),
  )
})

// ---------------------------------------------------------------------------
// Push notifications (order updates, daily reminders, campaigns)
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.title || 'FoodiePack'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-96.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    actions: data.actions || [],
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const sameApp = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (sameApp) {
        sameApp.navigate(target).catch(() => {})
        return sameApp.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
