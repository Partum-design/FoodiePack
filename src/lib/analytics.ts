// The first ID also loads gtag.js; every ID gets its own config so hits go to all properties.
const GA_MEASUREMENT_IDS = ['G-Y84JYTSWHW', 'G-1X9623HM16']

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
  // gtag.js only recognizes commands pushed as the `arguments` object; pushing a rest-args
  // array is silently ignored and no hits are ever sent.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  GA_MEASUREMENT_IDS.forEach((id) => window.gtag!('config', id))

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_IDS[0]}`
  document.head.appendChild(script)
}

// Scaffold for future conversion tracking (e.g. WhatsApp click, form submit).
// Not wired to any UI yet — call this once specific events are defined.
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!import.meta.env.PROD || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
