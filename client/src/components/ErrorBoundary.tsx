import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import styles from './ErrorBoundary.module.css'

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className={styles.screen}>
        <h1 className={styles.title}>Something went wrong.</h1>
        <p className={styles.text}>Reload the page to continue.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </main>
    )
  }
}
