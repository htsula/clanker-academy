import type { RenderableBlock } from '../course/load'
import {
  CalloutBlock,
  DefinitionBlock,
  EquationBlock,
  HeadingBlock,
  ListBlock,
  ParagraphBlock,
  WorkedExampleBlock,
} from './blocks'
import { BlockPlaceholder } from './BlockPlaceholder'
import { FigureBlock } from './FigureBlock'
import { FormativeBlock } from './FormativeBlock'
import { WidgetBlock } from './WidgetBlock'

export type FigureMap = ReadonlyMap<string, Uint8Array>

export function BlockRenderer({ block, figures }: { block: RenderableBlock; figures: FigureMap }) {
  if ('parseError' in block) {
    return <BlockPlaceholder block={block} />
  }
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />
    case 'paragraph':
      return <ParagraphBlock block={block} />
    case 'list':
      return <ListBlock block={block} />
    case 'callout':
      return <CalloutBlock block={block} />
    case 'definition':
      return <DefinitionBlock block={block} />
    case 'worked-example':
      return <WorkedExampleBlock block={block} />
    case 'equation':
      return <EquationBlock block={block} />
    case 'figure':
      return <FigureBlock block={block} bytes={figures.get(block.src)} />
    case 'widget':
      return <WidgetBlock block={block} />
    case 'formative':
      return <FormativeBlock block={block} />
    default:
      return <BlockPlaceholder block={block} />
  }
}