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
  const raw = (value as { blocks?: unknown }).blocks
  if (!Array.isArray(raw)) {
    throw new Error('lesson blocks must be an array')
  }
  const blocks: RenderableBlock[] = []
  for (const rawBlock of raw) {
    const parsed = blockSchema.safeParse(rawBlock)
    if (parsed.success) {
      blocks.push(parsed.data)
    } else {
      const rawType = (rawBlock as { type?: unknown }).type
      blocks.push({
        type: typeof rawType === 'string' ? rawType : '(untyped)',
        parseError: parsed.error.issues[0]?.message ?? 'failed to parse',
      })
    }
  }
  return { ...header, blocks }
}