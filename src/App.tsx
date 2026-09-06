import { useEffect, useState } from 'react'
import { openClank, type Course } from './course/clank'
import { loadCourseBytes } from './course/load-course'
import { LessonPage } from './renderer/LessonPage'

function CourseView({ course }: { course: Course }) {
  const allLessons = course.spine.modules.flatMap((m) => m.lessons)
  const [lessonId, setLessonId] = useState<string>(allLessons[0].id)
  const lesson = course.lessons.find((l) => l.id === lessonId)

  return (
    <main className="app">
      <nav className="lesson-nav" aria-label="Lessons">
        <span className="lesson-nav-title">{course.manifest.title}</span>
        {course.spine.modules.map((module, mi) => (
          <div key={module.id} className="lesson-nav-module">
            <span className="lesson-nav-module-title">
              {mi + 1}. {module.title}
            </span>
            <ol className="lesson-nav-list">
              {module.lessons.map((l, i) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={l.id === lessonId ? 'lesson-nav-item active' : 'lesson-nav-item'}
                    onClick={() => setLessonId(l.id)}
                  >
                    {i + 1}. {l.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
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
    loadCourseBytes()
      .then((bytes) => openClank(bytes))
      .then((result) => {
        if (!alive) return
        if (result.ok) setCourse(result.course)
        else setError(result.reason)
      })
      .catch(() => {
        if (alive) setError('failed to open course')
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