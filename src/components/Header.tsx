import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>University Research Project · Physical AI Lab</span>
        <h1 className={styles.title}>EmotiSense AI</h1>
        <p className={styles.subtitle}>
          A Physical AI research interface for observing human body language and estimating
          emotional state from non-verbal behavioral signals.
        </p>
      </div>
    </header>
  )
}
