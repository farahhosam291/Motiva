import type { FinalAIResult } from '../types/facialAI'
import { formatDuration } from '../lib/format'
import EmotionProbabilityList, { capitalize } from './EmotionProbabilityList'
import styles from './SessionResultPanel.module.css'

interface SessionResultPanelProps {
  mode: 'idle' | 'live' | 'final'
  sessionNumber: number | null
  finalResult: FinalAIResult | null
}

export default function SessionResultPanel({ mode, sessionNumber, finalResult }: SessionResultPanelProps) {
  return (
    <section className={styles.card} aria-label="Session result">
      <div className={styles.title}>Session Result</div>
      <p className={styles.subtitle}>Final result from the trained facial AI model</p>

      {mode !== 'final' && (
        <div className={styles.empty}>
          {mode === 'idle'
            ? 'No session result yet.'
            : 'The final AI result is produced once you press Pause Analysis.'}
        </div>
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

          <div className={styles.grid}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Duration</div>
              <div className={styles.cellValue}>{formatDuration(finalResult.durationMs)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>AI Predictions Used</div>
              <div className={styles.cellValue}>{finalResult.sampleCount}</div>
            </div>
          </div>

          <div className={styles.breakdownLabel}>Final Session Probabilities</div>
          <EmotionProbabilityList probabilities={finalResult.probabilities} topLabel={finalResult.prediction} />
        </>
      )}

      {mode === 'final' && !finalResult && (
        <div className={styles.empty}>No AI predictions were recorded for this session.</div>
      )}
    </section>
  )
}
