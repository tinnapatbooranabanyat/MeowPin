import { Map, useMap } from '@vis.gl/react-google-maps'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Hand, LocateFixed, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { snapBounds, useCat, useCatsInView, useUpsertCat } from '../hooks/useCats'
import { useI18n } from '../hooks/useI18n'
import { MapActionsContext, type MapActions } from '../hooks/useMapActions'
import { useMapLongPress } from '../hooks/useMapLongPress'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { deleteCat, fetchAdminCounts, recordSighting, wakeBackend, type Bounds } from '../lib/api'
import { matchesQuery, seenWithin } from '../lib/cat'
import type { Cat, FurColor, LatLng } from '../types'
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
import { CatSheet } from './CatSheet'
import { DroppedPin } from './DroppedPin'
import { FilterChips } from './FilterChips'
import { SearchBar } from './SearchBar'
import { Toast } from './Toast'
import { UserLocationMarker } from './UserLocationMarker'

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
  | null

export function MapScreen({ mapId }: Props) {
  const map = useMap()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { requireLogin, isAdmin, userId } = useAuth()
  const { t } = useI18n()
  const { resolved: theme } = useTheme()
  const queryClient = useQueryClient()

  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('cat'),
  )
  const [query, setQuery] = useState('')
  const [furColor, setFurColor] = useState<FurColor | null>(null)
  const [seenToday, setSeenToday] = useState(false)
  const [friendlyOnly, setFriendlyOnly] = useState(false)
  const [needsHelp, setNeedsHelp] = useState(false)
  const [userPosition, setUserPosition] = useState<LatLng | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [droppedPin, setDroppedPin] = useState<LatLng | null>(null)
  const [adding, setAdding] = useState<{ origin: LatLng; start: AddCatStart } | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed)
  const toastTimer = useRef<number | undefined>(undefined)
  // เปลี่ยนธีมแล้ว Google Maps ต้องสร้างแผนที่ใหม่ — จำมุมกล้องไว้ไม่ให้เด้งกลับจุดเริ่มต้น
  const [camera, setCamera] = useState(() => readSavedCamera() ?? { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })

  const catsQuery = useCatsInView(bounds)
  const cats = useMemo(() => catsQuery.data ?? [], [catsQuery.data])
  const upsertCat = useUpsertCat()

  const adminCounts = useQuery({
    queryKey: ['adminCounts'],
    queryFn: fetchAdminCounts,
    enabled: isAdmin,
    refetchInterval: 60_000,
  })
  const pendingReports = (adminCounts.data?.catReports ?? 0) + (adminCounts.data?.bugReports ?? 0)

  // แมวที่เลือกอาจอยู่นอกกรอบแผนที่ (เช่นเปิดจากลิงก์แชร์) → โหลดแยกรายตัว
  const selectedFromList = cats.find((c) => c.id === selectedId)
  const selectedQuery = useCat(selectedId, !selectedFromList)
  const selectedCat = selectedFromList ?? selectedQuery.data ?? null

  const visibleCats = useMemo(
    () =>
      cats.filter(
        (cat) =>
          (furColor === null || cat.furColor === furColor) &&
          (!seenToday || seenWithin(cat, 24)) &&
          (!friendlyOnly || cat.isFriendly) &&
          (!needsHelp || cat.helpKinds.length > 0) &&
          matchesQuery(cat, query),
      ),
    [cats, furColor, seenToday, friendlyOnly, needsHelp, query],
  )
  const suggestions = useMemo(() => cats.filter((cat) => matchesQuery(cat, query)).slice(0, 6), [cats, query])

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

  const focusCat = useCallback(
    (cat: Cat) => {
      if (!map) return
      panWithOffset(map, cat.position, isDesktop ? DESKTOP_PANEL_OFFSET : { x: 0, y: window.innerHeight * 0.18 })
    },
    [map, isDesktop],
  )

  const selectCat = (cat: Cat) => {
    if (adding) return
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
    adding === null,
  )

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
  }

  const handleCatAdded = (cat: Cat) => {
    upsertCat(cat)
    setAdding(null)
    // ล้างตัวกรองให้เห็นหมุดใหม่แน่นอน
    setQuery('')
    setFurColor(null)
    setSeenToday(false)
    setFriendlyOnly(false)
    setNeedsHelp(false)
    setSelectedId(cat.id)
    focusCat(cat)
    showToast(t('ปักหมุด{name}แล้ว', { name: cat.name }))
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

  /** คืน true ถ้าบันทึกสำเร็จ (ปุ่มจะเล่นเอฟเฟกต์อุ้งเท้า) */
  const markSighting = async (cat: Cat): Promise<boolean> => {
    if (!requireLogin(t('เข้าสู่ระบบเพื่อบันทึกว่าคุณเจอ{name}', { name: cat.name }))) return false
    try {
      const result = await recordSighting(cat.id)
      upsertCat({ ...cat, sightings: result.sightings, lastSeenAt: result.lastSeenAt })
      showToast(t('บันทึกแล้วว่าคุณเจอ{name}', { name: cat.name }))
      return true
    } catch (e) {
      showToast(t(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'))
      return false
    }
  }

  const removeCat = async (cat: Cat) => {
    if (!window.confirm(t('ลบหมุด "{name}" ถาวร? รีวิวและประวัติการเจอจะหายไปด้วย', { name: cat.name }))) return
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

  const shareCat = async (cat: Cat) => {
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
  const showHint = !hintDismissed && !adding && !droppedPin && !selectedCat

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
            if (adding || consumeClick()) return
            setSelectedId(null)
            setDroppedPin(null)
          }}
          onIdle={(e) => updateCamera(e.map)}
        >
          <CatMarkers cats={visibleCats} selectedId={selectedId} onSelect={selectCat} />
          {userPosition && <UserLocationMarker position={userPosition} />}
          {droppedPin && !adding && (
            <DroppedPin
              position={droppedPin}
              onClose={() => setDroppedPin(null)}
              onCamera={() => startAdding({ kind: 'camera' })}
              onFile={(file) => startAdding({ kind: 'upload', file })}
            />
          )}
        </Map>

        {!adding && (
          <>
            {/* เว้นที่ขวาบนให้ปุ่มโปรไฟล์ (48px + ระยะขอบ) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-4 pr-20 md:flex-row md:items-start md:gap-3">
              <div className="pointer-events-auto md:w-[380px] md:shrink-0">
                <SearchBar query={query} onQueryChange={setQuery} suggestions={suggestions} onSelect={selectCat} />
              </div>
              <div className="pointer-events-auto -mr-16 min-w-0 md:mr-0 md:pt-1.5">
                <FilterChips
                  furColor={furColor}
                  onFurColorChange={setFurColor}
                  seenToday={seenToday}
                  onSeenTodayChange={setSeenToday}
                  friendlyOnly={friendlyOnly}
                  onFriendlyOnlyChange={setFriendlyOnly}
                  needsHelp={needsHelp}
                  onNeedsHelpChange={setNeedsHelp}
                />
              </div>
            </div>
            <div className="absolute top-4 right-4 z-30">
              <AccountMenu
                pendingReports={pendingReports}
                onOpenMyProfile={() => userId && setDialog({ kind: 'userProfile', userId })}
                onEditProfile={() => setDialog({ kind: 'profile' })}
                onReportBug={() => setDialog({ kind: 'bugReport' })}
                onOpenAdmin={() => setDialog({ kind: 'admin' })}
                onSupport={() => setDialog({ kind: 'support' })}
                onOpenLeaderboard={() => setDialog({ kind: 'leaderboard' })}
              />
            </div>
          </>
        )}

        {!adding && !sheetOpen && (
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
        {dialog?.kind === 'leaderboard' && bounds && (
          <LeaderboardDialog bounds={bounds} onClose={() => setDialog(null)} />
        )}
        {dialog?.kind === 'editCat' && (
          <EditCatDialog
            cat={dialog.cat}
            onClose={() => setDialog(null)}
            onDelete={removeCat}
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
