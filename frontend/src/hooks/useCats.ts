import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { fetchCat, fetchCatsInView, type Bounds } from '../lib/api'
import type { Cat } from '../types'

// ปัดขอบเขตออกไปเป็นช่อง ~500 ม. — เลื่อนแผนที่นิดหน่อยจะได้ใช้ cache เดิม ไม่ยิง request ใหม่
const GRID = 0.005

export function snapBounds(bounds: google.maps.LatLngBoundsLiteral): Bounds {
  const padLat = (bounds.north - bounds.south) * 0.25
  const padLng = (bounds.east - bounds.west) * 0.25
  const down = (v: number) => Number((Math.floor(v / GRID) * GRID).toFixed(3))
  const up = (v: number) => Number((Math.ceil(v / GRID) * GRID).toFixed(3))
  return {
    minLat: down(bounds.south - padLat),
    minLng: down(bounds.west - padLng),
    maxLat: up(bounds.north + padLat),
    maxLng: up(bounds.east + padLng),
  }
}

export function useCatsInView(bounds: Bounds | null) {
  return useQuery({
    queryKey: ['cats', bounds],
    queryFn: () => fetchCatsInView(bounds!),
    enabled: bounds !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useCat(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['cat', id],
    queryFn: () => fetchCat(id!),
    enabled: id !== null && enabled,
    staleTime: 60_000,
  })
}

/** อัปเดตแมวตัวเดียวในทุก cache (รายการในกรอบแผนที่ + รายตัว) โดยไม่ต้องโหลดใหม่ */
export function useUpsertCat() {
  const queryClient = useQueryClient()
  return useCallback(
    (cat: Cat) => {
      queryClient.setQueryData(['cat', cat.id], cat)
      queryClient.setQueriesData<Cat[]>({ queryKey: ['cats'] }, (list) =>
        list ? [cat, ...list.filter((c) => c.id !== cat.id)] : list,
      )
    },
    [queryClient],
  )
}
