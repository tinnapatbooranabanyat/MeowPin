import { createContext, useContext } from 'react'
import type { Cat, MoveRequest } from '../types'

/** คำสั่งที่ component ลึกๆ (รีวิว หน้าโปรไฟล์) ใช้สั่งหน้าแผนที่ได้ โดยไม่ต้องส่ง prop ต่อกันหลายชั้น */
export interface MapActions {
  openProfile: (userId: string) => void
  openCat: (catId: string) => void
  editCat: (cat: Cat) => void
  /** ย้ายหมุด (คนปักหมุด/ผู้ดูแล) — ส่ง request มาด้วยเมื่อย้ายตามที่คนอื่นเสนอ */
  moveCat: (cat: Cat, request?: MoveRequest) => void
  /** คนอื่นเสนอตำแหน่งใหม่ให้คนปักหมุด */
  suggestMove: (cat: Cat) => void
}

export const MapActionsContext = createContext<MapActions>({
  openProfile: () => {},
  openCat: () => {},
  editCat: () => {},
  moveCat: () => {},
  suggestMove: () => {},
})

export const useMapActions = () => useContext(MapActionsContext)
