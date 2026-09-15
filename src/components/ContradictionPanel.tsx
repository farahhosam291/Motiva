import type { ContradictionResult } from '../types/advanced'
import styles from './ContradictionPanel.module.css'

interface ContradictionPanelProps {
  mode: 'idle' | 'live' | 'final'
  contradiction: ContradictionResult | null
  researchMode: boolean
}

export default function ContradictionPanel({ mode, contradiction, researchMode }: ContradictionPanelProps) {
  return (
    <section className={styles.card} aria-label="Cross-modal contradiction">
      <div className={styles.title}>Cross-Modal Contradiction</div>
      <p className={styles.subtitle}>Whether facial and body signals agree with each other</p>

      {mode === 'idle' && (
        <div className={styles.empty}>Start analysis to check for signal conflict.</div>
      )}

      {mode === 'live' && (
        <div className={styles.empty}>
          Calculated from the full session average once you press Pause Analysis.
        </div>
      )}

      {mode === 'final' && contradiction && (
        <>
          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>Contradiction Score</span>
            <span className={`${styles.scoreValue} ${styles[`level${contradiction.level}`]}`}>
              {contradiction.score}% — {contradiction.level}
            </span>
          </div>
          <div className={styles.track}>
            <div
              className={`${styles.fill} ${styles[`fill${contradiction.level}`]}`}
              style={{ width: `${contradiction.score}%` }}
            />
          </div>
          <p className={styles.summary}>{contradiction.summary}</p>

          {researchMode && (
            <div className={styles.researchBlock}>
              <div className={styles.researchLabel}>Research Mode — Calculation Detail</div>
              <div className={styles.researchGrid}>
                <div className={styles.researchCell}>
                  <div className={styles.researchCellLabel}>Facial Positivity Index</div>
                  <div className={styles.researchCellValue}>
                    {Math.round(contradiction.facialPositivityIndex * 100)}%
                  </div>
                </div>
                <div className={styles.researchCell}>
                  <div className={styles.researchCellLabel}>Body Discomfort Index</div>
                  <div className={styles.researchCellValue}>
                    {Math.round(contradiction.bodyDiscomfortIndex * 100)}%
                  </div>
                </div>
                {contradiction.contributingSignals.slice(0, 4).map((signal) => (
                  <div key={signal.key} className={styles.researchCell}>
                    <div className={styles.researchCellLabel}>{signal.label}</div>
                    <div className={styles.researchCellValue}>{signal.value}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
