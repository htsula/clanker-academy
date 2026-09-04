import { registerWidget } from '../widget-registry'
import { PlotWidget, plotParamsSchema, type PlotParams } from './plot'

// Widgets shipped by this build. The catalogue is deliberately tiny at M0 —
// the mechanism is what this proves, and a widget shipped is a widget
// supported forever (§11.6), so additions are the cautious kind of work.

registerWidget({
  name: 'plot',
  major: 1,
  version: { major: 1, minor: 0 },
  schema: plotParamsSchema,
  Component: (props) => <PlotWidget params={props.params as PlotParams} />,
})