export type RasterCheck = { ok: true } | { ok: false; reason: string }

const PNG = [0x89, 0x50, 0x4e, 0x47]
const JPEG = [0xff, 0xd8, 0xff]
const GIF = [0x47, 0x49, 0x46]
const BMP = [0x42, 0x4d]
const RIFF = [0x52, 0x49, 0x46, 0x46]

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => bytes[i] === b)
}

// Raster only (§8.3). SVG is rejected outright — it carries script and is not
// worth sanitizing. Anything that is not a known raster signature is refused.
export function isRasterImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  if (startsWith(bytes, PNG) || startsWith(bytes, JPEG) || startsWith(bytes, GIF) || startsWith(bytes, BMP)) {
    return true
  }
  if (startsWith(bytes, RIFF)) {
    return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP'
  }
  return false
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, 300)).trimStart()
  return head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg')
}

export function checkRaster(bytes: Uint8Array): RasterCheck {
  if (isRasterImage(bytes)) return { ok: true }
  if (looksLikeSvg(bytes)) return { ok: false, reason: 'SVG is not supported — raster images only' }
  if (bytes.length < 12) return { ok: false, reason: 'not an image file' }
  return { ok: false, reason: 'file does not decode as a known raster image' }
}

export function bytesToObjectUrl(bytes: Uint8Array): string {
  const blob = new Blob([bytes.slice(0)], { type: 'application/octet-stream' })
  return URL.createObjectURL(blob)
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url)
}