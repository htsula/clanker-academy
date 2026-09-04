# Step 9 — Figures

**Goal.** Raster images render from the course file's own bytes, and nothing else does.

## Plan

1. Render a figure block: image, caption, and its reference to the atom it serves.
2. **Raster only. SVG is rejected, not sanitized** (§8.3).
3. Nothing loads from the network at render time — step 4's CSP should already make that
   impossible. Confirm that it does.
4. Decode from bytes held in memory, since in step 11 these come out of the zip.
5. Commit.

## Expected at the end

- Figures appear with captions in your fixture lessons.
- A fixture referencing an SVG is refused with a clear reason.
- A fixture referencing a remote URL does not load it — and the CSP is what stops it.
- A file that does not decode as an image produces an inline error, not a crash.
