import { createContext, useContext } from 'react'
import type { Cat } from '../types'

/** คำสั่งที่ component ลึกๆ (รีวิว หน้าโปรไฟล์) ใช้สั่งหน้าแผนที่ได้ โดยไม่ต้องส่ง prop ต่อกันหลายชั้น */
export interface MapActions {
  openProfile: (userId: string) => void
  openCat: (catId: string) => void
  editCat: (cat: Cat) => void
}

export const MapActionsContext = createContext<MapActions>({
  openProfile: () => {},
  openCat: () => {},
  editCat: () => {},
})

export const useMapActions = () => useContext(MapActionsContext)
