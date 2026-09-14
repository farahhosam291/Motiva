import styles from './SignalBar.module.css'

interface SignalBarProps {
  label: string
  /** 0-100, or null when there is not yet a reliable value to show. */
  value: number | null
  samples: number
  isExperimental?: boolean
  isFinal?: boolean
}

export default function SignalBar({
  label,
  value,
  samples,
  isExperimental = false,
  isFinal = false,
}: SignalBarProps) {
  const hasValue = value !== null && samples > 0

  return (
    <div className={styles.row}>
      <div className={styles.labelRow}>
        <span className={styles.label}>
          {label}
          {isExperimental && <span className={styles.experimentalTag}>Experimental</span>}
        </span>
        <span className={hasValue ? styles.value : `${styles.value} ${styles.valueMuted}`}>
          {hasValue ? `${Math.round(value)}%` : 'Insufficient Data'}
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isFinal ? styles.fillFinal : ''}`}
          style={{ width: `${hasValue ? Math.round(value) : 0}%` }}
        />
      </div>
    </div>
  )
}
