import type { RefObject } from 'react'
import type { AnalysisStatus } from '../types/analysis'
import type { CameraError } from '../hooks/useCamera'
import StatusBadge from './StatusBadge'
import { CameraIcon, CameraOffIcon } from './icons'
import styles from './CameraPanel.module.css'

interface CameraPanelProps {
  status: AnalysisStatus
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  isCameraActive: boolean
  isRequesting: boolean
  cameraError: CameraError | null
  isLoadingTrackers: boolean
  trackingError: string | null
  faceDetected: boolean
  poseDetected: boolean
}

export default function CameraPanel({
  status,
  videoRef,
  canvasRef,
  isCameraActive,
  isRequesting,
  cameraError,
  isLoadingTrackers,
  trackingError,
  faceDetected,
  poseDetected,
}: CameraPanelProps) {
  const isAnalyzing = status === 'analyzing'
  const showOverlayBadge = isCameraActive

  return (
    <section className={styles.card} aria-label="Camera feed">
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>Camera Feed</div>
          <div className={styles.cardSubtitle}>Live view used for body-language analysis</div>
        </div>
        {status === 'idle' && !isRequesting && <StatusBadge label="Camera Off" tone="neutral" />}
        {isRequesting && <StatusBadge label="Requesting Access" tone="paused" pulse />}
        {status === 'camera-on' && <StatusBadge label="Camera On" tone="active" />}
        {status === 'analyzing' && <StatusBadge label="Analyzing" tone="active" pulse />}
        {status === 'paused' && <StatusBadge label="Analysis Complete" tone="paused" />}
      </div>

      <div className={styles.frame}>
        <video
          ref={videoRef}
          className={`${styles.video} ${isCameraActive ? styles.videoVisible : ''}`}
          autoPlay
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
          className={`${styles.canvas} ${isCameraActive ? styles.canvasVisible : ''}`}
        />

        {showOverlayBadge && (
          <span className={styles.overlayTopRight}>
            <span className={`${styles.recDot} ${isAnalyzing ? styles.live : ''}`} />
            {isAnalyzing ? 'REC' : 'PREVIEW'}
          </span>
        )}

        {!isCameraActive && (
          <div className={styles.placeholderContent}>
            {cameraError ? (
              <>
                <div className={`${styles.iconCircle} ${styles.iconCircleError}`}>
                  <CameraOffIcon size={24} />
                </div>
                <div className={`${styles.placeholderTitle} ${styles.placeholderTitleError}`}>
                  Camera unavailable
                </div>
                <p className={styles.placeholderText}>{cameraError.message}</p>
              </>
            ) : isRequesting ? (
              <>
                <div className={styles.iconCircle}>
                  <CameraIcon size={24} />
                </div>
                <div className={styles.placeholderTitle}>Requesting camera access</div>
                <p className={styles.placeholderText}>
                  Check for a browser permission prompt and allow camera access to continue.
                </p>
              </>
            ) : (
              <>
                <div className={styles.iconCircle}>
                  <CameraIcon size={24} />
                </div>
                <div className={styles.placeholderTitle}>Camera is off</div>
                <p className={styles.placeholderText}>
                  Start the camera to preview the live feed. No video is captured or analyzed yet.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {isCameraActive && (
        <div className={styles.trackingRow}>
          {trackingError ? (
            <span className={styles.trackingErrorText}>{trackingError}</span>
          ) : isLoadingTrackers ? (
            <StatusBadge label="Loading trackers…" tone="paused" pulse />
          ) : (
            <>
              <StatusBadge
                label={faceDetected ? 'Face Detected' : 'No Face Detected'}
                tone={faceDetected ? 'active' : 'neutral'}
              />
              <StatusBadge
                label={poseDetected ? 'Pose Detected' : 'No Pose Detected'}
                tone={poseDetected ? 'active' : 'neutral'}
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}
