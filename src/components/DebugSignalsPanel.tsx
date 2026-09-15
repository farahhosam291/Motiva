import type { RawSignals } from '../lib/signalExtraction'
import styles from './DebugSignalsPanel.module.css'

interface DebugSignalsPanelProps {
  signals: RawSignals
  isActive: boolean
  isLoadingTrackers: boolean
  trackingError: string | null
}

function formatNumber(value: number | null, decimals: number): string {
  return value === null ? '—' : value.toFixed(decimals)
}

interface RowProps {
  label: string
  value: string
  muted?: boolean
}

function Row({ label, value, muted }: RowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${muted ? styles.valueMuted : ''}`}>{value}</div>
    </div>
  )
}

export default function DebugSignalsPanel({
  signals,
  isActive,
  isLoadingTrackers,
  trackingError,
}: DebugSignalsPanelProps) {
  return (
    <section className={styles.card} aria-label="Debug: raw tracking signals">
      <div className={styles.headerRow}>
        <div className={styles.title}>
          <span className={styles.debugTag}>Debug</span>
          Raw Signal Values
        </div>
      </div>
      <p className={styles.subtitle}>
        Live, unprocessed values read directly from MediaPipe each frame — no smoothing, no
        thresholds, no emotion interpretation. Also logged to the browser console.
      </p>

      {!isActive ? (
        <div className={styles.empty}>Start the camera to see live values here.</div>
      ) : trackingError ? (
        <div className={styles.empty}>{trackingError}</div>
      ) : isLoadingTrackers ? (
        <div className={styles.empty}>Loading tracking models…</div>
      ) : (
        <div className={styles.grid}>
          <Row
            label="Face Detected"
            value={signals.faceDetected ? 'Yes' : 'No'}
            muted={!signals.faceDetected}
          />
          <Row
            label="Pose Detected"
            value={signals.poseDetected ? 'Yes' : 'No'}
            muted={!signals.poseDetected}
          />
          <Row
            label="Smile Score"
            value={formatNumber(signals.smileScore, 3)}
            muted={signals.smileScore === null}
          />
          <Row
            label="Mouth Openness"
            value={formatNumber(signals.mouthOpenness, 3)}
            muted={signals.mouthOpenness === null}
          />
          <Row
            label="Eyebrow Raise"
            value={formatNumber(signals.eyebrowRaise, 3)}
            muted={signals.eyebrowRaise === null}
          />
          <Row
            label="Eye Openness"
            value={formatNumber(signals.eyeOpenness, 3)}
            muted={signals.eyeOpenness === null}
          />
          <Row
            label="Lip Tension"
            value={formatNumber(signals.lipTension, 3)}
            muted={signals.lipTension === null}
          />
          <Row
            label="Squint"
            value={formatNumber(signals.squint, 3)}
            muted={signals.squint === null}
          />
          <Row
            label="Eyebrow Lower"
            value={formatNumber(signals.eyebrowLower, 3)}
            muted={signals.eyebrowLower === null}
          />
          <Row
            label="Jaw Movement"
            value={formatNumber(signals.jawMovement, 3)}
            muted={signals.jawMovement === null}
          />
          <Row
            label="Head Yaw (°)"
            value={formatNumber(signals.headYaw, 1)}
            muted={signals.headYaw === null}
          />
          <Row
            label="Head Pitch (°)"
            value={formatNumber(signals.headPitch, 1)}
            muted={signals.headPitch === null}
          />
          <Row
            label="Head Roll (°)"
            value={formatNumber(signals.headRoll, 1)}
            muted={signals.headRoll === null}
          />
          <Row
            label="Head Movement Raw (°/sample)"
            value={formatNumber(signals.headMovementRaw, 2)}
            muted={signals.headMovementRaw === null}
          />
          <Row
            label="Gaze Offset X"
            value={formatNumber(signals.gazeOffsetX, 3)}
            muted={signals.gazeOffsetX === null}
          />
          <Row
            label="Gaze Offset Y"
            value={formatNumber(signals.gazeOffsetY, 3)}
            muted={signals.gazeOffsetY === null}
          />
          <Row
            label="Gaze Movement Raw"
            value={formatNumber(signals.gazeMovementRaw, 4)}
            muted={signals.gazeMovementRaw === null}
          />
          <Row
            label="Hand Movement"
            value={formatNumber(signals.handMovement, 4)}
            muted={signals.handMovement === null}
          />
          <Row
            label="Body Movement"
            value={formatNumber(signals.bodyMovement, 4)}
            muted={signals.bodyMovement === null}
          />
        </div>
      )}
    </section>
  )
}
