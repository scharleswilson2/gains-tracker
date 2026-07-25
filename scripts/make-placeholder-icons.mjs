import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// Hand-rolled minimal PNG encoder (no new npm dependency — uses Node's
// built-in zlib for the DEFLATE stream). Produces a solid-color, square,
// 8-bit RGBA PNG at the requested pixel size. Real artwork can replace
// these later; what matters for PWA installability is that the icon
// files' actual decoded pixel dimensions match what the manifest claims.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lengthBuf = Buffer.alloc(4)
  lengthBuf.writeUInt32BE(data.length, 0)

  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)

  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf])
}

function makeSolidPng(size, [r, g, b, a]) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0) // width
  ihdrData.writeUInt32BE(size, 4) // height
  ihdrData.writeUInt8(8, 8) // bit depth
  ihdrData.writeUInt8(6, 9) // color type: RGBA
  ihdrData.writeUInt8(0, 10) // compression
  ihdrData.writeUInt8(0, 11) // filter
  ihdrData.writeUInt8(0, 12) // interlace
  const ihdr = chunk('IHDR', ihdrData)

  // Raw scanlines: each row prefixed with filter-type byte 0 (None).
  const rowBytes = size * 4
  const raw = Buffer.alloc((rowBytes + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1)
    raw[rowStart] = 0 // filter type: None
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
      raw[px + 3] = a
    }
  }

  const idat = chunk('IDAT', deflateSync(raw))
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// Solid dark square matching the manifest's theme_color (#111111).
const ICON_COLOR = [0x11, 0x11, 0x11, 0xff]

writeFileSync('public/pwa-192.png', makeSolidPng(192, ICON_COLOR))
writeFileSync('public/pwa-512.png', makeSolidPng(512, ICON_COLOR))
console.log('Wrote placeholder PWA icons (192x192, 512x512) — replace with real artwork later.')
