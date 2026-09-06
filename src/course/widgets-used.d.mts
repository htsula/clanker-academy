import type { Block } from './schema'

export interface WidgetIdentity {
  name: string
  version: string
}

export function collectWidgets(blocks: readonly Block[]): WidgetIdentity[]