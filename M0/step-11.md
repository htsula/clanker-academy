# Step 11 — The `.clank` container

**Goal.** The app opens a real file instead of a fixture.

## Plan

1. Add **`fflate`** (D4). Zip work happens in the webview; no Rust command for this.
2. Read the container layout from §3.1: `manifest.json`, `spine.json`, `lessons/`,
   `figures/`, and the item banks (present but unused until M2).
3. **Verify integrity before rendering anything** — the per-file hashes and `content_hash`
   from the manifest. A mismatch refuses the file with a clear reason and renders nothing.
4. Validate every parsed file against the step 6 schemas. A course file is a document from a
   stranger, **including your own files**.
5. Convert the step 6 fixtures into a real `.clank` and open that instead.
6. Commit.

## Expected at the end

- The app opens a `.clank` from disk and renders it using everything from steps 7 to 10.
- A file with one byte flipped is refused on the hash check.
- A file whose manifest omits a required field is refused by the schema.
- A zip missing `lessons/` is refused rather than rendering an empty course.

## Not in this step

No import UI, no courses folder, no provenance screen — those are M1. Opening a file by path
in dev is enough.
