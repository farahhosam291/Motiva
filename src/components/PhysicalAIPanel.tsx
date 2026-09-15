import type { PhysicalAIRecommendation } from '../types/advanced'
import { PHYSICAL_AI_DISCLAIMER } from '../lib/physicalAIRecommendation'
import styles from './PhysicalAIPanel.module.css'

interface PhysicalAIPanelProps {
  mode: 'idle' | 'live' | 'final'
  recommendation: PhysicalAIRecommendation | null
}

export default function PhysicalAIPanel({ mode, recommendation }: PhysicalAIPanelProps) {
  return (
    <section className={styles.card} aria-label="Recommended Physical AI response">
      <div className={styles.title}>Recommended Physical AI Response</div>
      <p className={styles.subtitle}>How a robot or Physical AI system might respond to this session</p>

      {mode !== 'final' && (
        <div className={styles.empty}>
          {mode === 'idle'
            ? 'A recommendation is produced after a completed session.'
            : 'A recommendation will be produced once you press Pause Analysis.'}
        </div>
      )}

      {mode === 'final' && recommendation && (
        <>
          <div className={styles.recommendationTitle}>{recommendation.title}</div>
          <div className={styles.actionsList}>
            {recommendation.actions.map((action) => (
              <div key={action} className={styles.actionItem}>
                <span className={styles.actionBullet} />
                <span>{action}</span>
              </div>
            ))}
          </div>
          <p className={styles.rationale}>{recommendation.rationale}</p>
          <p className={styles.disclaimer}>{PHYSICAL_AI_DISCLAIMER}</p>
        </>
      )}
    </section>
  )
}
