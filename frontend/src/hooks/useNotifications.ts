import { useQuery } from '@tanstack/react-query'
import { fetchNotifications } from '../lib/api'
import { useAuth } from './useAuth'

/** การแจ้งเตือนของเรา — เช็กใหม่ทุกนาที และทุกครั้งที่กลับมาที่แท็บ */
export function useNotifications() {
  const { userId } = useAuth()
  const query = useQuery({
    queryKey: ['notifications', userId],
    queryFn: fetchNotifications,
    enabled: userId !== null,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const items = query.data ?? []
  return { items, unread: items.filter((n) => !n.readAt).length, isPending: query.isPending && userId !== null }
}
