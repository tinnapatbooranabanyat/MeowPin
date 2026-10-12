import { AlertTriangle, CircleHelp } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { getDialog, settleDialog, subscribeDialogs } from '../../lib/dialogs'

/** แสดงหน้าต่างยืนยัน/ถามข้อความของแอป (เรียกผ่าน confirmAction / promptText) — อยู่เหนือทุกหน้าต่าง */
export function DialogHost() {
  const dialog = useSyncExternalStore(subscribeDialogs, getDialog)
  if (!dialog) return null
  // key: หน้าต่างใหม่ได้ช่องพิมพ์ใหม่ทุกครั้ง
  return <DialogView key={dialog.id} />
}

function DialogView() {
  const { t } = useI18n()
  const dialog = getDialog()!
  const { options } = dialog
  const danger = options.tone === 'danger'
  const [text, setText] = useState('')

  const confirm = () => settleDialog(dialog.kind === 'prompt' ? text : true)
  const cancel = () => settleDialog(dialog.kind === 'prompt' ? null : false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // ไม่ให้ Escape ไปปิดหน้าต่างที่อยู่ข้างใต้ด้วย
      e.stopImmediatePropagation()
      cancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const Icon = danger ? AlertTriangle : CircleHelp

  return (
    <div className="fixed inset-0 z-[90] flex animate-fade-in items-center justify-center bg-black/45 p-4" onClick={cancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-pop-in rounded-3xl bg-surface p-5 shadow-xl"
      >
        <div className="flex gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
            }`}
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-1.5">
            <h2 id="app-dialog-title" className="font-medium text-stone-900">
              {options.title}
            </h2>
            {options.message && <p className="mt-1 text-sm text-stone-600">{options.message}</p>}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            confirm()
          }}
        >
          {dialog.kind === 'prompt' && (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={dialog.options.maxLength ?? 200}
              placeholder={dialog.options.placeholder}
              className="mt-4 w-full rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-[15px] text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
            />
          )}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={cancel}
              className="h-11 flex-1 rounded-full font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
            >
              {options.cancelLabel ?? t('ยกเลิก')}
            </button>
            <button
              type="submit"
              autoFocus={dialog.kind === 'confirm'}
              className={`h-11 flex-1 rounded-full font-medium text-white ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {options.confirmLabel ?? t('ตกลง')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
