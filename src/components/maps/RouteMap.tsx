'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import polyline from '@mapbox/polyline'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface RouteMapProps {
  /** Encoded polyline (Google polyline algorithm) from Strava `summary_polyline`
   *  or detailed `polyline`. Pass null/empty to render a placeholder. */
  polyline: string | null
  /** Tailwind classes for height/rounding. Map fills the container. */
  className?: string
  /** Hex color of the route line. */
  strokeColor?: string
}

// OSM raster tiles are free for personal-use volumes but slow and styled for
// generic maps. For higher polish/scale we can swap in Stadia, MapTiler, or
// Protomaps later — the rest of the component stays the same.
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm-raster',
    },
  ],
}

export function RouteMap({
  polyline: encoded,
  className = 'h-56 w-full rounded-card-lg',
  strokeColor = '#FC4C02', // Strava orange
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || !encoded) return

    // Decode to [[lat, lng], ...] then flip to GeoJSON [lng, lat] order.
    const decoded = polyline.decode(encoded)
    if (decoded.length === 0) return
    const coords = decoded.map(([lat, lng]) => [lng, lat] as [number, number])

    const bounds = coords.reduce(
      (acc, [lng, lat]) => acc.extend([lng, lat]),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    )

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      bounds,
      fitBoundsOptions: { padding: 24, animate: false },
      attributionControl: { compact: true },
      // Tap-only — disable rotate/pitch to keep the hero interaction simple.
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: true,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        },
      })

      // White halo behind the route for contrast over any tile style.
      map.addLayer({
        id: 'route-halo',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 6,
          'line-opacity': 0.85,
        },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': strokeColor,
          'line-width': 3.5,
        },
      })

      // Start / end markers.
      const start = coords[0]
      const end = coords[coords.length - 1]
      new maplibregl.Marker({ color: '#1A1A1A', scale: 0.7 })
        .setLngLat(start)
        .addTo(map)
      new maplibregl.Marker({ color: strokeColor, scale: 0.9 })
        .setLngLat(end)
        .addTo(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [encoded, strokeColor])

  if (!encoded) {
    return (
      <div
        className={`flex items-center justify-center bg-bg-surface text-[12px] text-text-tertiary ${className}`}
      >
        Geen route-data
      </div>
    )
  }

  return <div ref={containerRef} className={className} />
}
