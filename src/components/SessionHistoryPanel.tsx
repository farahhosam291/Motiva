import { useState } from 'react'
import type { CompletedSession } from '../types/session'
import { formatDuration } from '../lib/format'
import EmotionProbabilityList, { capitalize } from './EmotionProbabilityList'
import styles from './SessionHistoryPanel.module.css'

interface SessionHistoryPanelProps {
  sessions: CompletedSession[]
  onClear: () => void
}

export default function SessionHistoryPanel({ sessions, onClear }: SessionHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleClear = () => {
    if (sessions.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved session history? This only removes locally stored numbers and summaries — it cannot be undone.',
    )
    if (confirmed) {
      onClear()
      setExpandedId(null)
    }
  }

  return (
    <section className={styles.card} aria-label="Session history">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Session History</div>
          <p className={styles.subtitle}>Saved locally in this browser — no video or images</p>
        </div>
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClear}
          disabled={sessions.length === 0}
        >
          Clear Session History
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className={styles.empty}>No completed sessions yet.</div>
      ) : (
        <div className={styles.list}>
          {sessions.map((session) => {
            const isExpanded = expandedId === session.id
            const ai = session.finalAIResult

            return (
              <div key={session.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.itemButton}
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  aria-expanded={isExpanded}
                >
                  <div className={styles.itemMain}>
                    <div className={styles.itemSession}>Session {session.sessionNumber}</div>
                    <div className={styles.itemState}>
                      {ai ? capitalize(ai.prediction) : 'No AI result recorded'}
                    </div>
                  </div>
                  <div className={styles.itemMeta}>
                    {ai && <div className={styles.itemScore}>{Math.round(ai.confidence * 100)}%</div>}
                    <div>Duration: {formatDuration(session.durationMs)}</div>
                  </div>
                </button>

                {isExpanded && (
                  <div className={styles.detail}>
                    {ai ? (
                      <>
                        <div className={styles.detailGrid}>
                          <div className={styles.detailCell}>
                            <div className={styles.detailLabel}>AI Predictions Used</div>
                            <div className={styles.detailValue}>{ai.sampleCount}</div>
                          </div>
                          {session.advanced && (
                            <>
                              <div className={styles.detailCell}>
                                <div className={styles.detailLabel}>Hesitation Events</div>
                                <div className={styles.detailValue}>
                                  {session.advanced.hesitationEvents.length}
                                </div>
                              </div>
                              <div className={styles.detailCell}>
                                <div className={styles.detailLabel}>Baseline Deviation</div>
                                <div className={styles.detailValue}>
                                  {session.advanced.deviationLevel ?? 'N/A'}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className={styles.contributorsLabel}>Saved probability distribution</div>
                        <EmotionProbabilityList probabilities={ai.probabilities} topLabel={ai.prediction} />
                      </>
                    ) : (
                      <div className={styles.noAiText}>
                        This session was saved before the facial AI result was recorded.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
