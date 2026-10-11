import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchCatPhotos } from '../lib/api'
import type { Cat, CatPhoto } from '../types'

/** รูปทั้งหมดของแมว: รูปหลักตอนปักหมุดมาก่อน ตามด้วยรูปจากรีวิว (ใหม่สุดก่อน) */
export function useCatPhotos(cat: Cat) {
  const album = useQuery({ queryKey: ['catPhotos', cat.id], queryFn: () => fetchCatPhotos(cat.id), staleTime: 60_000 })
  const photos = useMemo<CatPhoto[]>(() => {
    const main: CatPhoto[] = cat.photoUrl
      ? [
          {
            id: 'main',
            url: cat.photoUrl,
            userId: cat.createdBy,
            uploaderName: cat.createdByName,
            reviewId: null,
            createdAt: '',
          },
        ]
      : []
    return [...main, ...(album.data ?? [])]
  }, [cat.photoUrl, cat.createdBy, cat.createdByName, album.data])
  return { photos, album: album.data ?? [] }
}
