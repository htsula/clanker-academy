import type { Block } from './schema'
import { block as blockSchema, lessonSchema } from './schema'

// A renderable block is either a valid block or a labelled hole. Unknown or
// invalid blocks become holes so the rest of the lesson stays readable — the
// schema rejects hostile input at the container boundary (step 11); the
// renderer additionally never fails the whole lesson over one element.

export interface UnknownBlock {
  type: string
  parseError: string
}

export type RenderableBlock = Block | UnknownBlock

export interface LoadedLesson {
  id: string
  title: string
  atom_ids: string[]
  blocks: RenderableBlock[]
}

const lessonHeader = lessonSchema.pick({ id: true, title: true, atom_ids: true })

export function loadLesson(value: unknown): LoadedLesson {
  const header = lessonHeader.parse(value)
  const rawBlocks = (value as { blocks?: unknown[] }).blocks ?? []
  const blocks: RenderableBlock[] = []
  for (const raw of rawBlocks) {
    const parsed = blockSchema.safeParse(raw)
    if (parsed.success) {
      blocks.push(parsed.data)
    } else {
      const rawType = (raw as { type?: unknown }).type
      blocks.push({
        type: typeof rawType === 'string' ? rawType : '(untyped)',
        parseError: parsed.error.issues[0]?.message ?? 'failed to parse',
      })
    }
  }
  return { ...header, blocks }
}