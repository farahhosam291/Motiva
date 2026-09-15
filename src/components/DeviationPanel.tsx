import type { DeviationLevel, SignalDeviation } from '../types/advanced'
import styles from './DeviationPanel.module.css'

interface DeviationPanelProps {
  hasBaseline: boolean
  deviations: SignalDeviation[]
  level: DeviationLevel | null
}

const MAX_SHOWN = 6

export default function DeviationPanel({ hasBaseline, deviations, level }: DeviationPanelProps) {
  return (
    <section className={styles.card} aria-label="Deviation from personal baseline">
      <div className={styles.title}>Deviation From Personal Baseline</div>
      <p className={styles.subtitle}>How this session compares to your own calibrated normal</p>

      {!hasBaseline ? (
        <div className={styles.empty}>
          No personal baseline on file. Use "Calibrate Baseline" before a session to see
          comparisons here.
        </div>
      ) : deviations.length === 0 ? (
        <div className={styles.empty}>Not enough data to compare against your baseline yet.</div>
      ) : (
        <>
          {level && (
            <div className={styles.levelRow}>
              <span className={styles.levelLabel}>Overall Deviation</span>
              <span className={`${styles.levelValue} ${styles[`level${level}`]}`}>{level}</span>
            </div>
          )}
          <div className={styles.list}>
            {deviations.slice(0, MAX_SHOWN).map((deviation) => {
              const badgeClass =
                Math.abs(deviation.difference) < 15
                  ? styles.deviationFlat
                  : deviation.difference > 0
                    ? styles.deviationUp
                    : styles.deviationDown
              const sign = deviation.difference > 0 ? '+' : ''
              return (
                <div key={deviation.key} className={styles.row}>
                  <span className={styles.rowLabel}>{deviation.label}</span>
                  <span className={styles.rowValues}>
                    <span className={styles.currentValue}>{deviation.current}%</span>
                    <span className={styles.baselineValue}>base {deviation.baseline}%</span>
                    <span className={`${styles.deviationBadge} ${badgeClass}`}>
                      {sign}
                      {deviation.difference}%
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
