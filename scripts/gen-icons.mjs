// Regenerates the committed icons from the drawing in icon-art.mjs. Run with
// `npm run icons`, which installs sharp temporarily so it is not a dependency
// of every build.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import { iconSvg } from './icon-art.mjs'

mkdirSync('public/icons', { recursive: true })

const rounded = Buffer.from(iconSvg({ shape: 'rounded' }))
// iOS and Android cut their own corners; transparent corners would show as
// black on an iPhone home screen, so these are full-bleed squares.
const square = Buffer.from(iconSvg({ shape: 'square' }))
const maskable = Buffer.from(iconSvg({ shape: 'square', scale: 0.84 }))

const png = (svg, size, file) => sharp(svg, { density: Math.ceil((72 * size) / 512) * 2 }).resize(size, size).png().toFile(file)

await png(rounded, 192, 'public/icons/icon-192.png')
await png(rounded, 512, 'public/icons/icon-512.png')
await png(maskable, 512, 'public/icons/maskable-512.png')
await png(square, 180, 'public/apple-touch-icon.png')
await png(rounded, 32, 'public/favicon-32.png')
writeFileSync('public/favicon.svg', iconSvg({ shape: 'rounded' }))

console.log('Icons generated.')
