'use client'

import type * as LeafletNamespace from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

export interface MapPlace {
  name: string
  lat: number
  lng: number
  count: number
}

interface RetrospectMapProps {
  places: MapPlace[]
}

function buildMarkerHtml(): string {
  const styles = getComputedStyle(document.documentElement)
  const primary = styles.getPropertyValue('--primary').trim()
  const background = styles.getPropertyValue('--background').trim()
  const glowRgb = styles.getPropertyValue('--glow-rgb').trim()
  return `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${primary};border:2px solid ${background};box-shadow:0 0 6px rgba(${glowRgb},0.8)"></span>`
}

export default function RetrospectMap({ places }: RetrospectMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletNamespace.Map | null>(null)
  const markersRef = useRef<LeafletNamespace.Marker[]>([])
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let map: LeafletNamespace.Map | undefined

    void (async () => {
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      map = L.map(containerRef.current)
      leafletRef.current = L

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(),
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const markers: LeafletNamespace.Marker[] = []
      for (const place of places) {
        const marker = L.marker([place.lat, place.lng], { icon }).addTo(map)
        marker.bindTooltip(
          `${place.name} — ${place.count} ${place.count === 1 ? 'memória' : 'memórias'}`,
        )
        markers.push(marker)
      }
      markersRef.current = markers

      if (places.length === 1) {
        map.setView([places[0].lat, places[0].lng], 10)
      } else {
        const bounds = L.latLngBounds(
          places.map((place) => [place.lat, place.lng] as [number, number]),
        )
        map.fitBounds(bounds, { padding: [24, 24] })
      }

      if (disposed) {
        map.remove()
        map = undefined
        return
      }
      mapRef.current = map
    })()

    return () => {
      disposed = true
      map?.remove()
      mapRef.current = null
      markersRef.current = []
    }
  }, [places])

  useEffect(() => {
    const html = document.documentElement
    const observer = new MutationObserver(() => {
      const L = leafletRef.current
      if (!L || markersRef.current.length === 0) return
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(),
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      for (const marker of markersRef.current) marker.setIcon(icon)
    })
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] })
    observerRef.current = observer
    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [])

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        data-testid="retro-map"
        className="h-96 overflow-hidden rounded-xl border border-card lg:h-[480px]"
      />
      <ul data-testid="retro-place-list" className="space-y-2">
        {places.map((place, index) => (
          <li key={`${place.name}-${place.lat}-${place.lng}`}>
            <button
              type="button"
              data-testid={`retro-place-${index}`}
              onClick={() => {
                const map = mapRef.current
                if (map) map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 10))
              }}
              className="flex w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2 text-left text-sm text-text transition-colors hover:border-primary hover:text-primary"
            >
              <span className="min-w-0 truncate">
                {place.name} — {place.count} {place.count === 1 ? 'memória' : 'memórias'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
