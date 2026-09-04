import { Component, type ReactNode } from 'react'
import { WidgetErrorCard } from './WidgetErrorCard'

// A widget that throws during render must not take down the lesson — one bad
// element is a hole, not a crash (§11.6a, step 10). This boundary catches a
// throw from a widget's own render and replaces it with the error card.

interface Props {
  identity: string
  children: ReactNode
}

interface State {
  failed: boolean
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <WidgetErrorCard identity={this.props.identity} reason="widget crashed while rendering" />
    }
    return this.props.children
  }
}