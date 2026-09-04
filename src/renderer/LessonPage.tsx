import type { LoadedLesson } from '../course/load'
import { BlockRenderer } from './BlockRenderer'
import './lesson.css'

export function LessonPage({ lesson }: { lesson: LoadedLesson }) {
  return (
    <article className="lesson">
      <h1 className="lesson-title">{lesson.title}</h1>
      <div className="lesson-blocks">
        {lesson.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </article>
  )
}