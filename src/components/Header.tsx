import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Motiva</h1>
        <p className={styles.subtitle}>Understanding the signals behind human behavior.</p>
        <p className={styles.supportingLine}>
          Motiva analyzes facial expressions, body movement, gaze, and behavioral patterns to
          estimate how a person may be feeling over time.
        </p>
      </div>
    </header>
  )
}
