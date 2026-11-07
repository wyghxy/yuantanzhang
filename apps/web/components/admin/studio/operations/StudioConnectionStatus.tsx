'use client'

import { useStudioResource } from '../StudioQueryProvider'
import { useStudioPrivacy } from '../StudioPrivacy'
import { originalPlatforms } from '../original-studio-model'
import { list } from '../studio-client'
import { capabilityIndicator } from './studio-capability-presentation'
import styles from './StudioConnectionStatus.module.css'

export function StudioConnectionStatus({ onDetails }: { onDetails: () => void }) {
  const { masked, platformLabel } = useStudioPrivacy()
  const { data } = useStudioResource('capabilities')
  const platforms = list(data?.platforms)
  const transcription = capabilityIndicator(data?.asr)
  return <section className={styles.panel} aria-label="平台与转写状态">
    <h3>平台与转写状态</h3>
    <div className={styles.rows}>
      {originalPlatforms.map(([key, label, , short]) => {
        const indicator = capabilityIndicator(platforms.find(row => row.platform === key))
        return <button className="telemetry-pill" key={key} onClick={onDetails} title={`${platformLabel(key, label)}：${indicator.label}`}>
          <i style={{ backgroundColor: indicator.color }} />
          {masked ? platformLabel(key) : short}<span>{indicator.label}</span>
        </button>
      })}
      <button className="asr-status" onClick={onDetails}>
        <i className="connection-dot" style={{ backgroundColor: transcription.color }} />转写 {transcription.label}
      </button>
    </div>
  </section>
}
