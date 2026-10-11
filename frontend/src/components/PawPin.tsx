interface Props {
  size?: number
  className?: string
}

/** หมุดทรงหยดน้ำมีอุ้งเท้าแมว — ปลายแหลมอยู่ล่างสุดตรงกลาง (ใช้ anchor แบบ bottom-center) */
export function PawPin({ size = 48, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={(size * 60) / 48}
      viewBox="0 0 48 60"
      className={`drop-shadow-lg ${className}`}
      aria-hidden="true"
    >
      <path
        d="M24 57.5C24 57.5 4.5 36.5 4.5 22.5a19.5 19.5 0 0 1 39 0C43.5 36.5 24 57.5 24 57.5Z"
        fill="#f97316"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g fill="#ffffff">
        <ellipse cx="24" cy="27" rx="7.2" ry="6" />
        <ellipse cx="14.8" cy="19.6" rx="3.1" ry="3.7" transform="rotate(-20 14.8 19.6)" />
        <ellipse cx="20.3" cy="13.6" rx="3.1" ry="3.8" transform="rotate(-6 20.3 13.6)" />
        <ellipse cx="27.7" cy="13.6" rx="3.1" ry="3.8" transform="rotate(6 27.7 13.6)" />
        <ellipse cx="33.2" cy="19.6" rx="3.1" ry="3.7" transform="rotate(20 33.2 19.6)" />
      </g>
    </svg>
  )
}
