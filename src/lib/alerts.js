// Sound, vibration and screen wake lock for timers. Every call is best-effort:
// unsupported browsers simply skip the effect.

let audioCtx = null

// Must be called from a tap/click handler first: iOS only allows audio that
// was unlocked by a user gesture.
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    audioCtx = null
  }
}

export function beep({ times = 1, frequency = 880, duration = 0.18 } = {}) {
  try {
    if (!audioCtx) return
    const start = audioCtx.currentTime
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.frequency.value = frequency
      osc.type = 'sine'
      const t = start + i * (duration + 0.12)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(t)
      osc.stop(t + duration + 0.02)
    }
  } catch {
    // ignore
  }
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}

// Short taps for in-app feedback (Android; iPhone browsers have no vibration).
const HAPTICS = { tap: 8, success: [14, 40, 22], complete: [18, 50, 18, 50, 70] }

export function haptic(kind = 'tap') {
  vibrate(HAPTICS[kind] ?? HAPTICS.tap)
}

export function alertDone() {
  beep({ times: 3 })
  vibrate([200, 100, 200, 100, 200])
}

export function alertChange() {
  beep({ times: 2, frequency: 660 })
  vibrate([300, 150, 300])
}

let wakeLock = null

export async function keepScreenOn() {
  try {
    if (!('wakeLock' in navigator) || wakeLock) return
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch {
    wakeLock = null
  }
}

export function releaseScreen() {
  try {
    wakeLock?.release()
  } catch {
    // ignore
  }
  wakeLock = null
}
