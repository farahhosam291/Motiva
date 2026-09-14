import {
  BEHAVIOR_SIGNAL_KEYS,
  BODY_SIGNAL_KEYS,
  EXPERIMENTAL_SIGNAL_KEYS,
  FACIAL_SIGNAL_KEYS,
  SIGNAL_LABELS,
  type SignalKey,
  type SignalStatsMap,
} from '../types/session'
import StatusBadge from './StatusBadge'
import SignalBar from './SignalBar'
import styles from './SignalsPanel.module.css'

export type SignalsPanelMode = 'idle' | 'live' | 'final'

interface SignalsPanelProps {
  stats: SignalStatsMap
  mode: SignalsPanelMode
}

function SignalGroup({
  title,
  keys,
  stats,
  isFinal,
}: {
  title: string
  keys: readonly SignalKey[]
  stats: SignalStatsMap
  isFinal: boolean
}) {
  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>{title}</div>
      {keys.map((key) => {
        const stat = stats[key]
        const value = isFinal ? stat.average : stat.current
        return (
          <SignalBar
            key={key}
            label={SIGNAL_LABELS[key]}
            value={value === null ? null : Math.round(value * 100)}
            samples={stat.samples}
            isExperimental={EXPERIMENTAL_SIGNAL_KEYS.includes(key)}
            isFinal={isFinal}
          />
        )
      })}
    </div>
  )
}

export default function SignalsPanel({ stats, mode }: SignalsPanelProps) {
  return (
    <section className={styles.card} aria-label="Detected signals">
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Detected Signals</div>
          <p className={styles.subtitle}>Facial, body, and behavior signals for this session</p>
        </div>
        {mode === 'live' && <StatusBadge label="Live Analysis" tone="active" pulse />}
        {mode === 'final' && <StatusBadge label="Analysis Complete" tone="paused" />}
      </div>

      {mode === 'idle' ? (
        <div className={styles.empty}>Start analysis to begin collecting signals.</div>
      ) : (
        <>
          <SignalGroup
            title="Facial Signals"
            keys={FACIAL_SIGNAL_KEYS}
            stats={stats}
            isFinal={mode === 'final'}
          />
          <SignalGroup
            title="Body Signals"
            keys={BODY_SIGNAL_KEYS}
            stats={stats}
            isFinal={mode === 'final'}
          />
          <SignalGroup
            title="Behavior Signals"
            keys={BEHAVIOR_SIGNAL_KEYS}
            stats={stats}
            isFinal={mode === 'final'}
          />
        </>
      )}
    </section>
  )
}
