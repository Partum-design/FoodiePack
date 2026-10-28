import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair } from 'lucide-react'

export type Coordinates = { latitude: number; longitude: number }

const DEFAULT_CENTER: [number, number] = [19.494, -99.1285]
// Same bounds the checkout uses to decide whether a pin is inside the delivery zone.
const ZONE_BOUNDS: L.LatLngBoundsExpression = [[19.472, -99.151], [19.516, -99.106]]

const pinIcon = L.divIcon({
  className: 'fp-map-pin',
  html: '<span class="fp-map-pin__dot"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18"/><path d="M5 11a7 7 0 0 1 14 0"/><path d="M4 15h16l-1.5 4h-13z"/></svg></span><span class="fp-map-pin__shadow"></span>',
  iconSize: [44, 56],
  iconAnchor: [22, 52],
})

export default function DeliveryMap({ coordinates, onMove }: {
  coordinates: Coordinates | null
  onMove: (coordinates: Coordinates) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const center: [number, number] = coordinates ? [coordinates.latitude, coordinates.longitude] : DEFAULT_CENTER
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(center, coordinates ? 17 : 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.rectangle(ZONE_BOUNDS, {
      color: '#e9871b', weight: 2, dashArray: '6 6', fillColor: '#e9871b', fillOpacity: 0.06, interactive: false,
    }).addTo(map)

    const marker = L.marker(center, { draggable: true, icon: pinIcon, autoPan: true }).addTo(map)
    marker.on('dragstart', () => containerRef.current?.classList.add('is-dragging'))
    marker.on('dragend', () => {
      containerRef.current?.classList.remove('is-dragging')
      const { lat, lng } = marker.getLatLng()
      onMoveRef.current({ latitude: lat, longitude: lng })
    })
    map.on('click', (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng)
      onMoveRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    })

    mapRef.current = map
    markerRef.current = marker
    window.setTimeout(() => map.invalidateSize(), 250)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once init; live updates handled by the effect below
  }, [])

  useEffect(() => {
    if (!coordinates || !mapRef.current || !markerRef.current) return
    const point: [number, number] = [coordinates.latitude, coordinates.longitude]
    markerRef.current.setLatLng(point)
    mapRef.current.flyTo(point, Math.max(mapRef.current.getZoom(), 17), { duration: 0.6 })
  }, [coordinates])

  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    if (coordinates) map.flyTo([coordinates.latitude, coordinates.longitude], 17, { duration: 0.5 })
    else map.flyToBounds(ZONE_BOUNDS, { duration: 0.5 })
  }

  return (
    <div className="fp-map__wrap">
      <div ref={containerRef} className="fp-map__canvas" />
      <button type="button" className="fp-map__recenter" onClick={recenter} aria-label="Centrar mapa"><Crosshair size={17} /></button>
    </div>
  )
}
