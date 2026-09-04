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
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null
  if (startsWith(bytes, PNG)) return 'image/png'
  if (startsWith(bytes, JPEG)) return 'image/jpeg'
  if (startsWith(bytes, GIF)) return 'image/gif'
  if (startsWith(bytes, BMP)) return 'image/bmp'
  if (startsWith(bytes, RIFF) && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP') {
    return 'image/webp'
  }
  return null
}

export function isRasterImage(bytes: Uint8Array): boolean {
  return detectImageType(bytes) !== null
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

// Data URLs are self-contained: no blob lifecycle to leak or to revoke under
// React StrictMode's mount→cleanup→remount. The CSP already allows data:.
export function bytesToDataUrl(bytes: Uint8Array): string | null {
  const mime = detectImageType(bytes)
  if (!mime) return null
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mime};base64,${btoa(binary)}`
}