// A shareable image of a finished fast: the stage ring filled to the length
// of the fast, the time, the deepest stage reached and the date. Drawn on a
// canvas in the browser; nothing is uploaded.

import { FAST_STAGES, fastHours, formatDuration, stageAt } from '../logic/fasting.js'

const W = 1080
const H = 1350

function arc(ctx, cx, cy, r, h0, h1, color, width) {
  const a = (h) => ((h / 24) * 360 - 90) * (Math.PI / 180)
  ctx.beginPath()
  ctx.arc(cx, cy, r, a(h0), a(h1))
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.stroke()
}

/** Resolves with a PNG Blob for the given fast log. */
export async function renderShareCard(log, { fontFamily = "'Barlow Condensed', system-ui, sans-serif" } = {}) {
  if (document.fonts?.load) await Promise.all([document.fonts.load(`700 120px ${fontFamily}`), document.fonts.load(`600 40px ${fontFamily}`)]).catch(() => {})
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const hours = fastHours(log)
  const stage = stageAt(hours)

  const bg = ctx.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.42, H * 0.8)
  bg.addColorStop(0, '#3a1806')
  bg.addColorStop(0.5, '#1a1310')
  bg.addColorStop(1, '#111315')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const cx = W / 2
  const cy = 560
  const r = 330
  for (let i = 0; i < 5; i++) {
    const s = FAST_STAGES[i]
    const to = FAST_STAGES[i + 1].from
    arc(ctx, cx, cy, r, s.from + 0.15, to - 0.15, s.color + '33', 56)
    if (hours > s.from) arc(ctx, cx, cy, r, s.from + 0.15, Math.min(to - 0.15, hours), s.color, 56)
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = stage.color
  ctx.font = `600 46px ${fontFamily}`
  ctx.fillText(stage.name.toUpperCase(), cx, cy - 110)
  ctx.fillStyle = '#f4f4f2'
  ctx.font = `700 170px ${fontFamily}`
  ctx.fillText(formatDuration(hours), cx, cy + 50)
  ctx.fillStyle = '#b9bbb6'
  ctx.font = `600 44px ${fontFamily}`
  ctx.fillText(log.targetHours ? `${log.targetHours}h goal ${hours >= log.targetHours ? 'reached' : ''}`.trim() : 'Open fast', cx, cy + 130)

  ctx.fillStyle = '#f4f4f2'
  ctx.font = `600 52px ${fontFamily}`
  ctx.fillText(new Date(log.endedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), cx, 1060)
  ctx.fillStyle = '#ff7a1a'
  ctx.font = `700 64px ${fontFamily}`
  ctx.fillText('FORGE FAST', cx, 1220)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'))
}

/** Shares the card through the phone's share sheet, or downloads it. */
export async function shareFast(log) {
  const blob = await renderShareCard(log)
  const name = `forge-fast-${log.endedAt.slice(0, 10)}.png`
  const file = new File([blob], name, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My fast' })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'downloaded'
}
