import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import type { LatLng } from '../types'

/** หมุดสถานที่ที่ค้นหา (แบบหมุดแดงของ Google Maps) — กดแล้วปักหมุดแมวตรงนี้ได้ */
export function PlaceMarker({ position, name, onClick }: { position: LatLng; name: string; onClick: () => void }) {
  return (
    <AdvancedMarker position={position} title={name} zIndex={900} onClick={onClick}>
      <span className="flex flex-col items-center">
        <span className="mb-0.5 max-w-40 truncate rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-stone-800 shadow ring-1 ring-stone-200">
          {name}
        </span>
        <MapPin size={36} className="fill-red-500 text-red-700 drop-shadow" strokeWidth={1.5} aria-hidden="true" />
      </span>
    </AdvancedMarker>
  )
}
