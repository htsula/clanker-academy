# Step 12 — The hand-authored course

**Goal.** A real course, not a demo. This is the thing M0 exists to produce.

## Why it matters

It is the only test of whether the block vocabulary is right, and the only way to answer the
question the whole build order is arranged around: **will anyone actually study this?** A
three-lesson stub cannot answer that.

## Plan

1. Extend the step 6 lessons into a **complete short course** — one coherent subject, enough
   lessons to have a shape, real figures, real `plot` instances, real worked examples. Aim
   for something a person could sit down and read for an hour or two.
2. Write the manifest honestly: `hours_estimate`, `grounding`, and `scope: full`.
3. Write a small **build script** that packs the source folder into a `.clank`: hash every
   file, walk the lesson trees to collect `widgets_used[]`, write the manifest, zip it. This
   is the throwaway harness §10 anticipates — it is not the generator.
4. Read the whole course end to end, on screen, as a reader would.
5. Fix what that reading exposes. **Expect schema changes**; this is the last cheap moment.
6. Commit.

## Expected at the end

- One `.clank` that opens and reads as a course.
- A build script that reproduces it from source.
- A list of what reading it made you want to change — acted on, or written down for M1
  before the format freezes.
