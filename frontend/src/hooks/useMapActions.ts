import { createContext, useContext } from 'react'

/** คำสั่งที่ component ลึกๆ (รีวิว หน้าโปรไฟล์) ใช้สั่งหน้าแผนที่ได้ โดยไม่ต้องส่ง prop ต่อกันหลายชั้น */
export interface MapActions {
  openProfile: (userId: string) => void
  openCat: (catId: string) => void
}

export const MapActionsContext = createContext<MapActions>({
  openProfile: () => {},
  openCat: () => {},
})

export const useMapActions = () => useContext(MapActionsContext)
