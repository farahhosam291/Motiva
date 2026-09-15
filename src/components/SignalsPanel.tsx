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
export type SignalsPanelGroup = 'facial' | 'body' | 'behavior'

interface SignalsPanelProps {
  stats: SignalStatsMap
  mode: SignalsPanelMode
  group: SignalsPanelGroup
}

const GROUP_CONFIG: Record<
  SignalsPanelGroup,
  { title: string; subtitle: string; keys: readonly SignalKey[] }
> = {
  facial: {
    title: 'Face Signals',
    subtitle: 'Facial expression signals for this session',
    keys: FACIAL_SIGNAL_KEYS,
  },
  body: {
    title: 'Body Signals',
    subtitle: 'Body movement and posture signals for this session',
    keys: BODY_SIGNAL_KEYS,
  },
  behavior: {
    title: 'Behavior Signals',
    subtitle: 'Composite behavior signals for this session',
    keys: BEHAVIOR_SIGNAL_KEYS,
  },
}

export default function SignalsPanel({ stats, mode, group }: SignalsPanelProps) {
  const config = GROUP_CONFIG[group]

  return (
    <section className={styles.card} aria-label={config.title}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{config.title}</div>
          <p className={styles.subtitle}>{config.subtitle}</p>
        </div>
        {mode === 'live' && <StatusBadge label="Live Analysis" tone="active" pulse />}
        {mode === 'final' && <StatusBadge label="Analysis Complete" tone="paused" />}
      </div>

      {mode === 'idle' ? (
        <div className={styles.empty}>Start analysis to begin collecting signals.</div>
      ) : (
        <div className={styles.barsList}>
          {config.keys.map((key) => {
            const stat = stats[key]
            const value = mode === 'final' ? stat.average : stat.current
            return (
              <SignalBar
                key={key}
                label={SIGNAL_LABELS[key]}
                value={value === null ? null : Math.round(value * 100)}
                samples={stat.samples}
                isExperimental={EXPERIMENTAL_SIGNAL_KEYS.includes(key)}
                isFinal={mode === 'final'}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
