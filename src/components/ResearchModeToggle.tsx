import styles from './ResearchModeToggle.module.css'

interface ResearchModeToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export default function ResearchModeToggle({ enabled, onChange }: ResearchModeToggleProps) {
  return (
    <label className={styles.wrapper}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={`${styles.switchTrack} ${enabled ? styles.switchTrackOn : ''}`}>
        <span className={`${styles.switchThumb} ${enabled ? styles.switchThumbOn : ''}`} />
      </span>
      <span>
        <span className={styles.label}>Research Mode</span>
        <br />
        <span className={styles.hint}>Show calculation detail for reports/papers</span>
      </span>
    </label>
  )
}
