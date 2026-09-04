import type { RenderableBlock } from '../course/load'
import {
  CalloutBlock,
  DefinitionBlock,
  EquationBlock,
  FigureBlock,
  HeadingBlock,
  ListBlock,
  ParagraphBlock,
  WorkedExampleBlock,
} from './blocks'
import { BlockPlaceholder } from './BlockPlaceholder'
import { FormativeBlock } from './FormativeBlock'
import { WidgetPlaceholder } from './WidgetPlaceholder'

export function BlockRenderer({ block }: { block: RenderableBlock }) {
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
      return <FigureBlock block={block} />
    case 'widget':
      return <WidgetPlaceholder block={block} />
    case 'formative':
      return <FormativeBlock block={block} />
    default:
      return <BlockPlaceholder block={block} />
  }
}