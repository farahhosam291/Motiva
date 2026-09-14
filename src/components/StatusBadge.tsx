import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  label: string
  tone?: 'neutral' | 'active' | 'paused'
  pulse?: boolean
}

export default function StatusBadge({ label, tone = 'neutral', pulse = false }: StatusBadgeProps) {
  const classNames = [styles.badge, styles[tone], pulse ? styles.pulse : ''].join(' ').trim()

  return (
    <span className={classNames}>
      <span className={styles.dot} />
      {label}
    </span>
  )
}
