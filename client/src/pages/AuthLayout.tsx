import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <div className={styles.brand}>
          <Logo size={28} />
        </div>
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
        </div>
        <div className={styles.footer}>{footer}</div>
      </div>
    </main>
  )
}
