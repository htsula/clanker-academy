import type { LoadedLesson } from '../course/load'
import { BlockRenderer, type FigureMap } from './BlockRenderer'
import './lesson.css'

export function LessonPage({ lesson, figures }: { lesson: LoadedLesson; figures: FigureMap }) {
  return (
    <article className="lesson">
      <h1 className="lesson-title">{lesson.title}</h1>
      <div className="lesson-blocks">
        {lesson.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} figures={figures} />
        ))}
      </div>
    </article>
  )
}