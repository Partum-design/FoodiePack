import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

export type Coordinates = { latitude: number; longitude: number }

const DEFAULT_CENTER: [number, number] = [19.494, -99.1285]

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
    const map = L.map(containerRef.current, { zoomControl: false }).setView(center, coordinates ? 17 : 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; colaboradores de OpenStreetMap',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const marker = L.marker(center, { draggable: true }).addTo(map)
    marker.on('dragend', () => {
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
    mapRef.current.setView(point, 17)
  }, [coordinates])

  return <div ref={containerRef} className="delivery-map__canvas" />
}
