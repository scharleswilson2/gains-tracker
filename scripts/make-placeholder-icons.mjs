import { writeFileSync } from 'node:fs'

// Minimal valid 1x1 red PNG, byte-for-byte, reused at both sizes via manifest scaling.
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

writeFileSync('public/pwa-192.png', onePixelPng)
writeFileSync('public/pwa-512.png', onePixelPng)
console.log('Wrote placeholder PWA icons — replace with real artwork later.')
