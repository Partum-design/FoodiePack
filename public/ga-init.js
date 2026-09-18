// Google tag (GA4) bootstrap. Kept as an external file, not an inline <script>, so the site's
// Content-Security-Policy never needs script-src 'unsafe-inline'. The matching gtag.js <script>
// lives in index.html so the tag is in the static HTML of every route (Google's tag-coverage
// crawler looks there), and this file only ever runs on the real storefront.
(function () {
  // The first ID is the one loaded by the gtag.js <script> in index.html; every ID gets its own config.
  var MEASUREMENT_IDS = ['G-Y84JYTSWHW', 'G-1X9623HM16']
  // Local dev, Vercel previews and the Capacitor app (https://localhost) must not pollute the property.
  var PRODUCTION_HOSTS = ['www.foodiepack.com.mx', 'foodiepack.com.mx']
  // Kitchen back office: staff traffic, not customers.
  var EXCLUDED_PATHS = ['/admin', '/gestion-cocina']
  // Routes are client-side and the HTML <title> is the storefront's, so name the other pages explicitly.
  var PAGE_TITLES = {
    '/menu-semana': 'FoodiePack · Menú de la semana',
    '/semana': 'FoodiePack · Menú de la semana',
    '/privacidad': 'FoodiePack · Aviso de privacidad',
    '/aviso-de-privacidad': 'FoodiePack · Aviso de privacidad',
  }

  var path = location.pathname.replace(/\/$/, '') || '/'
  if (PRODUCTION_HOSTS.indexOf(location.hostname) === -1) return
  for (var i = 0; i < EXCLUDED_PATHS.length; i += 1) {
    if (path === EXCLUDED_PATHS[i] || path.indexOf(EXCLUDED_PATHS[i] + '/') === 0) return
  }

  window.dataLayer = window.dataLayer || []
  // gtag.js only processes commands pushed as the `arguments` object; a rest-args array is silently ignored.
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())

  var config = PAGE_TITLES[path] ? { page_title: PAGE_TITLES[path] } : {}
  for (var j = 0; j < MEASUREMENT_IDS.length; j += 1) window.gtag('config', MEASUREMENT_IDS[j], config)
})()
