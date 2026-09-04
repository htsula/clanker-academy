import { useMemo, useState } from 'react'
import type { Figure } from '../course/schema'
import { bytesToDataUrl, checkRaster } from '../course/images'
import { InlineContent } from './Inline'

// Figures render only from bytes held in memory — nothing loads from the
// network at render time (the CSP forbids it anyway). SVG is rejected outright,
// and a missing or non-raster payload renders an inline error in place. A
// decode failure flips a state, never hand-mutated DOM.

export function FigureBlock({ block, bytes }: { block: Figure; bytes?: Uint8Array }) {
  const check = useMemo(
    () => (bytes ? checkRaster(bytes) : { ok: false as const, reason: 'figure not found in this course' }),
    [bytes],
  )
  const [decodeFailed, setDecodeFailed] = useState(false)

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

  if (decodeFailed) {
    return (
      <figure className="figure">
        <div className="figure-frame">
          <span className="figure-error" role="status">
            image failed to decode
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
          src={dataUrl}
          alt=""
          onLoad={() => setDecodeFailed(false)}
          onError={() => setDecodeFailed(true)}
        />
      </div>
      {caption}
    </figure>
  )
}