import limitApproach from '../fixtures/figures/limit-approach.png?arraybuffer'
import jumpDiscontinuity from '../fixtures/figures/jump-discontinuity.png?arraybuffer'
import type { FigureMap } from '../renderer/BlockRenderer'

export const fixtureFigures: FigureMap = new Map<string, Uint8Array>([
  ['figures/limit-approach.png', new Uint8Array(limitApproach)],
  ['figures/jump-discontinuity.png', new Uint8Array(jumpDiscontinuity)],
])