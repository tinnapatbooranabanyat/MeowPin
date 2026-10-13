import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { fetchMyMissions } from '../lib/api'
import { useAuth } from './useAuth'

/** ภารกิจสัปดาห์นี้ของฉัน (ใช้ร่วมกันทั้งปุ่มบนแผนที่และการ์ดภารกิจ) */
export function useMissions() {
  const { userId } = useAuth()
  return useQuery({ queryKey: ['missions', userId], queryFn: fetchMyMissions, staleTime: 30_000 })
}

/** เรียกหลังทำอะไรที่อาจนับเป็นภารกิจ (เจอน้อง ให้อาหาร ถ่ายรูป ยืนยันเรื่อง ปักหมุด) */
export function useRefreshMissions() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ queryKey: ['missions'] }), [queryClient])
}
