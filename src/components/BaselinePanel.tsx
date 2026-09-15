import type { CalibrationPhase } from '../hooks/useBaselineCalibration'
import type { PersonalBaseline } from '../types/advanced'
import { formatDuration } from '../lib/format'
import styles from './BaselinePanel.module.css'

interface BaselinePanelProps {
  baseline: PersonalBaseline | null
  phase: CalibrationPhase
  progress: number
  isCameraActive: boolean
  isAnalyzing: boolean
  onStart: () => void
  onDelete: () => void
}

export default function BaselinePanel({
  baseline,
  phase,
  progress,
  isCameraActive,
  isAnalyzing,
  onStart,
  onDelete,
}: BaselinePanelProps) {
  const canCalibrate = isCameraActive && !isAnalyzing && phase !== 'collecting'
  const secondsRemaining = Math.max(0, Math.ceil((1 - progress) * 18))

  return (
    <section className={styles.card} aria-label="Personal baseline calibration">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Personal Baseline</div>
          <p className={styles.subtitle}>
            Calibrate your own natural resting behavior so later sessions are compared against
            you, not a generic default.
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canCalibrate} onClick={onStart}>
          {phase === 'collecting' ? 'Calibrating…' : 'Calibrate Baseline'}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.outlineDanger}`}
          disabled={!baseline}
          onClick={onDelete}
        >
          Delete Personal Baseline
        </button>
        {!isCameraActive && phase !== 'collecting' && (
          <span className={styles.statusText}>Start the camera to calibrate.</span>
        )}
      </div>

      {phase === 'collecting' && (
        <div className={styles.progressRow}>
          <div className={styles.progressLabel}>
            <span>Sit or stand naturally — measuring your baseline…</span>
            <span>{secondsRemaining}s</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {baseline && phase !== 'collecting' && (
        <div className={styles.baselineSummary}>
          <div className={styles.baselineSummaryTitle}>Baseline On File</div>
          <div className={styles.baselineSummaryText}>
            Calibrated {formatDuration(Date.now() - baseline.calibratedAt)} ago, from{' '}
            {baseline.sampleCount} samples over {formatDuration(baseline.durationMs)}.
          </div>
        </div>
      )}
    </section>
  )
}
