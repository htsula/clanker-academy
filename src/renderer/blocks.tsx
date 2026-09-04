import type { Heading, Paragraph, List, Callout, Definition, WorkedExample, Equation, Figure } from '../course/schema'
import { InlineContent } from './Inline'
import { DisplayMath } from './InlineMath'

export function HeadingBlock({ block }: { block: Heading }) {
  const Tag = `h${block.level}` as const
  return (
    <Tag>
      <InlineContent content={block.content} />
    </Tag>
  )
}

export function ParagraphBlock({ block }: { block: Paragraph }) {
  return (
    <p>
      <InlineContent content={block.content} />
    </p>
  )
}

export function ListBlock({ block }: { block: List }) {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <Tag>
      {block.items.map((item, i) => (
        <li key={i}>
          <InlineContent content={item} />
        </li>
      ))}
    </Tag>
  )
}

export function CalloutBlock({ block }: { block: Callout }) {
  return (
    <aside className={`callout callout-${block.kind}`}>
      <span className="callout-kind">{block.kind}</span>
      <div>
        <InlineContent content={block.content} />
      </div>
    </aside>
  )
}

export function DefinitionBlock({ block }: { block: Definition }) {
  return (
    <div className="definition">
      <dt className="definition-term">{block.term}</dt>
      <dd className="definition-body">
        <InlineContent content={block.content} />
      </dd>
    </div>
  )
}

export function WorkedExampleBlock({ block }: { block: WorkedExample }) {
  return (
    <div className="worked-example">
      {block.title ? <h4 className="worked-example-title">{block.title}</h4> : null}
      <div className="worked-example-problem">
        <span className="worked-example-label">Problem</span>
        <InlineContent content={block.problem} />
      </div>
      <ol className="worked-example-solution">
        {block.solution.map((step, i) => (
          <li key={i}>
            <InlineContent content={step} />
          </li>
        ))}
      </ol>
    </div>
  )
}

export function EquationBlock({ block }: { block: Equation }) {
  return (
    <div className="equation" data-display={block.display}>
      {block.number ? <span className="equation-number">{block.number}</span> : null}
      {block.display ? <DisplayMath source={block.source} /> : <InlineMath source={block.source} />}
    </div>
  )
}

import { InlineMath } from './InlineMath'

export function FigureBlock({ block }: { block: Figure }) {
  return (
    <figure className="figure">
      <div className="figure-frame">
        <span className="figure-placeholder">figure: {block.src}</span>
      </div>
      {block.caption ? (
        <figcaption>
          <InlineContent content={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  )
}