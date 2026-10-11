import { useQueryClient } from '@tanstack/react-query'
import { BellOff, CheckCircle2, EyeOff, HeartPulse, PawPrint } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../hooks/useI18n'
import { useMapActions } from '../../hooks/useMapActions'
import { useNotifications } from '../../hooks/useNotifications'
import { markNotificationsRead } from '../../lib/api'
import { HELP_KINDS, timeAgo } from '../../lib/cat'
import type { AppNotification, HelpKind } from '../../types'
import { Modal } from '../ui/Modal'

const ICONS = {
  new_review: { icon: PawPrint, tone: 'bg-amber-100 text-amber-700' },
  help_request: { icon: HeartPulse, tone: 'bg-red-100 text-red-700' },
  help_resolved: { icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-700' },
  not_seen: { icon: EyeOff, tone: 'bg-stone-200 text-stone-700' },
}

function useNotificationText() {
  const { t } = useI18n()
  return (n: AppNotification) => {
    const cat = n.data.cat_name ?? t('น้องแมว')
    const actor = n.data.actor_name ?? t('มีคน')
    switch (n.kind) {
      case 'new_review':
        return t('{actor} รีวิว{cat} ให้ {paws} อุ้งเท้า', { actor, cat, paws: n.data.paws ?? '?' })
      case 'help_request':
        return t('{actor} แจ้งว่า{cat}ต้องการความช่วยเหลือ: {kind}', {
          actor,
          cat,
          kind: t(HELP_KINDS[n.data.help_kind as HelpKind]?.label ?? 'อื่นๆ'),
        })
      case 'help_resolved':
        return t('{cat} ได้รับความช่วยเหลือแล้ว', { cat })
      case 'not_seen':
        return t('ไม่มีใครเจอ{cat} มา {days} วันแล้ว ถ้าผ่านไปแถวนั้นช่วยดูน้องหน่อยนะ', { cat, days: n.data.days ?? 14 })
    }
  }
}

export function NotificationsDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()
  const { userId } = useAuth()
  const { openCat } = useMapActions()
  const queryClient = useQueryClient()
  const { items, unread, isPending } = useNotifications()
  const text = useNotificationText()

  // เปิดดูแล้ว = อ่านแล้ว (ตัวหนาจะยังค้างไว้จนปิดหน้าต่าง ให้รู้ว่าอันไหนใหม่)
  useEffect(() => {
    if (!unread) return
    markNotificationsRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- อ่านครั้งเดียวตอนเปิด
  }, [])

  return (
    <Modal title={t('การแจ้งเตือน')} onClose={onClose}>
      {isPending && <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>}
      {!isPending && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-stone-500">
          <BellOff size={28} aria-hidden="true" />
          <p>{t('ยังไม่มีการแจ้งเตือน')}</p>
          <p className="text-xs">{t('กด "ติดตาม" ที่หน้าน้องแมว เพื่อรู้เมื่อมีรีวิวใหม่ มีคนแจ้งว่าน้องต้องการความช่วยเหลือ หรือไม่มีใครเจอน้องนานเกิน 2 สัปดาห์')}</p>
        </div>
      )}
      <ul className="flex flex-col">
        {items.map((n) => {
          const meta = ICONS[n.kind]
          const Icon = meta.icon
          return (
            <li key={n.id}>
              <button
                type="button"
                disabled={!n.catId}
                onClick={() => {
                  if (!n.catId) return
                  onClose()
                  openCat(n.catId)
                }}
                className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-stone-50 disabled:cursor-default"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.readAt ? 'text-stone-700' : 'font-medium text-stone-900'}`}>{text(n)}</span>
                  <span className="text-xs text-stone-500">{timeAgo(n.createdAt, lang)}</span>
                </span>
                {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-orange-500" aria-label={t('ใหม่')} />}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
