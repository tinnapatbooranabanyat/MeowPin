export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      // key ตามข้อความ → toast ใหม่เด้งเข้ามาอีกรอบแม้ตัวเก่ายังไม่หาย
      key={message}
      role="status"
      className="pointer-events-none absolute top-32 animate-toast-in left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow-lg md:top-20"
    >
      {message}
    </div>
  )
}
