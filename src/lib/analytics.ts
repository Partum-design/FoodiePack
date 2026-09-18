// Event helpers for Google Analytics 4 (GA4 recommended e-commerce / lead events).
//
// The gtag.js bootstrap itself lives in public/ga-init.js and is loaded from index.html, so the tag
// is in the static HTML of every route. It only defines window.gtag on the real storefront hosts
// (not local dev, previews, the mobile shell or /admin) — everywhere else every helper is a no-op.
//
// Never pass personal data (name, phone, address, notes) as event params: Google's terms forbid it.

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const CURRENCY = 'MXN'

export type AnalyticsItem = {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price: number
  quantity: number
}

type EventParams = Record<string, unknown>

export function trackEvent(name: string, params: EventParams = {}) {
  if (typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

// A package/menu choice was added to the order.
export function trackAddToCart(items: AnalyticsItem[], value: number) {
  trackEvent('add_to_cart', { currency: CURRENCY, value, items })
}

// The checkout dialog was opened.
export function trackBeginCheckout(items: AnalyticsItem[], value: number) {
  trackEvent('begin_checkout', { currency: CURRENCY, value, items })
}

// The checkout form passed validation and is being submitted.
export function trackAddPaymentInfo(items: AnalyticsItem[], value: number, paymentType: string) {
  trackEvent('add_payment_info', { currency: CURRENCY, value, payment_type: paymentType, items })
}

// The kitchen accepted the order. `transactionId` is the order code (no personal data).
export function trackPurchase(params: {
  transactionId: string
  items: AnalyticsItem[]
  value: number
  shipping: number
  paymentType: string
}) {
  trackEvent('purchase', {
    transaction_id: params.transactionId,
    currency: CURRENCY,
    value: params.value,
    shipping: params.shipping,
    payment_type: params.paymentType,
    items: params.items,
  })
}

// A customer opened a WhatsApp conversation with the business. `location` says which button.
export function trackWhatsAppLead(location: string, params: EventParams = {}) {
  trackEvent('generate_lead', { method: 'whatsapp', link_location: location, ...params })
}
