import type { EstimationExplanation } from '../types/session'
import { InfoIcon } from './icons'
import styles from './ExplanationPanel.module.css'

export type ExplanationPanelMode = 'idle' | 'live' | 'final'

interface ExplanationPanelProps {
  mode: ExplanationPanelMode
  explanation: EstimationExplanation | null
  /** Numbered, baseline/contradiction-aware reasons built from this session's
   *  own data (Section 9). Optional so older saved sessions without it still render. */
  whyReasons?: string[]
}

export default function ExplanationPanel({ mode, explanation, whyReasons }: ExplanationPanelProps) {
  return (
    <section className={styles.card} aria-label="Explanation of the estimate">
      <div className={styles.headerRow}>
        <InfoIcon size={16} />
        <div className={styles.title}>Why did the AI estimate this?</div>
      </div>
      <p className={styles.subtitle}>
        A transparency summary of the signals that contributed to the current estimate
      </p>

      {mode === 'idle' && (
        <div className={styles.empty}>An explanation will appear here once analysis begins.</div>
      )}

      {mode === 'live' && (
        <div className={styles.empty}>
          Explanations are generated from the full session average — this will fill in once you
          press Pause Analysis.
        </div>
      )}

      {mode === 'final' && explanation && (
        <>
          <div className={styles.headline}>{explanation.headline}</div>

          {whyReasons && whyReasons.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Why?</div>
              <ol className={styles.reasonsList}>
                {whyReasons.map((reason) => (
                  <li key={reason} className={styles.reasonListItem}>
                    {reason}
                  </li>
                ))}
              </ol>
            </>
          )}

          {explanation.topContributors.length > 0 ? (
            <>
              <div className={styles.sectionLabel}>Main contributing signals</div>
              <ul className={styles.list}>
                {explanation.topContributors.map((signal) => (
                  <li key={signal.key} className={styles.reasonItem}>
                    <span className={styles.bullet} />
                    <span>
                      {signal.label}: <strong>{signal.value}%</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className={styles.empty}>No signal was strongly elevated this session.</div>
          )}

          {explanation.otherSignals.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Other measured signals</div>
              <p className={styles.otherSignalsText}>
                {explanation.otherSignals
                  .map((signal) => `${signal.label}: ${signal.value}%`)
                  .join(' · ')}
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
