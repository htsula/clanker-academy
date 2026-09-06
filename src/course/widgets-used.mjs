// The single implementation of the widget-tree walk, shared by the TypeScript
// registry (widget-registry.ts re-exports this) and the packer
// (scripts/build-clank.mjs imports it directly). Manifest.widgets_used[] is
// built from this at package time — collected, never generated: deterministic,
// zero-cost bookkeeping (§11.6a). The packer and the runtime must never drift.

/**
 * @param {ReadonlyArray<{ type?: unknown; name?: unknown; version?: unknown }>} blocks
 * @returns {{ name: string; version: string }[]}
 */
export function collectWidgets(blocks) {
  const seen = new Map()
  for (const block of blocks) {
    if (block.type === 'widget') {
      const key = `${block.name}@${block.version}`
      if (!seen.has(key)) seen.set(key, { name: block.name, version: block.version })
    }
  }
  return [...seen.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  )
}