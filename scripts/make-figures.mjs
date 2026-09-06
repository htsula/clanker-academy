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

// Dashed line: step along the segment in pixel space, alternating on/off runs.
function dash(c, x0, y0, x1, y1, color, on = 8, off = 6) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len === 0) return
  const ux = dx / len
  const uy = dy / len
  let d = 0
  let draw = true
  while (d < len) {
    const run = Math.min(draw ? on : off, len - d)
    if (draw) c.line(x0 + ux * d, y0 + uy * d, x0 + ux * (d + run), y0 + uy * (d + run), color)
    d += run
    draw = !draw
  }
}

// Arrow: a shaft plus a two-segment head at the tip, drawn toward (x1, y1).
function arrow(c, x0, y0, x1, y1, color, head = 8) {
  c.line(x0, y0, x1, y1, color)
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len === 0) return
  const ux = dx / len
  const uy = dy / len
  const back = Math.min(head, len * 0.6)
  const bx = x1 - ux * back
  const by = y1 - uy * back
  const perp = head * 0.45
  c.line(x1, y1, bx - uy * perp, by + ux * perp, color)
  c.line(x1, y1, bx + uy * perp, by - ux * perp, color)
}

// Sample a function and draw it as a polyline; points outside the viewport
// are clipped per segment so the curve stays continuous at the frame edge.
function curve(c, v, f, xmin, xmax, n, color) {
  let prev = null
  for (let i = 0; i <= n; i++) {
    const x = xmin + ((xmax - xmin) * i) / n
    const px = v.fx(x)
    const py = v.fy(f(x))
    if (prev) c.line(prev[0], prev[1], px, py, color)
    prev = [px, py]
  }
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

function oneSidedLimits() {
  const w = 560
  const h = 360
  const c = newCanvas(w, h)
  const v = viewport(w, h, 44, -0.5, 4.5, -0.5, 5.5)
  drawAxes(c, v, -0.5, 4.5, -0.5, 5.5, { x: [-1, 0, 1, 2, 3, 4], y: [-1, 0, 1, 2, 3, 4, 5] })
  curve(c, v, (x) => x * x, 0.4, 3.6, 120, CURVE)
  const onCurve = (x) => v.fy(x * x)
  // Approach trails on each side, arrowheads pointing at (2, 4).
  arrow(c, v.fx(1.2), onCurve(1.2), v.fx(1.95), onCurve(1.95), FILL)
  arrow(c, v.fx(2.8), onCurve(2.8), v.fx(2.05), onCurve(2.05), FILL)
  c.circle(v.fx(2), v.fy(4), 5, CURVE, true)
  const img = makePng(w, h, c.px)
  writeFileSync(resolve(outDir, 'one-sided-limits.png'), img)
}

function intermediateValue() {
  const w = 560
  const h = 360
  const c = newCanvas(w, h)
  const v = viewport(w, h, 44, 0.2, 2.8, -2.2, 6.2)
  drawAxes(c, v, 0.2, 2.8, -2.2, 6.2, { x: [0, 1, 2, 3], y: [-2, -1, 0, 1, 2, 3, 4, 5, 6] })
  dash(c, v.fx(0.2), v.fy(0), v.fx(2.8), v.fy(0), AXIS)
  curve(c, v, (x) => x * x * x - x - 1, 1, 2, 120, CURVE)
  c.circle(v.fx(1), v.fy(-1), 5, CURVE, true)
  c.circle(v.fx(2), v.fy(5), 5, CURVE, true)
  c.circle(v.fx(1.3247), v.fy(0), 5, INK, true)
  const img = makePng(w, h, c.px)
  writeFileSync(resolve(outDir, 'ivt.png'), img)
}

function horizontalAsymptote() {
  const w = 560
  const h = 360
  const c = newCanvas(w, h)
  const v = viewport(w, h, 44, -1.5, 11.5, -6.5, 10.5)
  drawAxes(c, v, -1.5, 11.5, -6.5, 10.5, {
    x: [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    y: [-6, -4, -2, 0, 2, 4, 6, 8, 10],
  })
  dash(c, v.fx(-1.5), v.fy(2), v.fx(11.5), v.fy(2), AXIS)
  curve(c, v, (x) => (2 * x + 1) / (x - 1), 1.12, 11.5, 160, CURVE)
  curve(c, v, (x) => (2 * x + 1) / (x - 1), -1.5, 0.88, 160, CURVE)
  const img = makePng(w, h, c.px)
  writeFileSync(resolve(outDir, 'horizontal-asymptote.png'), img)
}

function verticalAsymptote() {
  const w = 560
  const h = 360
  const c = newCanvas(w, h)
  const v = viewport(w, h, 44, -2.5, 6.5, -5.5, 5.5)
  drawAxes(c, v, -2.5, 6.5, -5.5, 5.5, { x: [-2, -1, 0, 1, 2, 3, 4, 5, 6], y: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] })
  dash(c, v.fx(2), v.fy(-5.5), v.fx(2), v.fy(5.5), AXIS)
  curve(c, v, (x) => 1 / (x - 2), -2.5, 1.82, 160, CURVE)
  curve(c, v, (x) => 1 / (x - 2), 2.18, 6.5, 160, CURVE)
  const img = makePng(w, h, c.px)
  writeFileSync(resolve(outDir, 'vertical-asymptote.png'), img)
}

limitApproach()
jumpDiscontinuity()
oneSidedLimits()
intermediateValue()
horizontalAsymptote()
verticalAsymptote()
console.log('figures written to', outDir)