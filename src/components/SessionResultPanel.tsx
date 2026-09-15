import type { AdvancedSessionReport } from '../types/advanced'
import styles from './SessionResultPanel.module.css'

interface SessionResultPanelProps {
  mode: 'idle' | 'live' | 'final'
  sessionNumber: number | null
  advanced: AdvancedSessionReport | null
  researchMode: boolean
}

export default function SessionResultPanel({
  mode,
  sessionNumber,
  advanced,
  researchMode,
}: SessionResultPanelProps) {
  return (
    <section className={styles.card} aria-label="Session result">
      <div className={styles.title}>Session Result</div>
      <p className={styles.subtitle}>Consolidated, baseline- and contradiction-aware summary</p>

      {mode !== 'final' && (
        <div className={styles.empty}>
          {mode === 'idle'
            ? 'No session result yet.'
            : 'The consolidated result is produced once you press Pause Analysis.'}
        </div>
      )}

      {mode === 'final' && advanced && (
        <>
          <div className={styles.stateBlock}>
            <div className={styles.stateLabel}>
              {sessionNumber ? `Session ${sessionNumber} — ` : ''}Possible State
            </div>
            <div className={styles.stateValue}>{advanced.displayCategory}</div>
            <p className={styles.safeSentence}>{advanced.safeSummarySentence}</p>
          </div>

          <div className={styles.grid}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Pattern Strength</div>
              <div className={styles.cellValue}>{advanced.patternStrength}%</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Confidence</div>
              <div className={styles.cellValue}>{advanced.confidence.level}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Baseline Deviation</div>
              <div className={styles.cellValue}>{advanced.deviationLevel ?? 'N/A'}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Cross-Modal Contradiction</div>
              <div className={styles.cellValue}>{advanced.contradiction.score}%</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Hesitation Events</div>
              <div className={styles.cellValue}>{advanced.hesitationEvents.length}</div>
            </div>
          </div>

          <div className={styles.strongestLabel}>Strongest Signals</div>
          {advanced.strongestSignals.length > 0 ? (
            <div className={styles.strongestList}>
              {advanced.strongestSignals.map((signal) => (
                <div key={signal} className={styles.strongestItem}>
                  • {signal}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noSignals}>No signal stood out strongly this session.</div>
          )}

          {researchMode && (
            <div className={styles.researchBlock}>
              <div className={styles.researchLabel}>Research Mode — Confidence Calculation</div>
              <div className={styles.researchList}>
                {advanced.confidence.reasons.map((reason) => (
                  <div key={reason} className={styles.researchItem}>
                    • {reason}
                  </div>
                ))}
              </div>
              {advanced.contradictionOverrideApplied && (
                <div className={styles.researchNote}>
                  Category was overridden from the base cascade result due to a high cross-modal
                  contradiction score (facial positivity combined with body-discomfort signals).
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
