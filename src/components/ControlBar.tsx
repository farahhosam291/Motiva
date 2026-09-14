import type { AnalysisStatus } from '../types/analysis'
import { CameraIcon, PauseIcon, PlayIcon, ResetIcon, StopIcon } from './icons'
import styles from './ControlBar.module.css'

interface ControlBarProps {
  status: AnalysisStatus
  isRequestingCamera: boolean
  onStartCamera: () => void
  onStartAnalysis: () => void
  onPauseAnalysis: () => void
  onStopCamera: () => void
  onReset: () => void
}

export default function ControlBar({
  status,
  isRequestingCamera,
  onStartCamera,
  onStartAnalysis,
  onPauseAnalysis,
  onStopCamera,
  onReset,
}: ControlBarProps) {
  const canStartCamera = status === 'idle' && !isRequestingCamera
  // A 'paused' session is already finalized and saved to history — Start
  // Analysis only begins a fresh, not-yet-started session (Stop Camera then
  // Start Camera again to begin the next one).
  const canStartAnalysis = status === 'camera-on'
  const canPauseAnalysis = status === 'analyzing'
  const canStopCamera = status !== 'idle'
  // Reset only discards an in-progress, unfinished analysis — a finalized
  // session is already saved and can only be removed via Clear Session History.
  const canReset = status === 'analyzing'

  return (
    <div className={styles.card} role="group" aria-label="Analysis controls">
      <button
        type="button"
        className={`${styles.button} ${styles.primary}`}
        disabled={!canStartCamera}
        onClick={onStartCamera}
      >
        <CameraIcon size={15} />
        {isRequestingCamera ? 'Requesting…' : 'Start Camera'}
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.primary}`}
        disabled={!canStartAnalysis}
        onClick={onStartAnalysis}
      >
        <PlayIcon size={15} />
        Start Analysis
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.secondary}`}
        disabled={!canPauseAnalysis}
        onClick={onPauseAnalysis}
      >
        <PauseIcon size={15} />
        Pause Analysis
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.outlineDanger}`}
        disabled={!canStopCamera}
        onClick={onStopCamera}
      >
        <StopIcon size={15} />
        Stop Camera
      </button>

      <span className={styles.spacer} />

      <button
        type="button"
        className={`${styles.button} ${styles.ghost}`}
        disabled={!canReset}
        onClick={onReset}
      >
        <ResetIcon size={15} />
        Reset
      </button>
    </div>
  )
}
