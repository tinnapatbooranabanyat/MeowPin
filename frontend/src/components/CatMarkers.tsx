import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer'
import { AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Cat } from '../types'
import { CatAvatar } from './CatAvatar'

type Marker = google.maps.marker.AdvancedMarkerElement

const PAW_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="16.5" rx="5" ry="4.2"/><circle cx="5.5" cy="10.5" r="2.3"/><circle cx="9.3" cy="6.3" r="2.3"/><circle cx="14.7" cy="6.3" r="2.3"/><circle cx="18.5" cy="10.5" r="2.3"/></svg>`

interface Props {
  cats: Cat[]
  selectedId: string | null
  onSelect: (cat: Cat) => void
}

export function CatMarkers({ cats, selectedId, onSelect }: Props) {
  const map = useMap()
  const markerLib = useMapsLibrary('marker')
  const [markers, setMarkers] = useState<Record<string, Marker>>({})

  const clusterer = useMemo(() => {
    if (!map || !markerLib) return null
    const renderer: Renderer = {
      render: ({ count, position }) => {
        const el = document.createElement('div')
        el.className =
          'flex items-center gap-1 rounded-full border-[3px] border-white bg-orange-800 px-3 py-2 text-sm font-semibold text-white shadow-lg'
        el.innerHTML = `${PAW_SVG}<span>${count}</span>`
        return new markerLib.AdvancedMarkerElement({ position, content: el, zIndex: 1000 + count })
      },
    }
    return new MarkerClusterer({ map, renderer })
  }, [map, markerLib])

  useEffect(() => {
    if (!clusterer) return
    clusterer.clearMarkers()
    clusterer.addMarkers(Object.values(markers))
  }, [clusterer, markers])

  useEffect(() => () => clusterer?.setMap(null), [clusterer])

  const setMarkerRef = useCallback((marker: Marker | null, id: string) => {
    setMarkers((prev) => {
      if ((marker && prev[id]) || (!marker && !prev[id])) return prev
      if (marker) return { ...prev, [id]: marker }
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  return cats.map((cat) => (
    <CatMarker
      key={cat.id}
      cat={cat}
      selected={cat.id === selectedId}
      onSelect={onSelect}
      setMarkerRef={setMarkerRef}
    />
  ))
}

interface CatMarkerProps {
  cat: Cat
  selected: boolean
  onSelect: (cat: Cat) => void
  setMarkerRef: (marker: Marker | null, id: string) => void
}

function CatMarker({ cat, selected, onSelect, setMarkerRef }: CatMarkerProps) {
  // ref ต้องคงที่ ไม่งั้น React 19 จะเรียก ref ใหม่ทุก render แล้ว setState วนไม่จบ
  const ref = useCallback((marker: Marker | null) => setMarkerRef(marker, cat.id), [setMarkerRef, cat.id])

  return (
    <AdvancedMarker
      ref={ref}
      position={cat.position}
      title={cat.name}
      zIndex={selected ? 999 : undefined}
      onClick={() => onSelect(cat)}
    >
      <div
        className={`flex flex-col items-center transition-transform duration-200 ${selected ? 'scale-125' : 'hover:scale-110'}`}
      >
        <CatAvatar
          cat={cat}
          iconSize={22}
          className={`size-11 rounded-full border-[3px] shadow-md ${selected ? 'border-orange-500' : 'border-white'}`}
        />
        <div
          className={`-mt-0.5 size-0 border-x-[7px] border-t-[9px] border-x-transparent ${selected ? 'border-t-orange-500' : 'border-t-white'}`}
        />
      </div>
    </AdvancedMarker>
  )
}
