import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPhotoLikes, setPhotoLike, type PhotoLike } from '../lib/api'
import { useAuth } from './useAuth'

/** หัวใจของรูปทุกรูปของน้องตัวนี้ (โหลดครั้งเดียวต่อหมุด) */
export function usePhotoLikes(catId: string) {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const key = ['photoLikes', catId]
  const likes = useQuery({ queryKey: key, queryFn: () => fetchPhotoLikes(catId), staleTime: 60_000 })
  const rows = likes.data ?? []

  const toggle = useMutation({
    mutationFn: ({ ref, like }: { ref: string; like: boolean }) => setPhotoLike(catId, ref, like),
    // กดแล้วเปลี่ยนทันที ไม่ต้องรอ server
    onMutate: ({ ref, like }) => {
      if (!userId) return
      queryClient.setQueryData<PhotoLike[]>(key, (prev = []) =>
        like ? [...prev, { ref, userId }] : prev.filter((r) => !(r.ref === ref && r.userId === userId)),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const liked = (ref: string) => userId !== null && rows.some((r) => r.ref === ref && r.userId === userId)
  return {
    count: (ref: string) => rows.filter((r) => r.ref === ref).length,
    liked,
    toggle: (ref: string) => toggle.mutate({ ref, like: !liked(ref) }),
  }
}
