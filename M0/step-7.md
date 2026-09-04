# Step 7 — The block renderer

**Goal.** The fixtures from step 6 render on screen as a readable lesson.

## Plan

1. Build the renderer as a **component switch over block type**. One component per block, no
   shared "render anything" path.
2. An **unknown block type renders a labelled placeholder** — never the raw content, never a
   thrown error. This is the same failure shape the widget error card uses in step 10.
3. Lay out a lesson page: reading column, sensible measure, headings, scroll.
4. Load the fixture from disk in dev. No zip yet.
5. Commit.

## Expected at the end

- Your hand-written lessons read like lessons.
- A fixture containing `{"type":"not-a-real-block"}` renders a placeholder, and the rest of
  the lesson is unaffected.
- Tests asserting each block type renders, and that an unknown type produces the placeholder.

## Watch for

If a block feels awkward to render, that is step 6's schema telling you something. Go back
and change it — it is still free.
