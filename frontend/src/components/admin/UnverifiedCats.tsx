import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ShieldCheck, Trash2 } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { deleteCat, fetchUnverifiedCats, verifyCat } from '../../lib/api'
import { furLabel, timeAgo } from '../../lib/cat'
import { CatAvatar } from '../CatAvatar'
import { confirmAction } from '../../lib/dialogs'

/** หมุดที่ระบบไม่แน่ใจว่าเป็นแมว แต่ผู้ใช้ยืนยันเอง — admin ตรวจแล้วยืนยันหรือลบ */
export function UnverifiedCats({ onOpenCat }: { onOpenCat: (catId: string) => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const cats = useQuery({ queryKey: ['unverifiedCats'], queryFn: fetchUnverifiedCats })
  const refresh = () => {
    for (const key of ['unverifiedCats', 'cats', 'catReports', 'adminCounts']) queryClient.invalidateQueries({ queryKey: [key] })
  }
  const verify = useMutation({ mutationFn: verifyCat, onSuccess: refresh })
  const remove = useMutation({ mutationFn: deleteCat, onSuccess: refresh })

  if (cats.isPending) return <p className="py-8 text-center text-sm text-stone-500">{t('กำลังโหลด…')}</p>
  if (!cats.data?.length) return <p className="py-8 text-center text-sm text-stone-500">{t('ไม่มีหมุดที่รอตรวจ')}</p>

  return (
    <ul className="flex flex-col gap-2">
      {cats.data.map((cat) => (
        <li key={cat.id} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-stone-200">
          <button type="button" onClick={() => onOpenCat(cat.id)} className="shrink-0" title={t('เปิดหมุด')}>
            <CatAvatar cat={cat} className="size-20 rounded-xl" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-stone-900">{cat.name}</p>
            <p className="truncate text-xs text-stone-500">
              {t(furLabel(cat))} · {cat.createdByName ?? t('ผู้ใช้')} · {timeAgo(cat.lastSeenAt, lang)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={verify.isPending}
                onClick={() => verify.mutate(cat.id)}
                className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <ShieldCheck size={14} aria-hidden="true" />
                {t('เป็นแมวจริง')}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={async () => (await confirmAction({ title: t('ลบหมุด "{name}" ถาวร?', { name: cat.name }), message: t('รีวิวและประวัติการเจอจะหายไปด้วย'), confirmLabel: t('ลบหมุด'), tone: 'danger' })) && remove.mutate(cat.id)}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={14} aria-hidden="true" />
                {t('ลบ')}
              </button>
              <button
                type="button"
                onClick={() => onOpenCat(cat.id)}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
              >
                <ExternalLink size={14} aria-hidden="true" />
                {t('เปิดหมุด')}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
