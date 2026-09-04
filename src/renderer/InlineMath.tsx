import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MATH_DEPTH_MAX, MATH_SOURCE_MAX, mathDepth } from '../course/schema'

// KaTeX renders into a live DOM node (katex.render), never through an HTML
// string in this codebase — dangerouslySetInnerHTML is banned. trust:false
// keeps KaTeX from emitting raw HTML commands, strict:true turns silent
// tolerance into errors, and length/nesting caps are checked before the
// renderer is ever called (§11.1a: a course file is untrusted input).

function guardError(source: string): string | null {
  if (source.length > MATH_SOURCE_MAX) return 'equation exceeds the length cap'
  if (mathDepth(source) > MATH_DEPTH_MAX) return 'equation exceeds the nesting cap'
  return null
}

function Katex({ source, displayMode }: { source: string; displayMode: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const guarded = guardError(source)

  useEffect(() => {
    const el = ref.current
    if (!el || guarded) return
    try {
      katex.render(source, el, {
        displayMode,
        throwOnError: true,
        strict: true,
        trust: false,
      })
    } catch (err) {
      el.replaceChildren()
      const badge = document.createElement('span')
      badge.className = 'math-error'
      badge.setAttribute('role', 'status')
      badge.textContent = err instanceof Error ? err.message : 'could not render equation'
      el.appendChild(badge)
    }
  }, [source, displayMode, guarded])

  if (guarded) {
    return (
      <span className="math-error" role="status">
        {guarded}
      </span>
    )
  }

  return <span ref={ref} className={displayMode ? 'display-math' : 'inline-math'} />
}

export function InlineMath({ source }: { source: string }) {
  return <Katex source={source} displayMode={false} />
}

export function DisplayMath({ source }: { source: string }) {
  return <Katex source={source} displayMode={true} />
}