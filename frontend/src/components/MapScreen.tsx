import { Map, useMap } from '@vis.gl/react-google-maps'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Footprints, Hand, Link2, LocateFixed, Target, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { snapBounds, useCat, useCatsInView, useUpsertCat } from '../hooks/useCats'
import { useI18n } from '../hooks/useI18n'
import { MapActionsContext, type MapActions } from '../hooks/useMapActions'
import { useMapLongPress } from '../hooks/useMapLongPress'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { deleteCat, errorText, fetchAdminCounts, fetchFedToday, fetchFewPhotos, moveCat, recordSighting, requestMove, wakeBackend, type Bounds } from '../lib/api'
import { furLabel, matchesQuery, seenWithin } from '../lib/cat'
import { drawCatCard } from '../lib/shareCard'
import { getCurrentPosition } from '../lib/geo'
import type { Cat, FurColor, LatLng, MoveRequest } from '../types'
import { AccountMenu } from './account/AccountMenu'
import { ProfileDialog } from './account/ProfileDialog'
import { UserProfileDialog } from './account/UserProfileDialog'
import type { AddCatStart } from './add-cat/AddCatFlow'
import { AdminDialog } from './admin/AdminDialog'
import { BugReportDialog } from './BugReportDialog'
import { SupportDialog } from './SupportDialog'
import { CatMarkers } from './CatMarkers'
import { CatPanel } from './CatPanel'
import { CatReportDialog } from './CatReportDialog'
import { EditCatDialog } from './EditCatDialog'
import { LeaderboardDialog } from './LeaderboardDialog'
import { NearbyCatsDialog } from './NearbyCatsDialog'
import { PhotoSearchDialog } from './PhotoSearchDialog'
import { PostsDialog } from './PostsDialog'
import { CatSheet } from './CatSheet'
import { DroppedPin } from './DroppedPin'
import { PlaceMarker } from './PlaceMarker'
import { ShareCardDialog } from './ShareCardDialog'
import { MissionsCard } from './MissionsCard'
import { Modal } from './ui/Modal'
import { useMissions, useRefreshMissions } from '../hooks/useMissions'
import { missionOf } from '../lib/missions'
import { LocationPicker } from './add-cat/LocationPicker'
import { usePlaceSearch, type FoundPlace, type PlaceSuggestion } from '../hooks/usePlaceSearch'
import { FilterChips } from './FilterChips'
import { SearchBar } from './SearchBar'
import { Toast } from './Toast'
import { UserLocationMarker } from './UserLocationMarker'
import { confirmAction, promptText } from '../lib/dialogs'

const DEFAULT_CENTER = { lat: 13.7595, lng: 100.4975 }
// จำมุมกล้องไว้ในแท็บนี้ — โหลดหน้าใหม่ (เช่นเปลี่ยนภาษาแผนที่) แล้วกลับมาที่เดิม
const CAMERA_KEY = 'meowpin.camera'

function readSavedCamera(): { center: google.maps.LatLngLiteral; zoom: number } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CAMERA_KEY) ?? 'null') as {
      center?: google.maps.LatLngLiteral
      zoom?: number
    } | null
    if (saved && typeof saved.center?.lat === 'number' && typeof saved.center.lng === 'number' && typeof saved.zoom === 'number') {
      return { center: saved.center, zoom: saved.zoom }
    }
  } catch {
    // ไม่มีหรืออ่านไม่ได้ก็เริ่มที่จุดเริ่มต้น
  }
  return null
}
const DEFAULT_ZOOM = 16
const HINT_KEY = 'meowpin.longPressHintDismissed'

// โหลดเฉพาะตอนเริ่มปักหมุด (มีไลบรารีอ่าน EXIF / บีบอัดรูป / TF.js) หน้าแผนที่จะเปิดได้เร็วขึ้น
const AddCatFlow = lazy(() => import('./add-cat/AddCatFlow').then((m) => ({ default: m.AddCatFlow })))

interface Props {
  mapId: string
}

// เลื่อนแผนที่ให้แมวไปอยู่ในส่วนที่ไม่โดน bottom sheet / แผงด้านซ้ายบัง
// offset เป็นพิกเซลบนจอ: x บวก = แมวไปทางขวา, y บวก = แมวขึ้นข้างบน
function panWithOffset(map: google.maps.Map, position: LatLng, offset: { x: number; y: number }) {
  const projection = map.getProjection()
  const zoom = map.getZoom()
  const point = projection?.fromLatLngToPoint(position)
  if (!projection || zoom === undefined || !point) {
    map.panTo(position)
    return
  }
  const scale = 2 ** zoom
  const center = new google.maps.Point(point.x - offset.x / scale, point.y + offset.y / scale)
  map.panTo(projection.fromPointToLatLng(center) ?? position)
}

// ครึ่งหนึ่งของความกว้าง CatPanel (380px) + ระยะขอบ
const DESKTOP_PANEL_OFFSET = { x: 198, y: 0 }

function readHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

type Dialog =
  | { kind: 'profile' }
  | { kind: 'userProfile'; userId: string }
  | { kind: 'bugReport' }
  | { kind: 'support' }
  | { kind: 'admin' }
  | { kind: 'catReport'; cat: Cat }
  | { kind: 'editCat'; cat: Cat }
  | { kind: 'leaderboard' }
  | { kind: 'posts' }
  | { kind: 'nearby' }
  | { kind: 'photoSearch' }
  | { kind: 'shareCat'; cat: Cat }
  | { kind: 'missions' }
  | null

export function MapScreen({ mapId }: Props) {
  const map = useMap()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { requireLogin, isAdmin, userId } = useAuth()
  const { t, lang } = useI18n()
  const { resolved: theme } = useTheme()
  const queryClient = useQueryClient()

  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('cat'),
  )
  const [query, setQuery] = useState('')
  // ว่าง = ทุกสี
  const [furColors, setFurColors] = useState<FurColor[]>([])
  const [seenToday, setSeenToday] = useState(false)
  const [friendlyOnly, setFriendlyOnly] = useState(false)
  const [needsHelp, setNeedsHelp] = useState(false)
  // น้องที่ยังไม่มีใครบันทึกว่าให้อาหารวันนี้ (ไม่นับน้องมีเจ้าของ เจ้าของให้อยู่แล้ว)
  const [notFedToday, setNotFedToday] = useState(false)
  // ไม่มีใครเจอเกิน 14 วัน / มีรูปไม่ถึง 2 รูป (ใช้กับภารกิจประจำสัปดาห์)
  const [staleOnly, setStaleOnly] = useState(false)
  const [fewPhotosOnly, setFewPhotosOnly] = useState(false)
  const [userPosition, setUserPosition] = useState<LatLng | null>(null)
  // เปิดแอปใหม่ → ไปที่ตำแหน่งของเรา (ยกเว้นเปิดจากลิงก์น้องแมว หรือรีโหลดในแท็บเดิมที่จำมุมกล้องไว้แล้ว)
  const [startAtUser] = useState(() => !new URLSearchParams(window.location.search).get('cat') && readSavedCamera() === null)
  const [toast, setToast] = useState<string | null>(null)
  const [droppedPin, setDroppedPin] = useState<LatLng | null>(null)
  const [placePin, setPlacePin] = useState<FoundPlace | null>(null)
  const [adding, setAdding] = useState<{ origin: LatLng; start: AddCatStart } | null>(null)
  // กำลังย้ายหมุด (เลือกตำแหน่งใหม่บนแผนที่)
  const [moving, setMoving] = useState<{ cat: Cat; mode: 'move' | 'suggest'; start: LatLng; request?: MoveRequest } | null>(null)
  const [movingSaving, setMovingSaving] = useState(false)
  // ระหว่างปักหมุดใหม่/ย้ายหมุด ซ่อนปุ่มอื่นบนแผนที่
  const busy = adding !== null || moving !== null
  const [dialog, setDialog] = useState<Dialog>(null)
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed)
  const toastTimer = useRef<number | undefined>(undefined)
  // เปลี่ยนธีมแล้ว Google Maps ต้องสร้างแผนที่ใหม่ — จำมุมกล้องไว้ไม่ให้เด้งกลับจุดเริ่มต้น
  const [camera, setCamera] = useState(() => readSavedCamera() ?? { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })

  const missions = useMissions()
  const refreshMissions = useRefreshMissions()
  const missionsDone = useRef<{ week: string; done: Set<string> } | null>(null)

  const catsQuery = useCatsInView(bounds)
  const cats = useMemo(() => catsQuery.data ?? [], [catsQuery.data])
  const upsertCat = useUpsertCat()

  const adminCounts = useQuery({
    queryKey: ['adminCounts'],
    queryFn: fetchAdminCounts,
    enabled: isAdmin,
    refetchInterval: 60_000,
  })
  const pendingReports = (adminCounts.data?.catReports ?? 0) + (adminCounts.data?.bugReports ?? 0) + (adminCounts.data?.photoReports ?? 0)

  // แมวที่เลือกอาจอยู่นอกกรอบแผนที่ (เช่นเปิดจากลิงก์แชร์) → โหลดแยกรายตัว
  const selectedFromList = cats.find((c) => c.id === selectedId)
  const selectedQuery = useCat(selectedId, !selectedFromList)
  const selectedCat = selectedFromList ?? selectedQuery.data ?? null

  const feedableIds = useMemo(() => cats.filter((c) => c.ownerStatus !== 'owned').map((c) => c.id), [cats])
  const fedToday = useQuery({
    queryKey: ['fedToday', feedableIds],
    queryFn: () => fetchFedToday(feedableIds),
    enabled: notFedToday,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const allIds = useMemo(() => cats.map((c) => c.id), [cats])
  const fewPhotos = useQuery({
    queryKey: ['fewPhotos', allIds],
    queryFn: () => fetchFewPhotos(allIds),
    enabled: fewPhotosOnly,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const visibleCats = useMemo(
    () =>
      cats.filter(
        (cat) =>
          (furColors.length === 0 || furColors.includes(cat.furColor)) &&
          (!seenToday || seenWithin(cat, 24)) &&
          (!friendlyOnly || cat.isFriendly) &&
          (!needsHelp || cat.helpKinds.length > 0) &&
          (!notFedToday || (cat.ownerStatus !== 'owned' && !(fedToday.data?.has(cat.id) ?? false))) &&
          (!staleOnly || !seenWithin(cat, 14 * 24)) &&
          (!fewPhotosOnly || (fewPhotos.data?.has(cat.id) ?? !cat.photoUrl)) &&
          matchesQuery(cat, query),
      ),
    [cats, furColors, seenToday, friendlyOnly, needsHelp, notFedToday, fedToday.data, staleOnly, fewPhotosOnly, fewPhotos.data, query],
  )
  const suggestions = useMemo(() => cats.filter((cat) => matchesQuery(cat, query)).slice(0, 6), [cats, query])
  const placeSearch = usePlaceSearch(query)

  // เลือกสถานที่ → ล้างคำค้น (ให้เห็นแมวทุกตัวแถวนั้น) แล้วซูมไปที่นั่น
  const selectPlace = async (suggestion: PlaceSuggestion) => {
    const place = await placeSearch.resolve(suggestion)
    if (!place || !map) return
    setQuery('')
    setSelectedId(null)
    setDroppedPin(null)
    setPlacePin(place)
    if (place.viewport) map.fitBounds(place.viewport)
    else map.panTo(place.position)
    // สถานที่เล็กๆ (ร้าน/ตึก) viewport แคบมาก → ไม่ซูมเกิน 18 / สถานที่ใหญ่ (จังหวัด) ก็ไม่ไกลกว่า 12 จะได้เห็นหมุดแมว
    google.maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom() ?? 16
      if (zoom > 18) map.setZoom(18)
      else if (zoom < 12) map.setZoom(12)
    })
  }

  // ปลุก server ตั้งแต่เปิดแผนที่ และทุกครั้งที่กลับมาที่แท็บ — พอจะปักหมุดจริง server จะได้ตื่นแล้ว
  useEffect(() => {
    wakeBackend()
    const onVisible = () => document.visibilityState === 'visible' && wakeBackend()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2500)
  }, [])

  // ภารกิจที่เพิ่งทำสำเร็จ → เด้งข้อความแสดงความยินดี (เทียบกับรอบก่อนในสัปดาห์เดียวกัน)
  useEffect(() => {
    const data = missions.data
    if (!data) return
    const done = new Set(data.missions.filter((m) => m.done).map((m) => m.key))
    const prev = missionsDone.current
    missionsDone.current = { week: data.weekStart, done }
    if (!prev || prev.week !== data.weekStart) return
    const fresh = data.missions.find((m) => m.done && !prev.done.has(m.key))
    if (!fresh) return
    showToast(
      data.allDone
        ? t('ทำครบทุกภารกิจแล้ว ได้เหรียญประจำสัปดาห์!')
        : t('ภารกิจสำเร็จ: {name}', { name: t(missionOf(fresh.key).label, { n: fresh.goal }) }),
    )
  }, [missions.data, showToast, t])

  const focusCat = useCallback(
    (cat: Cat) => {
      if (!map) return
      panWithOffset(map, cat.position, isDesktop ? DESKTOP_PANEL_OFFSET : { x: 0, y: window.innerHeight * 0.18 })
    },
    [map, isDesktop],
  )

  const selectCat = (cat: Cat) => {
    if (busy) return
    setDroppedPin(null)
    setSelectedId(cat.id)
    focusCat(cat)
  }

  const dismissHint = () => {
    setHintDismissed(true)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // private mode — แค่ไม่จำ
    }
  }

  const { consumeClick } = useMapLongPress(
    map,
    useCallback((position: LatLng) => {
      setSelectedId(null)
      setDroppedPin(position)
    }, []),
    !busy,
  )

  const startMoving = (cat: Cat, mode: 'move' | 'suggest' = 'move', request?: MoveRequest) => {
    if (mode === 'suggest' && !requireLogin(t('เข้าสู่ระบบเพื่อเสนอตำแหน่งใหม่ของหมุด'))) return
    setDialog(null)
    setSelectedId(null)
    setDroppedPin(null)
    setPlacePin(null)
    setMoving({ cat, mode, start: request?.position ?? cat.position, request })
  }

  const startMovingRef = useRef(startMoving)
  useEffect(() => {
    startMovingRef.current = startMoving
  })

  const finishMoving = (cat: Cat) => {
    setMoving(null)
    setMovingSaving(false)
    setSelectedId(cat.id)
    focusCat(cat)
  }

  const saveMove = async (position: LatLng) => {
    if (!moving || movingSaving) return
    const { cat, mode, request } = moving
    let note = ''
    if (mode === 'suggest') {
      const text = await promptText({
        title: t('ส่งตำแหน่งนี้ให้คนปักหมุด?'),
        message: t('คนปักหมุดจะได้รับแจ้งเตือน แล้วเลือกว่าจะย้ายตามนี้ไหม'),
        placeholder: t('บอกเหตุผลสั้นๆ เช่น น้องย้ายไปอยู่อีกฝั่งถนน (ไม่บังคับ)'),
        maxLength: 200,
        confirmLabel: t('ส่ง'),
      })
      if (text === null) return
      note = text.trim()
    }
    setMovingSaving(true)
    try {
      if (mode === 'suggest') {
        await requestMove(cat.id, position, note)
        finishMoving(cat)
        showToast(t('ส่งตำแหน่งให้คนปักหมุดแล้ว ขอบคุณที่ช่วยนะ'))
        return
      }
      const result = await moveCat(cat.id, position, request?.id)
      const moved = { ...cat, ...result }
      upsertCat(moved)
      if (request) queryClient.invalidateQueries({ queryKey: ['moveRequests', cat.id] })
      finishMoving(moved)
      showToast(t('ย้ายหมุด{name}แล้ว', { name: cat.name }))
    } catch (e) {
      setMovingSaving(false)
      showToast(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'))
    }
  }

  const startAdding = (start: AddCatStart) => {
    if (!droppedPin) return
    setAdding({ origin: droppedPin, start })
    setDroppedPin(null)
    dismissHint()
  }
  const closeAddCat = useCallback(() => setAdding(null), [])

  // ผู้ใช้บอกว่าเป็นน้องที่ปักไว้แล้ว: เปิดหมุดเดิม (นับการเจอ + รูปเข้าอัลบั้มไปแล้ว)
  const handleCatMatched = (cat: Cat, sighting: { sightings: number; lastSeenAt: string } | null) => {
    const updated = sighting ? { ...cat, sightings: sighting.sightings, lastSeenAt: sighting.lastSeenAt } : cat
    upsertCat(updated)
    queryClient.invalidateQueries({ queryKey: ['catPhotos', cat.id] })
    setAdding(null)
    setSelectedId(cat.id)
    focusCat(updated)
    showToast(t('บันทึกแล้วว่าคุณเจอ{name}', { name: cat.name }))
    refreshMissions()
  }

  const handleCatAdded = (cat: Cat) => {
    upsertCat(cat)
    setAdding(null)
    // ล้างตัวกรองให้เห็นหมุดใหม่แน่นอน
    setQuery('')
    setFurColors([])
    setSeenToday(false)
    setFriendlyOnly(false)
    setNeedsHelp(false)
    setNotFedToday(false)
    setStaleOnly(false)
    setFewPhotosOnly(false)
    setSelectedId(cat.id)
    focusCat(cat)
    showToast(t('ปักหมุด{name}แล้ว', { name: cat.name }))
    refreshMissions()
  }

  // เปิดลิงก์แชร์ ?cat=xxx แล้วซูมไปที่แมวตัวนั้น
  const initialCatHandled = useRef(false)
  useEffect(() => {
    if (!map || initialCatHandled.current) return
    if (!selectedId) {
      initialCatHandled.current = true
      return
    }
    if (selectedCat) {
      initialCatHandled.current = true
      map.setZoom(17)
      focusCat(selectedCat)
    } else if (selectedQuery.isSuccess) {
      initialCatHandled.current = true
      // ลิงก์เก่าหรือ id ผิด: ไม่ต้องค้างแผงว่างไว้
      queueMicrotask(() => {
        setSelectedId(null)
        showToast(t('ไม่พบน้องแมวจากลิงก์นี้'))
      })
    }
  }, [map, selectedId, selectedCat, selectedQuery.isSuccess, focusCat, showToast, t])

  // sync ตัวที่เลือกไว้กับ URL เพื่อให้กด back / แชร์ลิงก์ได้
  useEffect(() => {
    const url = new URL(window.location.href)
    if (selectedId) url.searchParams.set('cat', selectedId)
    else url.searchParams.delete('cat')
    window.history.replaceState(null, '', url)
  }, [selectedId])

  const locateMe = () => {
    if (!navigator.geolocation) return showToast(t('เบราว์เซอร์นี้หาตำแหน่งไม่ได้'))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude }
        setUserPosition(position)
        map?.panTo(position)
        map?.setZoom(17)
      },
      () => showToast(t('เปิดสิทธิ์เข้าถึงตำแหน่งก่อน แล้วลองใหม่อีกครั้ง')),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const startedAtUser = useRef(false)
  useEffect(() => {
    if (!map || !startAtUser || startedAtUser.current || !navigator.geolocation) return
    startedAtUser.current = true
    // ไม่อนุญาตตำแหน่งก็อยู่ที่จุดเริ่มต้นเดิมเงียบๆ (ไม่ต้องเตือน)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude }
        setUserPosition(position)
        map.panTo(position)
        map.setZoom(16)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [map, startAtUser])

  /** คืน true ถ้าบันทึกสำเร็จ (ปุ่มจะเล่นเอฟเฟกต์อุ้งเท้า) */
  const markSighting = async (cat: Cat): Promise<boolean> => {
    if (!requireLogin(t('เข้าสู่ระบบเพื่อบันทึกว่าคุณเจอ{name}', { name: cat.name }))) return false
    try {
      // ต้องอยู่ใกล้น้อง — ฐานข้อมูลเช็กระยะเอง
      const fix = await getCurrentPosition(10_000)
      const result = await recordSighting(cat.id, fix)
      upsertCat({ ...cat, sightings: result.sightings, lastSeenAt: result.lastSeenAt })
      showToast(t('บันทึกแล้วว่าคุณเจอ{name}', { name: cat.name }))
      refreshMissions()
      return true
    } catch (e) {
      showToast(errorText(e, t, lang))
      return false
    }
  }

  const removeCat = async (cat: Cat) => {
    if (!(await confirmAction({ title: t('ลบหมุด "{name}" ถาวร?', { name: cat.name }), message: t('รีวิวและประวัติการเจอจะหายไปด้วย'), confirmLabel: t('ลบหมุด'), tone: 'danger' }))) return
    try {
      await deleteCat(cat.id)
      setSelectedId(null)
      setDialog((d) => (d?.kind === 'editCat' ? null : d))
      queryClient.setQueriesData<Cat[]>({ queryKey: ['cats'] }, (list) => list?.filter((c) => c.id !== cat.id))
      queryClient.removeQueries({ queryKey: ['cat', cat.id] })
      queryClient.invalidateQueries({ queryKey: ['adminCounts'] })
      showToast(t('ลบหมุด{name}แล้ว', { name: cat.name }))
    } catch (e) {
      showToast(t(e instanceof Error ? e.message : 'ลบไม่สำเร็จ'))
    }
  }

  const reportCat = (cat: Cat) => {
    if (requireLogin(t('เข้าสู่ระบบเพื่อรายงานหมุดนี้'))) setDialog({ kind: 'catReport', cat })
  }

  // ปุ่มแชร์ในหน้าน้อง → เลือกได้ว่าจะแชร์เป็นรูป story หรือแชร์ลิงก์
  const shareCat = (cat: Cat) => setDialog({ kind: 'shareCat', cat })

  const shareCatLink = async (cat: Cat) => {
    // /c/:id = หน้าที่มีรูปตัวอย่างให้ LINE/Facebook (คนกดจะถูกส่งต่อไปหน้าน้องเอง — ดู api/share.ts)
    const url = `${window.location.origin}/c/${cat.id}`
    const data = {
      title: t('{name} บน MeowPin', { name: cat.name }),
      text: cat.placeName ? t('มาดู{name} ที่{place}', { name: cat.name, place: cat.placeName }) : cat.name,
      url,
    }
    if (navigator.share) {
      try {
        await navigator.share(data)
      } catch {
        // ผู้ใช้กดยกเลิกการแชร์
      }
      return
    }
    await navigator.clipboard.writeText(url)
    showToast(t('คัดลอกลิงก์แล้ว'))
  }

  const openCatById = useCallback((catId: string) => {
    setDialog(null)
    setDroppedPin(null)
    // ถ้าแมวอยู่นอกกรอบแผนที่ useCat จะโหลดให้ แล้ว effect ด้านบนเลื่อนไปหา
    initialCatHandled.current = false
    setSelectedId(catId)
  }, [])

  const mapActions = useMemo<MapActions>(
    () => ({
      openProfile: (id) => setDialog({ kind: 'userProfile', userId: id }),
      openCat: openCatById,
      editCat: (cat) => setDialog({ kind: 'editCat', cat }),
      moveCat: (cat, request) => startMovingRef.current(cat, 'move', request),
      suggestMove: (cat) => startMovingRef.current(cat, 'suggest'),
      applyFilter: (filter) => {
        setDialog(null)
        setSelectedId(null)
        if (filter === 'stale') setStaleOnly(true)
        if (filter === 'fewPhotos') setFewPhotosOnly(true)
        if (filter === 'notFed') setNotFedToday(true)
        if (filter === 'needsHelp') setNeedsHelp(true)
      },
    }),
    [openCatById],
  )

  const updateCamera = (gmap: google.maps.Map) => {
    const center = gmap.getCenter()?.toJSON()
    const zoom = gmap.getZoom()
    if (center && zoom !== undefined) {
      setCamera({ center, zoom })
      try {
        sessionStorage.setItem(CAMERA_KEY, JSON.stringify({ center, zoom }))
      } catch {
        // private mode — แค่ไม่จำ
      }
    }
    const literal = gmap.getBounds()?.toJSON()
    if (!literal) return
    const next = snapBounds(literal)
    setBounds((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }

  const sheetOpen = !isDesktop && (selectedCat !== null || droppedPin !== null)
  const showHint = !hintDismissed && !busy && !droppedPin && !selectedCat

  return (
    <MapActionsContext.Provider value={mapActions}>
      <div className="relative h-full w-full overflow-hidden bg-page">
        <Map
          // ธีมมืด/สว่างของ Google Maps ตั้งได้ตอนสร้างแผนที่เท่านั้น
          key={theme}
          className="h-full w-full"
          mapId={mapId}
          colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
          defaultCenter={camera.center}
          defaultZoom={camera.zoom}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl={isDesktop}
          clickableIcons={false}
          onClick={() => {
            if (busy || consumeClick()) return
            setSelectedId(null)
            setDroppedPin(null)
            setPlacePin(null)
          }}
          onIdle={(e) => updateCamera(e.map)}
        >
          <CatMarkers cats={visibleCats} selectedId={selectedId} onSelect={selectCat} />
          {userPosition && <UserLocationMarker position={userPosition} />}
          {placePin && !busy && (
            <PlaceMarker
              position={placePin.position}
              name={placePin.name}
              onClick={() => {
                setSelectedId(null)
                setDroppedPin(placePin.position)
              }}
            />
          )}
          {droppedPin && !busy && (
            <DroppedPin
              position={droppedPin}
              onClose={() => setDroppedPin(null)}
              onCamera={() => startAdding({ kind: 'camera' })}
              onFile={(file) => startAdding({ kind: 'upload', file })}
            />
          )}
        </Map>

        {!busy && (
          <>
            {/* เว้นที่ขวาบนให้ปุ่มโปรไฟล์ (48px + ระยะขอบ) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-4 pr-20 md:flex-row md:items-start md:gap-3">
              <div className="pointer-events-auto md:w-[380px] md:shrink-0">
                <SearchBar
                  query={query}
                  onQueryChange={setQuery}
                  suggestions={suggestions}
                  onSelect={selectCat}
                  places={placeSearch.places}
                  onSelectPlace={selectPlace}
                  onPhotoSearch={() => requireLogin(t('เข้าสู่ระบบเพื่อค้นหาด้วยรูป')) && setDialog({ kind: 'photoSearch' })}
                />
              </div>
              <div className="pointer-events-auto -mr-16 min-w-0 md:mr-0 md:pt-1.5">
                <FilterChips
                  furColors={furColors}
                  onFurColorsChange={setFurColors}
                  seenToday={seenToday}
                  onSeenTodayChange={setSeenToday}
                  friendlyOnly={friendlyOnly}
                  onFriendlyOnlyChange={setFriendlyOnly}
                  needsHelp={needsHelp}
                  onNeedsHelpChange={setNeedsHelp}
                  notFedToday={notFedToday}
                  onNotFedTodayChange={setNotFedToday}
                  staleOnly={staleOnly}
                  onStaleOnlyChange={setStaleOnly}
                  fewPhotosOnly={fewPhotosOnly}
                  onFewPhotosOnlyChange={setFewPhotosOnly}
                />
              </div>
            </div>
            {/* z-40: อยู่เหนือการ์ดน้องแมว (z-30) — กดเมนูตอนการ์ดเปิดอยู่จะไม่โดนบัง */}
            <div className="absolute top-4 right-4 z-40">
              <AccountMenu
                pendingReports={pendingReports}
                onOpenMyProfile={() => userId && setDialog({ kind: 'userProfile', userId })}
                onReportBug={() => setDialog({ kind: 'bugReport' })}
                onOpenAdmin={() => setDialog({ kind: 'admin' })}
                onSupport={() => setDialog({ kind: 'support' })}
                onOpenLeaderboard={() => setDialog({ kind: 'leaderboard' })}
                onOpenPosts={() => setDialog({ kind: 'posts' })}
              />
            </div>
          </>
        )}

        {!busy && !sheetOpen && missions.data && (
          <button
            type="button"
            onClick={() => setDialog({ kind: 'missions' })}
            className={`absolute right-4 z-20 flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium shadow-md ring-1 transition-[bottom] md:right-16 ${
              missions.data.allDone ? 'bg-emerald-500 text-white ring-emerald-500 hover:bg-emerald-600' : 'bg-surface text-stone-800 ring-stone-200 hover:bg-stone-50'
            } ${showHint ? 'bottom-[11rem] md:bottom-[8.25rem]' : 'bottom-[8.25rem]'}`}
          >
            {missions.data.allDone ? <Check size={17} aria-hidden="true" /> : <Target size={17} className="text-orange-500" aria-hidden="true" />}
            {missions.data.allDone
              ? t('ภารกิจครบแล้ว')
              : t('ภารกิจ {done}/{total}', { done: missions.data.missions.filter((m) => m.done).length, total: missions.data.missions.length })}
          </button>
        )}
        {!busy && !sheetOpen && (
          <button
            type="button"
            onClick={() => setDialog({ kind: 'nearby' })}
            // แถบคำแนะนำ "กดค้าง…" แสดงอยู่ → ขยับขึ้นไม่ให้ทับกัน
            className={`absolute right-4 z-20 flex h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-medium text-stone-800 shadow-md ring-1 ring-stone-200 transition-[bottom] hover:bg-stone-50 md:right-16 ${
              showHint ? 'bottom-[8rem] md:bottom-[5.25rem]' : 'bottom-[5.25rem]'
            }`}
          >
            <Footprints size={17} className="text-orange-500" aria-hidden="true" />
            {t('แมวใกล้ฉัน')}
          </button>
        )}
        {!busy && !sheetOpen && (
          <button
            type="button"
            onClick={locateMe}
            className="absolute right-4 bottom-6 z-20 flex size-12 items-center justify-center rounded-full bg-surface text-sky-600 shadow-md ring-1 ring-stone-200 hover:bg-stone-50 md:right-16"
            aria-label={t('ไปที่ตำแหน่งของฉัน')}
          >
            <LocateFixed size={22} />
          </button>
        )}

        {showHint && (
          <div className="absolute bottom-6 left-1/2 z-20 flex max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 py-2 pr-2 pl-4 text-sm text-white shadow-lg md:max-w-none">
            <Hand size={16} className="shrink-0" aria-hidden="true" />
            <span>
              {t(isDesktop ? 'คลิกขวาบนแผนที่ตรงที่เจอแมว เพื่อปักหมุด' : 'กดค้างบนแผนที่ตรงที่เจอแมว เพื่อปักหมุด')}
            </span>
            <button
              type="button"
              onClick={dismissHint}
              className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label={t('ซ่อนคำแนะนำ')}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {isDesktop ? (
          selectedCat && (
            <CatPanel
              key={selectedCat.id}
              cat={selectedCat}
              onClose={() => setSelectedId(null)}
              onSighting={markSighting}
              onShare={shareCat}
              onDelete={removeCat}
              onReport={reportCat}
            />
          )
        ) : (
          <CatSheet
            cat={selectedCat}
            onClose={() => setSelectedId(null)}
            onSighting={markSighting}
            onShare={shareCat}
            onDelete={removeCat}
            onReport={reportCat}
          />
        )}

        {moving && (
          <LocationPicker
            initialPosition={moving.start}
            verification={moving.mode === 'move' ? moving.cat.verification : undefined}
            title={t(moving.mode === 'move' ? 'ย้ายหมุดน้อง{name}' : 'น้อง{name}อยู่ตรงไหน', { name: moving.cat.name })}
            hint={
              moving.mode === 'suggest'
                ? t('เลื่อนแผนที่ให้หมุดอยู่ตรงจุดที่น้องอยู่จริง แล้วเราจะส่งให้คนปักหมุดตัดสินใจ')
                : moving.request
                  ? t('{name} เสนอตำแหน่งนี้ไว้ ขยับได้ถ้ายังไม่ตรง', { name: moving.request.requesterName ?? t('ผู้ใช้') })
                  : t(
                      moving.cat.verification !== 'manual'
                        ? 'เลื่อนแผนที่ให้หมุดอยู่ตรงจุดใหม่ — ถ้าย้ายเกิน 50 ม. ป้ายยืนยันตำแหน่งจะหายไป'
                        : 'เลื่อนแผนที่ให้หมุดอยู่ตรงจุดใหม่',
                    )
            }
            confirmLabel={t(moving.mode === 'move' ? 'ย้ายมาที่นี่' : 'เสนอตำแหน่งนี้')}
            busy={movingSaving}
            onBack={() => finishMoving(moving.cat)}
            onConfirm={saveMove}
          />
        )}

        {adding && (
          <Suspense fallback={null}>
            <AddCatFlow origin={adding.origin} start={adding.start} onClose={closeAddCat} onAdded={handleCatAdded} onMatched={handleCatMatched} />
          </Suspense>
        )}

        {dialog?.kind === 'profile' && (
          <ProfileDialog
            onClose={() => setDialog(null)}
            onSaved={() => {
              setDialog(null)
              showToast(t('บันทึกโปรไฟล์แล้ว'))
            }}
          />
        )}
        {dialog?.kind === 'userProfile' && (
          <UserProfileDialog
            userId={dialog.userId}
            onClose={() => setDialog(null)}
            onEditProfile={() => setDialog({ kind: 'profile' })}
          />
        )}
        {dialog?.kind === 'support' && <SupportDialog onClose={() => setDialog(null)} />}
        {dialog?.kind === 'bugReport' && (
          <BugReportDialog
            onClose={() => setDialog(null)}
            onSent={() => {
              setDialog(null)
              showToast(t('ส่งรายงานแล้ว ขอบคุณที่ช่วยกันนะ'))
            }}
          />
        )}
        {dialog?.kind === 'posts' && bounds && <PostsDialog bounds={bounds} onClose={() => setDialog(null)} />}
        {dialog?.kind === 'photoSearch' && bounds && (
          <PhotoSearchDialog
            bounds={bounds}
            userPosition={userPosition}
            onClose={() => setDialog(null)}
            onOpenCat={(cat) => {
              setDialog(null)
              upsertCat(cat)
              setSelectedId(cat.id)
              focusCat(cat)
            }}
          />
        )}
        {dialog?.kind === 'nearby' && (
          <NearbyCatsDialog
            userPosition={userPosition}
            onPosition={setUserPosition}
            onClose={() => setDialog(null)}
            onOpenCat={(cat) => {
              setDialog(null)
              upsertCat(cat)
              setSelectedId(cat.id)
              focusCat(cat)
            }}
          />
        )}
        {dialog?.kind === 'missions' && (
          <Modal title={t('ภารกิจสัปดาห์นี้')} onClose={() => setDialog(null)}>
            <MissionsCard hideTitle />
          </Modal>
        )}
        {dialog?.kind === 'shareCat' && (
          <ShareCardDialog
            title={t('แชร์น้อง{name}', { name: dialog.cat.name })}
            fileName={`meowpin-${dialog.cat.name}.png`}
            text={t('มาดู{name}บน MeowPin', { name: dialog.cat.name })}
            onClose={() => setDialog(null)}
            make={() =>
              drawCatCard(
                {
                  name: dialog.cat.name,
                  photoUrl: dialog.cat.photoUrl,
                  place: dialog.cat.placeName,
                  zone: null,
                  sightings: dialog.cat.sightings,
                  furLabel: t('แมว{fur}', { fur: t(furLabel(dialog.cat)) }),
                },
                lang,
              )
            }
            extra={
              <button
                type="button"
                onClick={() => shareCatLink(dialog.cat)}
                className="flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
              >
                <Link2 size={16} aria-hidden="true" />
                {t('แชร์ลิงก์ (มีรูปตัวอย่างใน LINE/Facebook)')}
              </button>
            }
          />
        )}
        {dialog?.kind === 'leaderboard' && bounds && (
          <LeaderboardDialog bounds={bounds} onClose={() => setDialog(null)} />
        )}
        {dialog?.kind === 'editCat' && (
          <EditCatDialog
            cat={dialog.cat}
            onClose={() => setDialog(null)}
            onDelete={removeCat}
            onMove={(cat) => startMoving(cat)}
            onSaved={(cat) => {
              setDialog(null)
              showToast(t('บันทึกการแก้ไขหมุด{name}แล้ว', { name: cat.name }))
            }}
          />
        )}
        {dialog?.kind === 'catReport' && (
          <CatReportDialog
            cat={dialog.cat}
            onClose={() => setDialog(null)}
            onSent={() => {
              setDialog(null)
              showToast(t('ส่งรายงานแล้ว ทีมงานจะตรวจสอบหมุดนี้'))
            }}
          />
        )}
        {dialog?.kind === 'admin' && (
          <AdminDialog counts={adminCounts.data} onClose={() => setDialog(null)} onOpenCat={openCatById} />
        )}

        {catsQuery.isError && (
          <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1.5 text-xs text-red-700 shadow ring-1 ring-red-200">
            {t('โหลดข้อมูลแมวไม่สำเร็จ')}
          </div>
        )}

        <Toast message={toast} />
      </div>
    </MapActionsContext.Provider>
  )
}
