import type { TimelineEntry } from '../types/analysis'
import { ActivityIcon } from './icons'
import styles from './Timeline.module.css'

interface TimelineProps {
  entries: TimelineEntry[]
  isActive: boolean
}

export default function Timeline({ entries, isActive }: TimelineProps) {
  return (
    <section className={styles.card} aria-label="Behavior timeline">
      <div className={styles.headerRow}>
        <ActivityIcon size={16} />
        <div className={styles.title}>Behavior Timeline</div>
      </div>
      <p className={styles.subtitle}>A chronological log of observed activity during the session</p>

      {isActive ? (
        <div className={styles.list}>
          {entries.map((entry, index) => (
            <div key={entry.id} className={styles.item}>
              <div className={styles.rail}>
                <span className={styles.dot} />
                {index < entries.length - 1 && <span className={styles.line} />}
              </div>
              <span className={styles.time}>{entry.time}</span>
              <span className={styles.description}>{entry.description}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>No activity recorded yet.</div>
      )}
    </section>
  )
}
