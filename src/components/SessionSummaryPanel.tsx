import type { SessionSummary } from '../types/session'
import { formatDuration } from '../lib/format'
import styles from './SessionSummaryPanel.module.css'

export type SessionSummaryMode = 'idle' | 'live' | 'final'

interface SessionSummaryPanelProps {
  mode: SessionSummaryMode
  sessionNumber: number | null
  summary: SessionSummary | null
}

export default function SessionSummaryPanel({
  mode,
  sessionNumber,
  summary,
}: SessionSummaryPanelProps) {
  return (
    <section className={styles.card} aria-label="Session summary">
      <div className={styles.title}>Session Summary</div>
      <p className={styles.subtitle}>Key figures for this analysis session</p>

      {mode === 'idle' && <div className={styles.empty}>No session in progress.</div>}

      {mode === 'live' && (
        <div className={styles.empty}>
          {sessionNumber ? `Session ${sessionNumber} is collecting data. ` : ''}
          The summary is finalized once you press Pause Analysis.
        </div>
      )}

      {mode === 'final' && summary && (
        <>
          <div className={styles.grid}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Session</div>
              <div className={styles.cellValue}>{summary.sessionNumber}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Duration</div>
              <div className={styles.cellValue}>{formatDuration(summary.durationMs)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Samples</div>
              <div className={styles.cellValue}>{summary.sampleCount}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Avg. Movement</div>
              <div className={styles.cellValue}>
                {summary.averageMovement === null ? '—' : `${summary.averageMovement}%`}
              </div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Final State</div>
              <div className={styles.cellValue}>{summary.finalState}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>Final Score</div>
              <div className={styles.cellValue}>{summary.finalScore}%</div>
            </div>
          </div>

          <div className={styles.behaviorsLabel}>Main Detected Behaviors</div>
          {summary.mainBehaviors.length > 0 ? (
            <div className={styles.behaviorsList}>
              {summary.mainBehaviors.map((behavior) => (
                <div key={behavior} className={styles.behaviorItem}>
                  • {behavior}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noBehaviors}>No significant behavioral events detected.</div>
          )}
        </>
      )}
    </section>
  )
}
