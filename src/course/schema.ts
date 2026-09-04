import { z } from 'zod'

// A course file is untrusted input. Everything entering the renderer is
// validated against these schemas at the boundary. No raw HTML may exist
// anywhere in a course file, and a widget instance is a name, a version and
// parameters — never content.

// --- Security helpers ----------------------------------------------------

const HTML_TAG = /<[a-z!/][^>]*>/i
const JS_HOOK = /(on\w+\s*=|javascript\s*:)/i

export const noHtml = z
  .string()
  .refine((s) => !HTML_TAG.test(s) && !JS_HOOK.test(s), {
    message: 'HTML-like content is not allowed in course files',
  })

// --- Math caps ------------------------------------------------------------

export const MATH_SOURCE_MAX = 512
export const MATH_DEPTH_MAX = 32

export function mathDepth(source: string): number {
  let depth = 0
  let max = 0
  for (const ch of source) {
    if (ch === '{') {
      depth += 1
      if (depth > max) max = depth
    } else if (ch === '}') {
      depth -= 1
    }
  }
  return max
}

const boundedMath = z
  .string()
  .max(MATH_SOURCE_MAX, 'equation exceeds the length cap')
  .refine((s) => mathDepth(s) <= MATH_DEPTH_MAX, 'equation exceeds the nesting cap')

// --- Inline content --------------------------------------------------------

export const inlineText = z.object({
  type: z.literal('text'),
  text: noHtml,
})

export const inlineMath = z.object({
  type: z.literal('math'),
  source: boundedMath,
})

export const inline = z.union([inlineText, inlineMath])
export const inlineArray = z.array(inline).min(1)

// --- Blocks ----------------------------------------------------------------

export const heading = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  content: inlineArray,
})

export const paragraph = z.object({
  type: z.literal('paragraph'),
  content: inlineArray,
})

export const list = z.object({
  type: z.literal('list'),
  ordered: z.boolean(),
  items: z.array(inlineArray).min(1),
})

export const callout = z.object({
  type: z.literal('callout'),
  kind: z.enum(['note', 'warning', 'important']),
  content: inlineArray,
})

export const definition = z.object({
  type: z.literal('definition'),
  term: noHtml,
  content: inlineArray,
})

export const workedExample = z.object({
  type: z.literal('worked-example'),
  title: noHtml.optional(),
  problem: inlineArray,
  solution: z.array(inlineArray).min(1),
})

export const equation = z.object({
  type: z.literal('equation'),
  source: boundedMath,
  display: z.boolean().default(true),
  number: noHtml.optional(),
})

export const figure = z.object({
  type: z.literal('figure'),
  src: noHtml,
  caption: inlineArray.optional(),
  atom_id: noHtml.optional(),
})

export const widget = z.object({
  type: z.literal('widget'),
  name: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+$/),
  parameters: z.record(z.string(), z.unknown()),
})

export const formative = z.object({
  type: z.literal('formative'),
  prompt: inlineArray,
  kind: z.enum(['free_response', 'multiple_choice']),
  options: z.array(noHtml).optional(),
})

export const block = z.discriminatedUnion('type', [
  heading,
  paragraph,
  list,
  callout,
  definition,
  workedExample,
  equation,
  figure,
  widget,
  formative,
])

export const lessonSchema = z.object({
  id: z.string().regex(/^L-\d{3}$/),
  title: noHtml,
  atom_ids: z.array(z.string()).default([]),
  blocks: z.array(block),
})

// --- Container shapes -------------------------------------------------------

export const manifestSchema = z.object({
  course_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  version: z.number().int().nonnegative(),
  content_hash: z.string(),
  title: noHtml,
  subject: noHtml,
  level: noHtml,
  hours_estimate: z.number().nonnegative(),
  prereq_courses: z.array(noHtml).default([]),
  prereq_atoms: z.array(noHtml).default([]),
  generator: z.object({
    harness_version: z.string(),
    pipeline: z.array(z.unknown()).default([]),
    models: z.record(z.string(), z.string()).default({}),
    generated_at: z.string(),
    tokens: z.record(z.string(), z.object({ in: z.number().nonnegative(), out: z.number().nonnegative() })).default({}),
    cost_estimate: z.number().nonnegative().default(0),
  }),
  scope: z.enum(['full', 'final_only']),
  grounding: z.enum(['parametric', 'open_corpus', 'user_supplied', 'mixed']),
  derived_from_user_material: z.boolean(),
  integrity: z.record(z.string(), z.string()),
})

export const atomSchema = z.object({
  id: noHtml,
  objective: noHtml,
  bloom: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
  prereq_atoms: z.array(noHtml).default([]),
})

export const spineSchema = z.object({
  subject: noHtml,
  review_cap_minutes: z.number().nonnegative().optional(),
  modules: z.array(
    z.object({
      id: noHtml,
      title: noHtml,
      lessons: z.array(
        z.object({
          id: z.string().regex(/^L-\d{3}$/),
          title: noHtml,
          atoms: z.array(noHtml),
        }),
      ),
    }),
  ),
  atoms: z.array(atomSchema),
})

export const itemsSchema = z.object({
  items: z.array(z.unknown()),
})

// --- Derived types ----------------------------------------------------------

export type Inline = z.infer<typeof inline>
export type Block = z.infer<typeof block>
export type Lesson = z.infer<typeof lessonSchema>
export type Manifest = z.infer<typeof manifestSchema>
export type Spine = z.infer<typeof spineSchema>
export type Atom = z.infer<typeof atomSchema>
export type WidgetInstance = z.infer<typeof widget>
export type Figure = z.infer<typeof figure>
export type Formative = z.infer<typeof formative>
export type Equation = z.infer<typeof equation>
export type WorkedExample = z.infer<typeof workedExample>
export type Callout = z.infer<typeof callout>
export type Definition = z.infer<typeof definition>
export type List = z.infer<typeof list>
export type Paragraph = z.infer<typeof paragraph>
export type Heading = z.infer<typeof heading>

export function parseBlock(value: unknown): Block {
  return block.parse(value)
}

export function parseLesson(value: unknown): Lesson {
  return lessonSchema.parse(value)
}

export function parseManifest(value: unknown): Manifest {
  return manifestSchema.parse(value)
}

export function parseSpine(value: unknown): Spine {
  return spineSchema.parse(value)
}