import type { EmotionLabel, EmotionProbabilities } from '../types/facialAI'
import type { FacialAIStatus } from '../hooks/useEmotionPrediction'
import EmotionProbabilityList, { capitalize } from './EmotionProbabilityList'
import styles from './FacialAIPanel.module.css'

interface FacialAIPanelProps {
  status: FacialAIStatus
  isCameraActive: boolean
  prediction: EmotionLabel | null
  confidence: number | null
  probabilities: EmotionProbabilities | null
}

export default function FacialAIPanel({
  status,
  isCameraActive,
  prediction,
  confidence,
  probabilities,
}: FacialAIPanelProps) {
  return (
    <section className={styles.card} aria-label="Facial AI model">
      <div className={styles.title}>Facial AI Model</div>
      <p className={styles.subtitle}>
        Live prediction from the trained facial-emotion-recognition model
      </p>

      {status === 'unavailable' && (
        <div className={styles.unavailable}>
          <div className={styles.unavailableTitle}>AI model unavailable</div>
          <p className={styles.unavailableText}>
            Could not reach the facial AI backend. Make sure the backend server is running
            locally.
          </p>
        </div>
      )}

      {status === 'idle' && (
        <div className={styles.empty}>
          {isCameraActive ? 'No face detected yet.' : 'Start the camera to see live predictions.'}
        </div>
      )}

      {status === 'waiting' && <div className={styles.empty}>Analyzing face…</div>}

      {status === 'ready' && prediction && confidence !== null && probabilities && (
        <>
          <div className={styles.headline}>
            <div className={styles.headlineLabel}>{capitalize(prediction)}</div>
            <div className={styles.headlineValue}>{Math.round(confidence * 100)}%</div>
          </div>

          <EmotionProbabilityList probabilities={probabilities} topLabel={prediction} />
        </>
      )}
    </section>
  )
}
