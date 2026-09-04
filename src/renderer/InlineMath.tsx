// Step 7 placeholder. Step 8 replaces this with KaTeX in strict mode.
export function InlineMath({ source }: { source: string }) {
  return <span className="inline-math">{source}</span>
}

export function DisplayMath({ source }: { source: string }) {
  return <div className="display-math">{source}</div>
}