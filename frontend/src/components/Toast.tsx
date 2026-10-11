export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-32 left-1/2 z-40 -translate-x-1/2 rounded-full bg-stone-900/90 px-4 py-2 text-sm text-white shadow-lg md:top-20"
    >
      {message}
    </div>
  )
}
