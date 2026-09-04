import type { Formative } from '../course/schema'
import { InlineContent } from './Inline'

export function FormativeBlock({ block }: { block: Formative }) {
  return (
    <div className="formative">
      <div className="formative-label">Check yourself</div>
      <p className="formative-prompt">
        <InlineContent content={block.prompt} />
      </p>
      {block.kind === 'multiple_choice' && block.options ? (
        <ul className="formative-options">
          {block.options.map((option, i) => (
            <li key={i}>
              <button type="button" disabled>
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <textarea
          className="formative-input"
          rows={3}
          placeholder="Your answer — ungraded, for you"
          aria-label="Your answer"
        />
      )}
    </div>
  )
}