import type { RenderableBlock } from '../course/load'

export function BlockPlaceholder({ block }: { block: RenderableBlock }) {
  return (
    <div className="block-placeholder" role="status">
      <span className="block-placeholder-label">Unrecognised block</span>
      <span className="block-placeholder-type">type: {block.type}</span>
      {'parseError' in block ? <span className="block-placeholder-reason">{block.parseError}</span> : null}
    </div>
  )
}