// The Forge Fast mark: the app's fasting ring, three quarters full with a
// glowing "now" dot, around an ember flame. Same dark forge and orange
// metal as the Forge training app, so the two read as a family.
//
// One drawing, three framings:
//   iconSvg({ shape: 'rounded' })  – favicon and in-browser icons
//   iconSvg({ shape: 'square' })   – full-bleed for iOS and Android, which
//                                    cut their own rounded corners
//   iconSvg({ shape: 'square', scale: 0.84 }) – maskable: the whole mark
//                                    inside Android's safe-zone circle
// Everything is drawn on a 512 × 512 grid, centred on (256, 256).

const R = 150
// The ring runs clockwise from 12 o'clock to 9 o'clock (270°).
const START = [256, 256 - R]
const END = [256 - R, 256]

const MARK = `
  <circle cx="256" cy="256" r="${R}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="40"/>
  <path d="M${START[0]} ${START[1]} A${R} ${R} 0 1 1 ${END[0]} ${END[1]}" fill="none" stroke="url(#metal)" stroke-width="40" stroke-linecap="round"/>
  <circle cx="${END[0]}" cy="${END[1]}" r="34" fill="#ff7a1a" opacity="0.35"/>
  <circle cx="${END[0]}" cy="${END[1]}" r="20" fill="#fff4e3"/>
  <!-- ember flame -->
  <path d="M256 166 C292 206 326 238 326 292 A70 70 0 0 1 186 292 C186 262 202 240 216 222 C218 248 228 262 244 266 C238 232 240 196 256 166 Z" fill="url(#flame)"/>
  <path d="M258 236 C276 258 292 274 292 300 A36 36 0 0 1 220 300 C220 284 230 272 238 262 C240 276 246 284 254 286 C250 268 250 252 258 236 Z" fill="url(#core)"/>`

export function iconSvg({ shape = 'rounded', scale = 1 } = {}) {
  const radius = shape === 'rounded' ? 112 : 0
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="forge" cx="0.5" cy="0.62" r="0.7">
      <stop offset="0" stop-color="#4a1d08"/>
      <stop offset="0.5" stop-color="#22130c"/>
      <stop offset="1" stop-color="#111315"/>
    </radialGradient>
    <linearGradient id="metal" gradientUnits="userSpaceOnUse" x1="106" y1="106" x2="406" y2="406">
      <stop offset="0" stop-color="#ffc178"/>
      <stop offset="0.5" stop-color="#ff7a1a"/>
      <stop offset="1" stop-color="#e2470b"/>
    </linearGradient>
    <linearGradient id="flame" gradientUnits="userSpaceOnUse" x1="0" y1="166" x2="0" y2="362">
      <stop offset="0" stop-color="#ffb04a"/>
      <stop offset="1" stop-color="#e2470b"/>
    </linearGradient>
    <linearGradient id="core" gradientUnits="userSpaceOnUse" x1="0" y1="236" x2="0" y2="336">
      <stop offset="0" stop-color="#fff4e3"/>
      <stop offset="1" stop-color="#ffc178"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#forge)"/>
  <g transform="${t}">${MARK}
  </g>
</svg>
`
}
