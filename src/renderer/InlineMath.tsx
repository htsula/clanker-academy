import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MATH_DEPTH_MAX, MATH_SOURCE_MAX, mathDepth } from '../course/schema'

// KaTeX renders into a live DOM node (katex.render), never through an HTML
// string in this codebase — dangerouslySetInnerHTML is banned. trust:false
// keeps KaTeX from emitting raw HTML commands, strict:true turns silent
// tolerance into errors, and length/nesting caps are checked here, before the
// renderer is ever called (§11.1a: a course file is untrusted input).

function guardError(source: string): string | null {
  if (source.length > MATH_SOURCE_MAX) return 'equation exceeds the length cap'
  if (mathDepth(source) > MATH_DEPTH_MAX) return 'equation exceeds the nesting cap'
  return null
}

function Katex({ source, displayMode }: { source: string; displayMode: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [error, setError] = useState<string | null>(() => guardError(source))

  useEffect(() => {
    const guarded = guardError(source)
    if (guarded) {
      setError(guarded)
      return
    }
    if (!ref.current) return
    try {
      katex.render(source, ref.current, {
        displayMode,
        throwOnError: true,
        strict: true,
        trust: false,
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not render equation')
    }
  }, [source, displayMode])

  if (error) {
    return (
      <span className="math-error" role="status">
        {error}
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