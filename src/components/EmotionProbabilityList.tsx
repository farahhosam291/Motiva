import { EMOTION_LABELS, type EmotionLabel, type EmotionProbabilities } from '../types/facialAI'
import styles from './EmotionProbabilityList.module.css'

interface EmotionProbabilityListProps {
  probabilities: EmotionProbabilities
  /** Highlighted as the top row's fill; defaults to whichever class is
   *  actually highest in `probabilities`. */
  topLabel?: EmotionLabel | null
}

export function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function EmotionProbabilityList({ probabilities, topLabel }: EmotionProbabilityListProps) {
  const sorted = EMOTION_LABELS.map((label) => [label, probabilities[label]] as const).sort(
    (a, b) => b[1] - a[1],
  )
  const top = topLabel ?? sorted[0]?.[0]

  return (
    <div className={styles.list}>
      {sorted.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowLabel}>{capitalize(label)}</span>
            <span className={styles.rowValue}>{Math.round(value * 100)}%</span>
          </div>
          <div className={styles.track}>
            <div
              className={`${styles.fill} ${label === top ? styles.fillTop : ''}`}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
