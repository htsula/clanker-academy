import lesson1 from '../fixtures/lessons/L-001.json'
import lesson2 from '../fixtures/lessons/L-002.json'
import lesson3 from '../fixtures/lessons/L-003.json'
import spine from '../fixtures/spine.json'
import type { LoadedLesson } from './load'
import { loadLesson } from './load'
import type { Spine } from './schema'
import { parseSpine } from './schema'

const rawLessons: unknown[] = [lesson1, lesson2, lesson3]
const parsedSpine = parseSpine(spine)

export const fixtureSpine: Spine = parsedSpine
export const fixtureLessons: LoadedLesson[] = rawLessons.map(loadLesson)

const byId = new Map(fixtureLessons.map((l) => [l.id, l]))

export function lessonOrder(): string[] {
  return parsedSpine.modules.flatMap((m) => m.lessons.map((l) => l.id))
}

export function lessonById(id: string): LoadedLesson | undefined {
  return byId.get(id)
}