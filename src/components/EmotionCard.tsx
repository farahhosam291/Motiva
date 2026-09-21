import type { EmotionLabel, EmotionProbabilities, FinalAIResult } from '../types/facialAI'
import type { FacialAIStatus } from '../hooks/useEmotionPrediction'
import StatusBadge from './StatusBadge'
import EmotionProbabilityList, { capitalize } from './EmotionProbabilityList'
import styles from './EmotionCard.module.css'

export type EmotionCardMode = 'idle' | 'live' | 'final'

interface EmotionCardProps {
  mode: EmotionCardMode
  sessionNumber: number | null
  liveStatus: FacialAIStatus
  livePrediction: EmotionLabel | null
  liveConfidence: number | null
  liveProbabilities: EmotionProbabilities | null
  finalResult: FinalAIResult | null
}

export default function EmotionCard({
  mode,
  sessionNumber,
  liveStatus,
  livePrediction,
  liveConfidence,
  liveProbabilities,
  finalResult,
}: EmotionCardProps) {
  return (
    <section className={styles.card} aria-label="Estimated emotional state">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Estimated Emotional State</div>
          <p className={styles.subtitle}>Live result from the trained facial AI model</p>
        </div>
        {mode === 'live' && <StatusBadge label="Live Analysis" tone="active" pulse />}
        {mode === 'final' && <StatusBadge label="Analysis Complete" tone="paused" />}
      </div>

      {mode === 'idle' && (
        <div className={styles.empty}>No estimate yet. Start analysis to see results here.</div>
      )}

      {mode === 'live' && liveStatus === 'unavailable' && (
        <div className={styles.unavailable}>
          <div className={styles.unavailableTitle}>AI model unavailable</div>
          <p className={styles.unavailableText}>
            Could not reach the facial AI backend. Make sure the backend server is running
            locally.
          </p>
        </div>
      )}

      {mode === 'live' && liveStatus !== 'unavailable' && liveStatus !== 'ready' && (
        <div className={styles.empty}>
          {liveStatus === 'waiting' ? 'Analyzing face…' : 'No face detected yet.'}
        </div>
      )}

      {mode === 'live' &&
        liveStatus === 'ready' &&
        livePrediction &&
        liveConfidence !== null &&
        liveProbabilities && (
          <>
            <div className={styles.stateBlock}>
              <div className={styles.stateLabel}>
                {sessionNumber ? `Session ${sessionNumber} — ` : ''}Live AI Result
              </div>
              <div className={styles.stateValue}>{capitalize(livePrediction)}</div>
              <div className={styles.stateConfidence}>{Math.round(liveConfidence * 100)}%</div>
            </div>
            <div className={styles.breakdownLabel}>Live Probabilities</div>
            <EmotionProbabilityList probabilities={liveProbabilities} topLabel={livePrediction} />
          </>
        )}

      {mode === 'final' && finalResult && (
        <>
          <div className={styles.stateBlock}>
            <div className={styles.stateLabel}>
              {sessionNumber ? `Session ${sessionNumber} — ` : ''}Final AI Result
            </div>
            <div className={styles.stateValue}>{capitalize(finalResult.prediction)}</div>
            <div className={styles.stateConfidence}>{Math.round(finalResult.confidence * 100)}%</div>
          </div>
          <div className={styles.breakdownLabel}>Final Session Probabilities</div>
          <EmotionProbabilityList probabilities={finalResult.probabilities} topLabel={finalResult.prediction} />
          <p className={styles.disclaimer}>
            This is the trained facial AI model&apos;s estimate from observable expressions only —
            not a measurement of the person&apos;s true internal emotional state.
          </p>
        </>
      )}

      {mode === 'final' && !finalResult && (
        <div className={styles.empty}>No AI predictions were recorded for this session.</div>
      )}
    </section>
  )
}
