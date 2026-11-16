import 'leaflet/dist/leaflet.css'
import { createPortal } from 'react-dom'
import { groupMapVenues, hasMapCoordinates, type MapVenue } from '@/lib/mapVenues'
import MapVenuePopup from './MapVenuePopup'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import type { Coords } from '@/lib/geo'
import type { PublicEventData } from '@/components/home/types'
import { ingestText } from '@/lib/ingestText'

interface DiscoveryMapProps {
  events: PublicEventData[]
  center: Coords
}

export default function DiscoveryMap({ events, center }: DiscoveryMapProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LayerGroup | null>(null)
  const lastBoundsKeyRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [activePopup, setActivePopup] = useState<{ element: HTMLElement; venue: MapVenue; update: () => void } | null>(null)
  useEffect(() => { activePopup?.update() }, [activePopup])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    setMapReady(false)

    void import('leaflet').then((leaflet) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = leaflet.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: false,
      })
      map.zoomControl.setPosition('bottomright')

      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      mapRef.current = map
      markersRef.current = leaflet.layerGroup().addTo(map)
      setMapReady(true)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = null
      lastBoundsKeyRef.current = null
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const map = mapRef.current
    if (!container || !map || !mapReady) return

    let frame = 0
    const invalidate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    }
    const observer = new ResizeObserver(invalidate)
    observer.observe(container)
    window.addEventListener('orientationchange', invalidate)
    invalidate()

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('orientationchange', invalidate)
    }
  }, [mapReady])

  useEffect(() => {
    let cancelled = false

    void import('leaflet').then((leaflet) => {
      const map = mapRef.current
      const markerLayer = markersRef.current
      if (cancelled || !map || !markerLayer) return

      markerLayer.clearLayers()
      const venues = groupMapVenues(events)
      const bounds: [number, number][] = []
      setActivePopup(null)
      for (const venue of venues) {
        bounds.push(venue.position)
        const element = document.createElement('div')
        const popup = leaflet.popup({ maxWidth: 340, minWidth: 240, maxHeight: 390 }).setContent(element)
        const icon = leaflet.divIcon({
          className: 'poruch-venue-marker', iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40],
          html: '<span class="poruch-marker-' + venue.kind + '"><b aria-hidden="true">' + (venue.kind === 'native' ? '&#9679;' : '&#127903;') + '</b>' + (venue.events.length > 1 ? '<small>' + venue.events.length + '</small>' : '') + '</span>',
        })
        const marker = leaflet.marker(venue.position, { icon, title: venue.name, alt: venue.kind === 'native' ? ingestText.nativeMarker : ingestText.externalMarker }).addTo(markerLayer).bindPopup(popup)
        marker.on('popupopen', () => setActivePopup({ element, venue, update: () => popup.update() }))
        marker.on('popupclose', () => setActivePopup(current => current?.element === element ? null : current))
      }

      const markerKey = venues
        .map(venue => venue.key)
        .sort()
        .join('|')
      const boundsKey = `${center.lat}:${center.lng}|${markerKey}`
      if (lastBoundsKeyRef.current !== boundsKey) {
        if (bounds.length === 1) map.setView(bounds[0], 14)
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })
        else map.setView([center.lat, center.lng], 12)
        lastBoundsKeyRef.current = boundsKey
      }
    })

    return () => { cancelled = true }
  }, [center.lat, center.lng, events, mapReady, navigate])

  const markerCount = events.filter(hasMapCoordinates).length

  return (
    <div className="relative min-h-[430px] flex-1 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-muted lg:min-h-0">
      {activePopup && createPortal(<MapVenuePopup venue={activePopup.venue} onOpen={id => navigate(`/event/${id}`)} />, activePopup.element)}
      <div className="absolute bottom-6 left-2 z-[500] flex gap-3 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold"><span className="text-violet-700">{ingestText.externalMarker}</span><span className="text-sky-700">{ingestText.nativeMarker}</span></div>
      <div ref={containerRef} role="region" className="absolute inset-0 z-0" aria-label="Карта подій" />
      {markerCount === 0 && <div className="pointer-events-none absolute inset-x-4 top-4 z-[400] mx-auto max-w-sm rounded-xl border border-brand-border bg-white/95 px-4 py-3 text-center text-xs font-bold text-brand-ink-soft shadow-card">Для вибраних подій немає координат на карті</div>}
    </div>
  )
}
