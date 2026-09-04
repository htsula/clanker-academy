import type { WidgetInstance } from '../course/schema'
import { resolveWidget } from '../course/widget-registry'
import '../course/widgets'
import { WidgetErrorBoundary } from './WidgetErrorBoundary'
import { WidgetErrorCard } from './WidgetErrorCard'

export function WidgetBlock({ block }: { block: WidgetInstance }) {
  const resolved = resolveWidget(block.name, block.version, block.parameters)

  switch (resolved.status) {
    case 'ok': {
      const Comp = resolved.registration.Component
      return (
        <div className="widget">
          <WidgetErrorBoundary identity={`${block.name}@${block.version}`}>
            <Comp params={resolved.params} />
          </WidgetErrorBoundary>
        </div>
      )
    }
    case 'unknown-name':
      return <WidgetErrorCard identity={`${block.name}@${block.version}`} reason="unknown widget in this build" />
    case 'unknown-major':
      return (
        <WidgetErrorCard
          identity={`${block.name}@${block.version}`}
          reason={`no ${block.name} major ${block.version.split('.')[0]} in this build`}
        />
      )
    case 'invalid-version':
      return (
        <WidgetErrorCard
          identity={`${block.name}@${block.version}`}
          reason="malformed version — expected major.minor"
        />
      )
    case 'version-unsatisfiable':
      return (
        <WidgetErrorCard
          identity={`${block.name}@${block.version}`}
          shipped={resolved.shipped}
          reason="this widget needs a newer version of the app"
        />
      )
    case 'invalid-parameters':
      return (
        <WidgetErrorCard
          identity={`${block.name}@${block.version}`}
          reason="parameters do not match the widget's schema"
        />
      )
  }
}