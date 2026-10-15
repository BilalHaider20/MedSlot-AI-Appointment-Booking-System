import styles from './Logo.module.css'

// The mark is a heart drawn as a check: the left lobe runs down to the check's
// low point and the long stroke rises into the right lobe.
const LEFT = 'M31 18.5C27 12.5 20.5 9.5 14.5 12.5C8 16 7.5 24.5 13 30L26.5 43.5'
const RIGHT = 'M26.5 43.5L50 20C54 16 52.5 10 47 9.5C41.5 9 35 12 31 18.5'

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className={styles.logo}>
      <svg
        className={styles.mark}
        viewBox="3.5 5 55 43"
        width={size}
        height={(size * 43) / 55}
        fill="none"
        strokeWidth={7.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={LEFT} className={styles.left} />
        <path d={RIGHT} className={styles.right} />
      </svg>
      Medslot
    </span>
  )
}
