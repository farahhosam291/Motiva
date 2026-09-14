import type { AffectEstimation } from '../types/session'
import StatusBadge from './StatusBadge'
import styles from './EmotionCard.module.css'

export type EmotionCardMode = 'idle' | 'live' | 'final'

interface EmotionCardProps {
  mode: EmotionCardMode
  estimation: AffectEstimation | null
  sessionNumber: number | null
}

export default function EmotionCard({ mode, estimation, sessionNumber }: EmotionCardProps) {
  return (
    <section className={styles.card} aria-label="Estimated emotional state">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Estimated Emotional State</div>
          <p className={styles.subtitle}>A session-based estimate from observable behavior only</p>
        </div>
        {mode === 'live' && <StatusBadge label="Live Analysis" tone="active" pulse />}
        {mode === 'final' && <StatusBadge label="Analysis Complete" tone="paused" />}
      </div>

      {mode === 'idle' && (
        <div className={styles.empty}>No estimate yet. Start analysis to see results here.</div>
      )}

      {mode === 'live' && (
        <div className={styles.empty}>
          Collecting live signal data{sessionNumber ? ` for Session ${sessionNumber}` : ''}. The
          final estimate is calculated from the whole session once you press Pause Analysis.
        </div>
      )}

      {mode === 'final' && estimation && (
        <>
          <div className={styles.stateBlock}>
            <div className={styles.stateLabel}>
              {sessionNumber ? `Session ${sessionNumber} — Final Estimate` : 'Final Estimate'}
            </div>
            <div className={styles.stateValue}>{estimation.category}</div>
          </div>

          <div className={styles.confidenceRow}>
            <div className={styles.confidenceLabelRow}>
              <span className={styles.confidenceLabel}>Overall Score</span>
              <span className={styles.confidenceValue}>{estimation.score}%</span>
            </div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${estimation.score}%` }} />
            </div>
          </div>

          <div className={styles.reliabilityRow}>
            <span className={styles.reliabilityLabel}>Reliability</span>
            <span className={`${styles.reliabilityValue} ${styles[`reliability${estimation.reliability}`]}`}>
              {estimation.reliability}
            </span>
          </div>

          <p className={styles.disclaimer}>
            This is an estimate based only on observable facial and body behavior — not a
            measurement of the person&apos;s true internal emotional state.
          </p>
        </>
      )}
    </section>
  )
}
