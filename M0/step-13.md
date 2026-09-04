# Step 13 — Verify M0 and close it

**Goal.** Prove the exit criteria on real machines, then stop.

## Plan

1. Build from CI and run the course on **Windows, macOS and Linux**. Read a lesson on each.
2. On Linux, note the webview version you tested against — M1 needs it for the startup check.
3. Build a **deliberately broken variant** of the course and confirm each failure is
   element-scoped and clearly stated:
   - a `plot@1.9` instance and a `plot@2.0` instance → error cards, course still readable
   - an unknown block type → placeholder
   - a malformed equation → inline error
   - a flipped byte → refused on the hash check
4. Confirm `dangerouslySetInnerHTML` still fails the build, and that the config assertion
   test still pins the capability list.
5. Write down what step 12's read-through exposed, as M1's input.
6. Tag the commit.

## M0 is done when

The hand-authored course reads end to end on all three platforms; every failure above is
visible, local and survivable; and the two guard rails from steps 4 and 5 are still enforced.

## Then stop

The format freezes at **M1**, not here. Resist adding widgets, an import UI or a settings
screen — each is a later milestone, and each is cheaper after a real course has been read
than before.
