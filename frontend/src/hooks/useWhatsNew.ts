import { useCallback, useState } from 'react'
import { LATEST_CHANGELOG_ID } from '../lib/changelog'

const KEY = 'meowpin.changelogSeen'

function readSeen(): string | null {
  try {
    const seen = localStorage.getItem(KEY)
    // เข้ามาครั้งแรก: ทุกอย่างใหม่อยู่แล้ว ไม่ต้องขึ้นจุดแจ้ง — จำไว้ว่าเห็นถึงตัวล่าสุด
    if (seen === null) localStorage.setItem(KEY, LATEST_CHANGELOG_ID)
    return seen ?? LATEST_CHANGELOG_ID
  } catch {
    return LATEST_CHANGELOG_ID
  }
}

/** มีอัปเดตที่ผู้ใช้ยังไม่ได้เปิดดูไหม (จำในเครื่องนี้) */
export function useWhatsNew() {
  const [seen, setSeen] = useState(readSeen)
  const markSeen = useCallback(() => {
    setSeen(LATEST_CHANGELOG_ID)
    try {
      localStorage.setItem(KEY, LATEST_CHANGELOG_ID)
    } catch {
      // private mode — แค่ไม่จำ
    }
  }, [])
  return { hasNew: seen !== LATEST_CHANGELOG_ID, seen, markSeen }
}
