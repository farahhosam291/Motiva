import type { HesitationEvent } from '../types/advanced'
import { formatDuration } from '../lib/format'
import styles from './HesitationPanel.module.css'

interface HesitationPanelProps {
  mode: 'idle' | 'live' | 'final'
  hesitationEvents: HesitationEvent[] | null
}

export default function HesitationPanel({ mode, hesitationEvents }: HesitationPanelProps) {
  return (
    <section className={styles.card} aria-label="Hesitation events">
      <div className={styles.title}>Hesitation</div>
      <p className={styles.subtitle}>Behavioral patterns over time that may indicate hesitation</p>

      {mode === 'idle' && (
        <div className={styles.empty}>Start analysis to detect hesitation events.</div>
      )}

      {mode === 'live' && (
        <div className={styles.empty}>
          Hesitation is detected from patterns across the whole session — results appear once you
          press Pause Analysis.
        </div>
      )}

      {mode === 'final' && hesitationEvents && (
        hesitationEvents.length === 0 ? (
          <div className={styles.empty}>No hesitation events detected this session.</div>
        ) : (
          <div className={styles.list}>
            {hesitationEvents.map((event) => (
              <div key={event.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemTime}>{event.time}</span>
                  <span className={styles.itemScore}>{event.score}%</span>
                </div>
                <div className={styles.itemDuration}>
                  Duration: {formatDuration(event.durationMs)}
                </div>
                {event.contributingSignals.length > 0 && (
                  <div className={styles.contributors}>
                    {event.contributingSignals.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </section>
  )
}
