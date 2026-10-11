import { AdvancedMarker } from '@vis.gl/react-google-maps'
import type { LatLng } from '../types'
import { useI18n } from '../hooks/useI18n'

export function UserLocationMarker({ position }: { position: LatLng }) {
  const { t } = useI18n()
  return (
    <AdvancedMarker position={position} title={t('ตำแหน่งของคุณ')} zIndex={500} anchorPoint={['50%', '50%']}>
      <span className="relative flex size-5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex size-5 rounded-full border-[3px] border-white bg-sky-500 shadow" />
      </span>
    </AdvancedMarker>
  )
}
