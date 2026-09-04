import type { WidgetInstance } from '../course/schema'

export function WidgetPlaceholder({ block }: { block: WidgetInstance }) {
  return (
    <div className="widget-error-card" role="status">
      <span className="widget-error-label">widget</span>
      <span className="widget-error-identity">
        {block.name}@{block.version}
      </span>
      <span className="widget-error-reason">not implemented in this build</span>
    </div>
  )
}