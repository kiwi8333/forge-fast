import { useEffect, useState } from 'react'

// Re-render on an interval while `active` and the app is on screen. Timers
// derive remaining time from timestamps, so they stay correct after the phone
// sleeps; the interval stops while the app is hidden to save battery, and
// catches up the moment it is shown again.
export function useNow(active = true, intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    let id = null
    const start = () => {
      if (id === null) id = setInterval(() => setNow(Date.now()), intervalMs)
    }
    const stop = () => {
      clearInterval(id)
      id = null
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        setNow(Date.now())
        start()
      }
    }
    setNow(Date.now())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, intervalMs])
  return now
}
