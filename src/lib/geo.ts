// Free OpenStreetMap geocoder (no API key). Fine for a single-neighborhood, low-volume
// storefront; callers debounce so we stay under Nominatim's 1 request/second policy.

export type Coordinates = { latitude: number; longitude: number }
export type AddressSuggestion = Coordinates & { id: string; title: string; subtitle: string }

export const LINDAVISTA_QUERY = 'Lindavista, Gustavo A. Madero, Ciudad de México'
const VIEWBOX = '-99.151,19.516,-99.106,19.472'
const NOMINATIM = 'https://nominatim.openstreetmap.org'

export function isNearLindavista({ latitude, longitude }: Coordinates) {
  return latitude >= 19.472 && latitude <= 19.516 && longitude >= -99.151 && longitude <= -99.106
}

type NominatimPlace = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

function describe(place: NominatimPlace) {
  const a = place.address || {}
  const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ')
  const title = street || place.display_name.split(',')[0]
  const subtitle = [a.neighbourhood || a.suburb || a.quarter, a.city_district || a.borough].filter(Boolean).join(', ') || 'Gustavo A. Madero, CDMX'
  return { title, subtitle }
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: `${query}, ${LINDAVISTA_QUERY}`,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'mx',
    viewbox: VIEWBOX,
    bounded: '1',
    'accept-language': 'es',
  })
  const response = await fetch(`${NOMINATIM}/search?${params}`, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) return []
  const results = (await response.json()) as NominatimPlace[]
  const seen = new Set<string>()
  return results
    .map((place) => ({ id: String(place.place_id), latitude: Number(place.lat), longitude: Number(place.lon), ...describe(place) }))
    .filter((item) => {
      const key = `${item.title}|${item.subtitle}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export async function reverseGeocode({ latitude, longitude }: Coordinates): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(latitude), lon: String(longitude), format: 'jsonv2', addressdetails: '1', zoom: '18', 'accept-language': 'es',
  })
  try {
    const response = await fetch(`${NOMINATIM}/reverse?${params}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const place = (await response.json()) as NominatimPlace
    if (!place?.display_name) return null
    return describe(place).title
  } catch {
    return null
  }
}

export function externalMapUrl(coordinates: Coordinates | null) {
  const query = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : LINDAVISTA_QUERY
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
