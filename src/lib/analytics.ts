const GA_MEASUREMENT_ID = 'G-1X9623HM16'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let initialized = false

// Loads Google Analytics only in production, after the app has started rendering,
// via an externally-src'd script tag (never inline) so it needs no CSP script-src
// 'unsafe-inline' allowance. Safe to call more than once — it only runs the first time.
export function initAnalytics() {
  if (initialized || !import.meta.env.PROD) return
  initialized = true

  window.dataLayer = window.dataLayer || []
  window.gtag = (...args: unknown[]) => window.dataLayer!.push(args)
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

// Scaffold for future conversion tracking (e.g. WhatsApp click, form submit).
// Not wired to any UI yet — call this once specific events are defined.
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!import.meta.env.PROD || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
