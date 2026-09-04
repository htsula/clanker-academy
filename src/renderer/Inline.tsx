import type { Inline } from '../course/schema'
import { InlineMath } from './InlineMath'

export function InlineContent({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((seg, i) =>
        seg.type === 'text' ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <InlineMath key={i} source={seg.source} />
        ),
      )}
    </>
  )
}