const EARTH_RADIUS_KM = 6371

/**
 * Cocina base: Pernambuco 734, Lindavista, Gustavo A. Madero.
 * Es una coincidencia a nivel calle, así que el punto puede moverse unos cientos
 * de metros. Para afinarlo no hace falta tocar el código: basta con definir
 * KITCHEN_LATITUDE y KITCHEN_LONGITUDE en el entorno.
 */
export const KITCHEN_LOCATION = {
  latitude: Number(process.env.KITCHEN_LATITUDE || 19.49198),
  longitude: Number(process.env.KITCHEN_LONGITUDE || -99.12515),
}

/** Radio de envío gratis anunciado en la carta: 3 km a la redonda. */
export const FREE_DELIVERY_RADIUS_KM = Number(process.env.FREE_DELIVERY_RADIUS_KM || 3)

const GEOCODER_URL = 'https://nominatim.openstreetmap.org/search'
const GEOCODER_USER_AGENT = process.env.GEOCODER_USER_AGENT || 'FoodiePack/1.0 (pedidos Lindavista CDMX)'
const GEOCODER_TIMEOUT_MS = 6000
const GEOCODER_MIN_GAP_MS = 1100
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const GEOCODE_CACHE_LIMIT = 500
/** Recuadro que orienta la búsqueda hacia la ciudad sin descartar coincidencias a nivel calle. */
const SEARCH_BOX_DEGREES = 0.35
/** Un resultado más lejano que esto es de otra ciudad: se descarta en vez de medirlo. */
const MAX_GEOCODE_DISTANCE_KM = 40

const geocodeCache = new Map()
let geocoderQueue = Promise.resolve()

function toRadians(value) {
  return (value * Math.PI) / 180
}

export function haversineKm(from, to) {
  const deltaLatitude = toRadians(to.latitude - from.latitude)
  const deltaLongitude = toRadians(to.longitude - from.longitude)
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function isValidCoordinates(coordinates) {
  return Boolean(coordinates)
    && Number.isFinite(coordinates.latitude)
    && Number.isFinite(coordinates.longitude)
    && Math.abs(coordinates.latitude) <= 90
    && Math.abs(coordinates.longitude) <= 180
}

/**
 * Evalúa un punto contra el radio de entrega.
 * Devuelve `null` cuando todavía no hay coordenadas que medir.
 */
export function evaluateDeliveryPoint(coordinates) {
  if (!isValidCoordinates(coordinates)) return null
  const distanceKm = Number(haversineKm(KITCHEN_LOCATION, coordinates).toFixed(2))
  return {
    coordinates: { latitude: coordinates.latitude, longitude: coordinates.longitude },
    distanceKm,
    radiusKm: FREE_DELIVERY_RADIUS_KM,
    withinRadius: distanceKm <= FREE_DELIVERY_RADIUS_KM,
  }
}

function readCache(key) {
  const hit = geocodeCache.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expiresAt) {
    geocodeCache.delete(key)
    return undefined
  }
  return hit.value
}

function writeCache(key, value) {
  if (geocodeCache.size >= GEOCODE_CACHE_LIMIT) {
    const oldest = geocodeCache.keys().next().value
    if (oldest !== undefined) geocodeCache.delete(oldest)
  }
  geocodeCache.set(key, { value, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS })
}

async function askNominatim(query) {
  const left = KITCHEN_LOCATION.longitude - SEARCH_BOX_DEGREES
  const right = KITCHEN_LOCATION.longitude + SEARCH_BOX_DEGREES
  const top = KITCHEN_LOCATION.latitude + SEARCH_BOX_DEGREES
  const bottom = KITCHEN_LOCATION.latitude - SEARCH_BOX_DEGREES

  const url = new URL(GEOCODER_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'mx')
  // El recuadro solo prioriza resultados: con `bounded=1` Nominatim descarta calles válidas.
  url.searchParams.set('viewbox', `${left},${top},${right},${bottom}`)
  url.searchParams.set('q', query)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': GEOCODER_USER_AGENT, 'Accept-Language': 'es-MX' },
    })
    if (!response.ok) return null
    const results = await response.json()
    const first = Array.isArray(results) ? results[0] : null
    if (!first) return null
    const coordinates = { latitude: Number(first.lat), longitude: Number(first.lon) }
    if (!isValidCoordinates(coordinates)) return null
    if (haversineKm(KITCHEN_LOCATION, coordinates) > MAX_GEOCODE_DISTANCE_KM) return null
    return { coordinates, label: typeof first.display_name === 'string' ? first.display_name : '' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Convierte una dirección escrita en coordenadas usando Nominatim (OpenStreetMap).
 * Primero prueba la dirección tal cual y, si no la reconoce, la reintenta con la
 * delegación de la cocina: así una dirección de otra colonia se mide igual y el
 * cliente ve "estás a X km" en vez de un "no encontrada".
 * Devuelve `null` si el servicio falla o no reconoce nada: el pedido sigue su curso
 * y queda marcado como "sin verificar" para la cocina.
 */
export async function geocodeAddress(address) {
  const query = String(address || '').trim()
  if (query.length < 8) return null

  const cacheKey = query.toLowerCase()
  const cached = readCache(cacheKey)
  if (cached !== undefined) return cached

  // Nominatim pide como máximo una consulta por segundo: las encolamos.
  const run = geocoderQueue.then(async () => {
    let value = await askNominatim(`${query}, Ciudad de México`)
    if (!value) {
      await new Promise((resolve) => setTimeout(resolve, GEOCODER_MIN_GAP_MS))
      value = await askNominatim(`${query}, Gustavo A. Madero, Ciudad de México`)
    }
    writeCache(cacheKey, value)
    return value
  })
  geocoderQueue = run.then(() => new Promise((resolve) => setTimeout(resolve, GEOCODER_MIN_GAP_MS)), () => {})
  return run
}

/**
 * Resuelve la ubicación de una entrega: usa el pin del cliente si existe y,
 * si no, intenta geolocalizar la dirección escrita.
 */
export async function resolveDeliveryLocation({ address, coordinates }) {
  const fromPin = evaluateDeliveryPoint(coordinates)
  if (fromPin) return { ...fromPin, source: 'pin', label: '' }

  const geocoded = await geocodeAddress(address)
  if (!geocoded) return null

  const evaluated = evaluateDeliveryPoint(geocoded.coordinates)
  if (!evaluated) return null
  return { ...evaluated, source: 'address', label: geocoded.label }
}
