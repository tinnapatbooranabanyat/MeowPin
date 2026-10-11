import { useState } from 'react'

interface Props {
  name: string | null | undefined
  url: string | null | undefined
  className?: string
}

// รูปจาก Google ถ้าโหลดไม่ได้ (หรือไม่มี) ใช้ตัวอักษรแรกของชื่อแทน
export function UserAvatar({ name, url, className = 'size-8 text-sm' }: Props) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-orange-200 font-medium text-orange-900 ${className}`}
    >
      {(name?.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
