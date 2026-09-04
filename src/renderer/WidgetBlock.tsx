import type { WidgetInstance } from '../course/schema'
import { resolveWidget } from '../course/widget-registry'
import '../course/widgets'
import { WidgetErrorCard } from './WidgetErrorCard'

export function WidgetBlock({ block }: { block: WidgetInstance }) {
  const resolved = resolveWidget(block.name, block.version, block.parameters)

  switch (resolved.status) {
    case 'ok':
      return <div className="widget">{resolved.registration.render(resolved.params)}</div>
    case 'unknown-name':
      return <WidgetErrorCard identity={`${block.name}@${block.version}`} reason="unknown widget in this build" />
    case 'unknown-major':
      return (
        <WidgetErrorCard
          identity={`${block.name}@${block.version}`}
          reason={`no ${block.name} major ${block.version.split('.')[0]} in this build`}
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