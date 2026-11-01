import { useEffect, useState } from 'react'

// Re-render on an interval while `active`. Timers derive remaining time from
// timestamps, so they stay correct after the phone sleeps or the tab is hidden.
export function useNow(active = true, intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, intervalMs])
  return now
}
