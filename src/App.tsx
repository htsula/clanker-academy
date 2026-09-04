import { useEffect, useState } from 'react'
import clankB64 from './fixtures/course.clank.b64?raw'
import { base64ToBytes, openClank, type Course } from './course/clank'
import { LessonPage } from './renderer/LessonPage'

function CourseView({ course }: { course: Course }) {
  const order = course.spine.modules.flatMap((m) => m.lessons.map((l) => l.id))
  const [lessonId, setLessonId] = useState<string>(order[0])
  const lesson = course.lessons.find((l) => l.id === lessonId)

  return (
    <main className="app">
      <nav className="lesson-nav" aria-label="Lessons">
        <span className="lesson-nav-title">{course.manifest.title}</span>
        <ol className="lesson-nav-list">
          {order.map((id, i) => {
            const l = course.lessons.find((x) => x.id === id)
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
      {lesson ? (
        <LessonPage key={lesson.id} lesson={lesson} figures={course.figures} />
      ) : null}
    </main>
  )
}

function App() {
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    openClank(base64ToBytes(clankB64)).then((result) => {
      if (!alive) return
      if (result.ok) setCourse(result.course)
      else setError(result.reason)
    })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <main className="app-error">
        <h1>Could not open course</h1>
        <p role="status">{error}</p>
      </main>
    )
  }

  if (!course) {
    return (
      <main className="app-error">
        <p>Opening course…</p>
      </main>
    )
  }

  return <CourseView course={course} />
}

export default App