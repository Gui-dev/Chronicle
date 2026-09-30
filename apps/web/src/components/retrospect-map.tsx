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

export default function RetrospectMap({ places }: RetrospectMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletNamespace.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let map: LeafletNamespace.Map | undefined

    void (async () => {
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      map = L.map(containerRef.current)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#f0c040;border:2px solid #0a0a0f;box-shadow:0 0 6px rgba(240,192,64,0.8)"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      for (const place of places) {
        L.marker([place.lat, place.lng], { icon })
          .addTo(map)
          .bindTooltip(
            `${place.name} — ${place.count} ${place.count === 1 ? 'memória' : 'memórias'}`,
          )
      }

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
    }
  }, [places])

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
              className="flex w-full items-center justify-between rounded-lg border border-card bg-card px-3 py-2 text-left text-sm text-text transition-colors hover:border-primary hover:text-primary"
            >
              <span className="truncate">
                {place.name} — {place.count} {place.count === 1 ? 'memória' : 'memórias'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
