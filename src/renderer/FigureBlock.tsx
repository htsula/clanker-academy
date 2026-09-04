import { useEffect, useMemo } from 'react'
import type { Figure } from '../course/schema'
import { bytesToObjectUrl, checkRaster, revokeObjectUrl } from '../course/images'
import { InlineContent } from './Inline'

// Figures render only from bytes held in memory — nothing loads from the
// network at render time (the CSP forbids it anyway). SVG is rejected outright,
// and a missing or non-raster payload renders an inline error in place.

export function FigureBlock({ block, bytes }: { block: Figure; bytes?: Uint8Array }) {
  const check = useMemo(
    () => (bytes ? checkRaster(bytes) : { ok: false as const, reason: 'figure not found in this course' }),
    [bytes],
  )

  const objectUrl = useMemo(() => {
    if (!check.ok) return null
    return bytesToObjectUrl(bytes!)
  }, [check, bytes])

  useEffect(() => {
    return () => {
      if (objectUrl) revokeObjectUrl(objectUrl)
    }
  }, [objectUrl])

  const caption = block.caption ? (
    <figcaption>
      <InlineContent content={block.caption} />
    </figcaption>
  ) : null

  if (!check.ok || !objectUrl) {
    return (
      <figure className="figure">
        <div className="figure-frame">
          <span className="figure-error" role="status">
            {check.ok ? '' : check.reason}
          </span>
        </div>
        {caption}
      </figure>
    )
  }

  return (
    <figure className="figure">
      <div className="figure-frame">
        <img
          src={objectUrl}
          alt=""
          onError={(e) => {
            const img = e.currentTarget
            const badge = document.createElement('span')
            badge.className = 'figure-error'
            badge.setAttribute('role', 'status')
            badge.textContent = 'image failed to decode'
            img.replaceWith(badge)
          }}
        />
      </div>
      {caption}
    </figure>
  )
}