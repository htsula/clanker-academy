import { useState } from 'react'
import { fixtureFigures } from './course/fixture-figures'
import { fixtureLessons, lessonOrder } from './course/fixture-lessons'
import { LessonPage } from './renderer/LessonPage'

function App() {
  const [lessonId, setLessonId] = useState<string>(lessonOrder()[0])
  const lesson = fixtureLessons.find((l) => l.id === lessonId)

  return (
    <main className="app">
      <nav className="lesson-nav" aria-label="Lessons">
        <span className="lesson-nav-title">Introduction to Limits</span>
        <ol className="lesson-nav-list">
          {lessonOrder().map((id, i) => {
            const l = fixtureLessons.find((x) => x.id === id)
            return (
              <li key={id}>
                <button
                  type="button"
                  className={id === lessonId ? 'lesson-nav-item active' : 'lesson-nav-item'}
                  onClick={() => setLessonId(id)}
                >
                  {i + 1}. {l?.title}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      {lesson ? <LessonPage key={lesson.id} lesson={lesson} figures={fixtureFigures} /> : null}
    </main>
  )
}

export default App