import { useEffect, useRef } from 'react'

/**
 * Runs `callback` every `delayMs` while `enabled` is true and the tab is visible.
 * When the tab becomes visible again it runs once straight away, then resumes.
 * A tick is skipped if the previous one is still running.
 */
export function useVisibleInterval(callback: () => Promise<void>, delayMs: number, enabled: boolean) {
  const latestCallback = useRef(callback)

  useEffect(() => {
    latestCallback.current = callback
  })

  useEffect(() => {
    if (!enabled) return

    let timer: number | undefined
    let running = false

    async function tick() {
      if (running) return
      running = true
      try {
        await latestCallback.current()
      } catch {
        // Best effort: the next tick tries again.
      } finally {
        running = false
      }
    }

    function start() {
      timer ??= window.setInterval(tick, delayMs)
    }

    function stop() {
      window.clearInterval(timer)
      timer = undefined
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void tick()
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [delayMs, enabled])
}
