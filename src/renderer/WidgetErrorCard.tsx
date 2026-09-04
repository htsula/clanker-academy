import type { WidgetVersion } from '../course/widget-registry'

// The inline error card for an unsatisfiable widget (§11.6a). It names the
// identity and both versions, sits where the widget would be, and never
// propagates — one bad widget leaves the rest of the course readable.

export function WidgetErrorCard({
  identity,
  shipped,
  reason,
}: {
  identity: string
  shipped?: WidgetVersion
  reason: string
}) {
  return (
    <div className="widget-error-card" role="status">
      <span className="widget-error-label">widget</span>
      <span className="widget-error-identity">{identity}</span>
      {shipped ? (
        <span className="widget-error-versions">
          requested {identity} · renderer ships {shipped.major}.{shipped.minor}
        </span>
      ) : null}
      <span className="widget-error-reason">{reason}</span>
    </div>
  )
}