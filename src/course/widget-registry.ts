import type { ComponentType } from 'react'
import { z } from 'zod'
import type { Block } from './schema'

// The widget registry is declared in code, never in a course file (§8.2). A
// course file may only instantiate a widget; it may never author one.
//
// Identity is name@major.minor (§11.6a). A widget renders iff the renderer has
// the same major and a minor ≥ the instance's minor. A different major never
// renders. Within a major, parameters are add-only across releases.

export interface WidgetVersion {
  major: number
  minor: number
}

export interface WidgetRegistration {
  name: string
  major: number
  version: WidgetVersion
  schema: z.ZodType<unknown>
  // A component, not a render function: WidgetBlock wraps it in an error
  // boundary, so a throw inside the widget's own render cannot take down the
  // lesson. An eagerly-invoked render() would throw in the parent's render,
  // above the boundary.
  Component: ComponentType<{ params: unknown }>
}

export type WidgetResolve =
  | { status: 'ok'; registration: WidgetRegistration; params: unknown }
  | { status: 'unknown-name' }
  | { status: 'unknown-major' }
  | { status: 'invalid-version' }
  | { status: 'version-unsatisfiable'; shipped: WidgetVersion }
  | { status: 'invalid-parameters' }

const registry = new Map<string, WidgetRegistration>()

export function registerWidget(registration: WidgetRegistration): void {
  registry.set(`${registration.name}@${registration.major}`, registration)
}

export function widgetMajors(name: string): WidgetRegistration[] {
  return [...registry.values()].filter((r) => r.name === name)
}

export function parseWidgetVersion(version: string): WidgetVersion | null {
  const match = /^(\d+)\.(\d+)$/.exec(version)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]) }
}

// §11.6a: renders iff the renderer ships the same major at a minor ≥ requested.
export function isWidgetSatisfiable(requested: string, shipped: WidgetVersion): boolean {
  const r = parseWidgetVersion(requested)
  if (!r) return false
  return r.major === shipped.major && shipped.minor >= r.minor
}

export function resolveWidget(name: string, requested: string, parameters: unknown): WidgetResolve {
  const parsed = parseWidgetVersion(requested)
  const majors = widgetMajors(name)
  if (majors.length === 0) return { status: 'unknown-name' }
  if (!parsed) return { status: 'invalid-version' }

  const registration = majors.find((r) => r.major === parsed.major)
  if (!registration) return { status: 'unknown-major' }
  if (!isWidgetSatisfiable(requested, registration.version)) {
    return { status: 'version-unsatisfiable', shipped: registration.version }
  }

  const check = registration.schema.safeParse(parameters)
  if (!check.success) return { status: 'invalid-parameters' }
  return { status: 'ok', registration, params: check.data }
}

export interface WidgetIdentity {
  name: string
  version: string
}

// Walks a lesson tree and returns the exact widget identities used —
// manifest.widgets_used[] is built from this at package time. Collected, never
// generated: this is deterministic, zero-cost bookkeeping (§11.6a).
export function collectWidgets(blocks: readonly Block[]): WidgetIdentity[] {
  const seen = new Map<string, WidgetIdentity>()
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