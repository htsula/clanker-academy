import { zlibSync } from 'fflate'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'src', 'fixtures', 'figures')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function makePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 4
      raw[i] = rgba[y][x][0]
      raw[i + 1] = rgba[y][x][1]
      raw[i + 2] = rgba[y][x][2]
      raw[i + 3] = rgba[y][x][3]
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const WHITE = [255, 255, 255, 255]
const INK = [30, 30, 30, 255]
const AXIS = [120, 120, 120, 255]
const CURVE = [16, 96, 176, 255]
const FILL = [220, 235, 248, 255]

function newCanvas(w, h) {
  const px = Array.from({ length: h }, () => Array.from({ length: w }, () => [...WHITE]))
  function set(x, y, c) {
    if (x >= 0 && x < w && y >= 0 && y < h) px[y][x] = [...c]
  }
  function line(x0, y0, x1, y1, c) {
    let x = Math.round(x0)
    let y = Math.round(y0)
    const x1r = Math.round(x1)
    const y1r = Math.round(y1)
    const dx = Math.abs(x1r - x)
    const dy = -Math.abs(y1r - y)
    const sx = x < x1r ? 1 : -1
    const sy = y < y1r ? 1 : -1
    let err = dx + dy
    for (;;) {
      set(x, y, c)
      if (x === x1r && y === y1r) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x += sx
      }
      if (e2 <= dx) {
        err += dx
        y += sy
      }
    }
  }
  function circle(cx, cy, r, c, filled) {
    const ccx = Math.round(cx)
    const ccy = Math.round(cy)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dy * dy
        if (filled ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) set(ccx + dx, ccy + dy, c)
      }
    }
  }
  return { px, set, line, circle }
}

function viewport(w, h, margin, xmin, xmax, ymin, ymax) {
  const ww = w - 2 * margin
  const wh = h - 2 * margin
  function fx(x) {
    return margin + ((x - xmin) / (xmax - xmin)) * ww
  }
  function fy(y) {
    return h - margin - ((y - ymin) / (ymax - ymin)) * wh
  }
  return { fx, fy }
}

function drawAxes(c, v, xmin, xmax, ymin, ymax, ticks) {
  const x0 = v.fx(0)
  const y0 = v.fy(0)
  if (x0 >= 0 && x0 < c.px[0].length) c.line(x0, v.fy(ymin), x0, v.fy(ymax), AXIS)
  if (y0 >= 0 && y0 < c.px[0].length) c.line(v.fx(xmin), y0, v.fx(xmax), y0, AXIS)
  for (const t of ticks.x ?? []) {
    const xt = v.fx(t)
    c.line(xt, v.fy(0) - 4, xt, v.fy(0) + 4, AXIS)
  }
  for (const t of ticks.y ?? []) {
    const yt = v.fy(t)
    c.line(v.fx(0) - 4, yt, v.fx(0) + 4, yt, AXIS)
  }
}

function limitApproach() {
  const w = 560
  const h = 360
  const c = newCanvas(w, h)
  const v = viewport(w, h, 44, -0.4, 3.4, -0.5, 4.5)
  drawAxes(c, v, -0.4, 3.4, -0.5, 4.5, { x: [-1, 0, 1, 2, 3], y: [-1, 0, 1, 2, 3, 4] })
  const x0 = v.fx(-0.4)
  const y0 = v.fy(-0.4 + 1)
  const x1 = v.fx(3.4)
  const y1 = v.fy(3.4 + 1)
  c.line(x0, y0, x1, y1, CURVE)
  const holeX = v.fx(1)
  const holeY = v.fy(2)
  c.circle(holeX, holeY, 5, WHITE, true)
  c.circle(holeX, holeY, 5, CURVE, false)
  const fromLeft = { x: v.fx(0.35), y: v.fy(1.35) }
  const toHole = { x: v.fx(0.92), y: v.fy(1.92) }
  c.line(fromLeft.x, fromLeft.y, toHole.x, toHole.y, FILL)
  const px = v.fx(0.78)
  const py = v.fy(1.78)
  c.circle(px, py, 3, CURVE, true)
  const dim = (xx, yy, label) => {
    const xd = v.fx(xx)
    const yd = v.fy(yy)
    c.circle(xd, yd, 3, INK, true)
    const glyph = label.split('')
    for (let i = 0; i < glyph.length; i++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) c.set(xd + 8 + i * 6 + dx, yd - 10 + dy, INK)
      }
    }
  }
  dim(2.2, 3.2, '')
  const p = c.px
  const img = makePng(w, h, p)
  writeFileSync(resolve(outDir, 'limit-approach.png'), img)
}

function jumpDiscontinuity() {
  const w = 560
  const h = 360
  const c = newCanvas(w, h)
  const v = viewport(w, h, 44, -0.5, 4.5, -0.5, 4.5)
  drawAxes(c, v, -0.5, 4.5, -0.5, 4.5, { x: [-1, 0, 1, 2, 3, 4], y: [-1, 0, 1, 2, 3, 4] })
  c.line(v.fx(-0.5), v.fy(1), v.fx(2), v.fy(1), CURVE)
  c.circle(v.fx(2), v.fy(1), 5, WHITE, true)
  c.circle(v.fx(2), v.fy(1), 5, CURVE, false)
  c.line(v.fx(2), v.fy(3), v.fx(4.5), v.fy(3), CURVE)
  c.circle(v.fx(2), v.fy(3), 5, CURVE, true)
  const img = makePng(w, h, c.px)
  writeFileSync(resolve(outDir, 'jump-discontinuity.png'), img)
}

limitApproach()
jumpDiscontinuity()
console.log('figures written to', outDir)