# Step 6 — The block vocabulary, defined by writing real lesson content

**Goal.** A schema for the course file, and enough real content to prove it is the right one.

## Why this order

M0's stated risk: with `plot@1.0` as the only widget, the **block vocabulary carries
everything**. It cannot be designed in the abstract. Write real lesson content first and let
it tell you what blocks exist — otherwise you discover in step 12 that the schema cannot
express a worked example.

## Plan

1. **Write two or three lessons of real course content as prose**, in a subject you know
   well. Not placeholder text. Include a worked example, a definition, a figure with a
   caption, an equation, and an inline formative question — the things a real lesson has.
2. Read what you wrote and name the block types it needed. Expect something like: heading,
   paragraph, list, callout, definition, worked example, equation, figure, widget instance,
   formative item.
3. Add **Zod** (D6) and define those blocks as schemas, with TypeScript types derived from
   them.
4. Define the container's JSON shapes the same way: `manifest.json`, `spine.json`,
   `lessons/L-###.json`. Follow §3.2 for the manifest fields.
5. Encode the two hard rules in the schema itself: **no raw HTML anywhere**, and a widget
   instance is **a name, a version and parameters** — never content.
6. Save the lessons you wrote as JSON fixtures in the repo. These drive steps 7 to 10.

## Expected at the end

- A schema that validates your fixtures and rejects a fixture with an unknown block type, an
  HTML string, or a missing required field.
- Tests for each of those rejections.
- No renderer yet. Nothing is drawn in this step.

## Note

The schema is **not frozen here** — that happens at M1. Later steps will find things it got
wrong, and changing it is free until the format ships.
