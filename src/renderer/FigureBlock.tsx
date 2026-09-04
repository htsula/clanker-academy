import { useMemo, useState } from 'react'
import type { Figure } from '../course/schema'
import { bytesToDataUrl, checkRaster } from '../course/images'
import { InlineContent } from './Inline'

// Figures render only from bytes held in memory — nothing loads from the
// network at render time (the CSP forbids it anyway). SVG is rejected outright,
// and a missing or non-raster payload renders an inline error in place.

// The decode-failure state lives in a child keyed by the data URL, so a change
// of bytes remounts it fresh: an old "failed" latch cannot survive new input,
// and the error branch's lack of an <img> never strands a reset.
function FigureImage({ dataUrl }: { dataUrl: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="figure-error" role="status">
        image failed to decode
      </span>
    )
  }
  return (
    <img src={dataUrl} alt="" onLoad={() => setFailed(false)} onError={() => setFailed(true)} />
  )
}

export function FigureBlock({ block, bytes }: { block: Figure; bytes?: Uint8Array }) {
  const check = useMemo(
    () => (bytes ? checkRaster(bytes) : { ok: false as const, reason: 'figure not found in this course' }),
    [bytes],
  )
  const dataUrl = useMemo(() => (check.ok ? bytesToDataUrl(bytes!) : null), [check, bytes])

  const caption = block.caption ? (
    <figcaption>
      <InlineContent content={block.caption} />
    </figcaption>
  ) : null

  if (!check.ok || !dataUrl) {
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
        <FigureImage key={dataUrl} dataUrl={dataUrl} />
      </div>
      {caption}
    </figure>
  )
}