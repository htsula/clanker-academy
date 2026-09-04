# Clanker Academy — Build Plan

Derived from `Planning/02-build-spec-v2.md` (v2, 14 sections). The spec says *what*;
this says *in what order, with what finished at each stop*. Milestone-level only —
task decomposition happens when a milestone is started, not now.

**Rule that orders everything: build the consumer before the producer (§10).** The
Runtime is the product, the Generator makes courses exist, the Counselor is the front
door. A course file can be hand-authored long before the harness is any good.

---

## Dependency and design decisions — settled

**Settled 2026-09-03.** Kept here as the record of what was chosen and why, since each
one shapes a milestone below. D8 is the one that changed on review — a state library was
proposed and cut.

| # | Item | Decision | Gates |
|---|---|---|---|
| D1 | Graph layout library | **`d3-dag`** v1.2.2. §14.7's `sugiyama()` config is already verified on a four-component graph, including the non-default `topDown(false)`. The "still open" note was stale. | M6 |
| D2 | Widget library v1 — frozen at first release (§11.6) | **`plot@1.0` only.** More are added later. Additions are cheap and removals are a major bump, so the narrowest possible v1 is the right shape. Two consequences: the registry, the `name@major.minor` identity rule and the §11.6a render check all ship at M0 with one entry in them — the mechanism is what M0 proves, not the catalogue — and the hand-authored M0 course must read well using prose, figures and one widget. | M0 |
| D3 | Math rendering | **KaTeX**, `trust: false`, `strict: true`, expression length and nesting caps enforced before the call (§11.1a). Smaller and faster than MathJax; the reduced LaTeX surface is a feature against untrusted input. | M0 |
| D4 | Zip handling in the webview | **`fflate`** — small, no Node deps, streaming, works under Tauri's webview without a Rust command. | M0 |
| D5 | Event log storage (§11.5 fixes append-only) | **One JSONL for every course, read whole at startup** into an in-memory projection, which everything then reads. No SQLite, no reverse reading, no second read path. Measured on a synthetic full degree — 40 courses, ~320 events each — the file is **2.2 MB and reads and projects in ~60 ms**; ten times that is still under a second. Progress is a max over position events, so a reader who revisits section 3 after reaching 10 needs no special handling. What governs the size is **event granularity, not course count**: log discrete events, never continuous ones. Scroll position is not an event; a professor exchange is not an event and neither is a question about one; a test attempt is **one object carrying the whole answer sheet**, not a line per question. The only recovery logic is dropping a trailing line that will not parse, since a crash can tear an append and nothing earlier can be damaged. | M2 |
| D6 | Block-tree schema validation | **Zod**, at the untrusted-input boundary only — block tree, widget parameters, manifest, spine, item banks. Internal shapes stay plain TypeScript; validation that creeps inward costs runtime for something the compiler already proved. | M0 |
| D7 | PDF rasterization and embedded-image extraction (§12.2, §12.5) | **`pdf.js` (`pdfjs-dist`)** in the webview. Covers text-layer extraction, page raster and embedded-object enumeration — all three §12 paths on one dependency. | M7 |
| D8 | State management | **No state library.** React context plus a reducer. The loaded course is read-only after parse, the widget registry is a module constant, and reading position is component-local; the only genuinely shared mutable thing is the event-log projection (D5), which one reducer covers. Revisit only on a profiled symptom — the two places one would appear are M3's professor sidebar streaming tokens alongside a rendered lesson, and M4's live cost meter during a run. Even then the first fix is splitting the context, not adding a dependency. No router library until there is more than one shell route. | — |
| D9 | Testing | **Vitest + React Testing Library only.** No second framework. Playwright was proposed and cut — it cannot drive a Tauri shell at all, which runs the system webview rather than Chromium over CDP; the supported path is WebDriver (`tauri-driver`, Windows and Linux only, or WebdriverIO's embedded-driver service for all three). It is also unnecessary: the risky logic is pure. Property tests on Stage 4's four checks (§4.1) — the only checks that provably work, so the ones worth over-testing — plus the compatibility rule, zip parse and hash refusal, schema rejection of a hostile manifest, the D5 projection, and deterministic grading. **Security posture is tested as config assertions**: read `tauri.conf.json` and assert the declared commands and allowlisted capabilities are exactly the expected set, which catches a quietly widened allowlist in milliseconds and needs no driver. Launching on three webviews is M1's manual smoke per release. Revisit only if smoke starts missing things — and then it is WebdriverIO, not Playwright. | M0 |

Two more that are decisions rather than dependencies: **the `.clank` format is frozen
at M1**, not M0 (M0 is where it is still cheap to be wrong); and **the widget registry
version file ships from M0**, because §11.6a's compatibility rule needs somewhere to
have always lived.

---

## M0 — Course file format + renderer

**Goal.** A hand-authored `.clank` opens and reads like a course.

**Deliverables**
- Tauri + React + Vite shell, all three platforms building in CI from day one.
- Tauri config hardened at creation: minimum allowlisted capabilities, minimum declared
  commands, strict CSP — no remote script, no remote connect (§11.1a).
- `.clank` reader: zip open, manifest/spine/lesson parse, per-file hash verify.
- Block-tree renderer as a component switch. Unknown block type → labelled placeholder.
- Widget library v1 — **`plot@1.0` alone** (D2) — with the `name@major.minor` registry and
  the §11.6a render-iff-same-major-and-minor-≥ rule. The registry mechanism is the
  deliverable; the catalogue grows later.
- Inline error card for an unsatisfiable widget, element-scoped, non-propagating.
- Math renderer (D3) in strict mode with caps.
- Figure rendering, raster only.
- **Lint rule banning `dangerouslySetInnerHTML`, in CI, from the first commit.**
- One hand-authored course — a real one, several lessons, figures, and `plot` instances.

**Exit criteria.** The hand-authored course reads end to end on Windows, macOS and Linux.
A course referencing `plot@1.9` or `plot@2.0` renders the error card in that element and
stays fully readable everywhere else. A grep for `dangerouslySetInnerHTML` fails the build.

**Risks.** A widget shipped is a widget supported forever (§11.6), which is the argument
for `plot` alone at M0 — but it moves the weight onto the **block vocabulary**, which now
carries everything a widget would otherwise have done. The hand-authored course is the only
thing that tells you whether that vocabulary is right, so write it before locking the schema.

---

## M1 — Import/export + provenance + trust boundary

**Goal.** You can hand someone a course and they can open it. Linux ships here.

**Deliverables**
- Courses folder, watched; files dropped in appear in the catalog (§7).
- Export as file copy. Progress never travels.
- Provenance screen before a single lesson renders: who generated it, which models,
  which pipeline, grounding, cost, `derived_from_user_material` (§8.4).
- Full hash verification; refuse on mismatch.
- Figure hardening on import: decode, re-encode, cap dimensions and bytes, reject
  non-images. **Raster only, SVG rejected outright** (§8.3).
- Widget parameter validation against schema; refuse anything unrecognized (§8.2).
- Compatibility modal on first open — counts only, no widget names, no reason
  breakdown; Cancel / Update / Proceed anyway, choice recorded per course (§11.6a).
- Linux: startup webview-version check that states and does not block; one-click
  diagnostics dump (webview version, distro, GPU, driver, env vars, app version);
  documented `WEBKIT_DISABLE_*` launch flags and the FAQ entry that separates app bugs
  from webkit2gtk bugs publicly (§11.1a).
- GitHub release workflow, unsigned, with the Gatekeeper/SmartScreen override documented.

**Exit criteria.** A `.clank` built on one machine opens on the other two. A deliberately
corrupted file is refused with a clear reason. A course made on a newer build shows the
modal with correct counts and stays readable through Proceed anyway.

**Risks.** This is the milestone where the format stops being changeable — everything
after it must read files written here. Freeze it deliberately, at the end, not by drift.

---

## M2 — Progress store + assessment + checkpoints + test-out

**Goal.** Someone can *take* the course, not just read it.

**Deliverables**
- Append-only event log (D5) — one JSONL across all courses, keyed `(course_id, atom_id)`,
  atom IDs content-derived so a version bump preserves evidence for unchanged atoms
  (§2, §4.2). Read whole at startup into the projection; a torn trailing line is dropped.
- **A test attempt is one appended object** — form ID, and an answer sheet of
  `(item, atom, given, correct)` for every question. One write at submission, which is
  also what makes the results page (§5.3a) and revisiting a past attempt a read of a
  single record rather than a reassembly.
- Item types, machine-checkable set first: numeric with tolerance, exact symbolic,
  multi-select, ordering, matching, code-against-tests (§5.3).
- **Offline deterministic final grading.** No model call on the scoring path; the
  scoring path never learns widgets exist.
- Checkpoints at module boundaries, failure routing to remediation on the failed atoms.
- `passed` as the single binary state, flipping only on the final (§5.4).
- Linear in-course progress bar with bumps at the tests.
- Results page (§5.3a): card grid, right/wrong/skipped separated by shape or mark and
  not by colour alone; detail view with item, reader's answer, correct answer;
  "what did I struggle most with" as a group-and-count, unit rollup for finals and
  per-atom for unit tests. Past attempts revisitable from the log.
- Test-out: sit any final any time; pass marks the course passed, atoms held, and
  delivers the review payload anyway (§5.3).
- Single-use forms — a seen form is spent.
- Import of v2 of a course you hold progress in, preserving unchanged atoms.

**Exit criteria.** A final grades identically on two machines with no key and no network.
A failed checkpoint routes to the right atoms. Reimporting a bumped course keeps evidence
for atoms whose hash did not change. **A free-response item in a final bank fails a test** —
it is a spec violation, so make it a machine-enforced one.

**Deliberately absent.** The Explanation button lands in M3, since it is a seeded prompt
into a sidebar that does not exist yet. Retake form regeneration lands in M4, since it
needs the generator; until then a burned form is simply spent.

---

## M3 — Office hours + highlight-to-ask

**Goal.** The feature a real lecture hall cannot offer. M0–M3 is a complete product for
courses that already exist.

**Deliverables**
- Provider router, first cut: dialect as the unit, not the provider — base URL, auth
  scheme, dialect, capability descriptor (§11.7a). Zen's several shapes are the test.
- Persistent professor sidebar, scoped to the current lesson, the atom graph, and which
  courses the reader has actually passed.
- Select text → right-click → ask, pasted into the sidebar.
- Socratic first, direct when stuck; on the third confusion about the same atom, change
  modality rather than wording.
- **No vision:** asked about a figure, the professor says plainly that it cannot see it,
  then works from caption, surrounding prose and the atom. It never infers a description
  and presents it as sight.
- No refusal behaviour (§5.2).
- **Professor conversations are session files, one per conversation, in the user data
  folder** — the way any chat harness stores them. Not events in the progress log, and
  **not in the courses folder, which holds `.clank` files and nothing else**: that folder
  is the thing users share, so nothing private is ever written beside a course.
- **Nothing about questions is logged. This supersedes §5.2's "log it to the progress
  store."** That line existed for analytics that have nowhere to go — there is no
  telemetry, and courses are generated by whoever runs the app, so a weak-atom signal
  reaches no one who could act on it. Consequence, and it is the right one: **"on the
  third confusion about the same atom, change modality" now scopes to the conversation**,
  which the transcript already carries. Three confusions in one sitting is the case that
  rule was written for; three across three weeks is not the same thing and should not be
  treated as if it were.
- Explanation button on the results detail view — the item, the correct answer and the
  atom, **never the reader's wrong answer** (§5.3a).
- Professor-slot grading for in-course subjective checkpoints.

**Exit criteria.** An explanation request and a follow-up "I still don't follow" run down
one code path. A figure question produces an admission, not a description. The router
reaches at least two dialects.

---

## M4 — Generator: charter → spine → blind 2a/2b → Stage 4 → package

**Goal.** The app makes its own courses, in one subject.

**§4.3 must be finished before this ships, not after — this is where a bug bills someone's
card with no refund path.**

**Deliverables**
- Cost controls first: pre-flight estimate with range and tier; a per-job ceiling the
  orchestrator stops *at* rather than after; a live running total in currency; per-stage
  checkpointing so an hour-three failure resumes at hour three; the `PARTIAL` state —
  openable, inspectable, resumable, never silently discarded.
- Stage 0 charter, Stage 1 spine with Bloom tags and prereq atom refs.
- **Stages 2a and 2b blind to each other, both reading only the spine.**
- Stage 4 deterministic checks — coverage, orphan, forward-reference, cycle detection.
  Always on, zero cost, and the only checks that provably work.
- Stage 6 review payload emission, ~20–40 items over terminal atoms.
- Stage 7 package: hashes, manifest, `widgets_used[]` walked from the trees at package
  time (collected, not generated).
- Structured-output fallback ladder — native schema → JSON mode → prompt-and-parse with
  a repair retry — with the tier used recorded in the manifest (§11.7a).
- Usage reporting where the provider gives it; a **labelled estimate** where it does not.
- Final-only builds: Stages 0, 1, 2b, 4, 6, 7, skipping 2a; `manifest.scope`; and the
  failed-test-out path that generates the rest on the existing spine as a version bump on
  the same `course_id`, preserving blind generation across two stages (§4.4).
- Retake form regeneration, closing M2's gap.
- Model slots (§13) with one default and five collapsed overrides; the models.dev catalog
  via `@opencode-ai/models` with the dynamic-import snapshot fallback, `models.dev` added
  to `connect-src` or routed through the HTTP plugin; the pinned pre-1.0 version.

**Exit criteria.** A generated course opens in the M0 renderer with no special handling.
A job killed mid-run resumes without repaid tokens. A run that would exceed the cap stops
before crossing it. A course that fails Stage 4 is inspectable and marked `PARTIAL`.

**Risks.** The largest milestone by far, and the first one where the loop is slow and
expensive to test. Budget for the harness runs themselves.

---

## M5 — Configurable pipeline + critics + manifest cost recording

**Goal.** The reader panel can A/B the harness. Stage 3's value is unmeasured by design —
this is the milestone that measures it.

**Deliverables**
- Stages declared and individually toggled, each with its own model tier, the whole
  configuration written into the manifest.
- Stage 3 critics: factual, pedagogical, difficulty, item analysis, adversarial-student.
- Stage 5 simulated cohort, configurable, off by default (very large).
- Actual per-stage token counts and cost estimate in the manifest — the only real cost
  data that will ever exist, and what closes the review's ±2.5× uncertainty.
- Final-checker slot with the **different-family warning** — warn, never block (§13.3).
- Same charter under two pipelines, both handed to a reader, as a supported workflow.

**Exit criteria.** Two courses from one charter under different pipelines, each carrying
a manifest that says exactly what produced it.

---

## M6 — Counselor + programs + prereq graph + review chaining

**Goal.** Multi-course study plans, and the dashboard becomes the app's home.

**Deliverables**
- Counselor conversation on the **professor slot** (cheap, fast); the structured handoff
  brief — goals, prior knowledge, hours per week, timeline, interest, constraints —
  shown for confirmation and editable; plan construction on the **planning slot**
  (strong, slow) from that brief. Progress indicator and cancel, not a spend warning:
  the wait is latency, not cost (§13.2a).
- The plan as a DAG of course *slots*, and the **only binding graph**. The counselor is
  its sole writer; manifest prerequisites stay descriptive (§2).
- Dashboard tech tree (§14): SVG, `d3-dag` Sugiyama with `topDown(false)`,
  `decrossTwoLayer()`, `coordSimplex()`; depth computed as longest path from any root;
  disconnected components packed by the library; fit-to-view with pan and zoom.
- Node states: passed (green check), locked (grey lock), everything else a transparent
  fill rising in proportion to progress. **No start-course button.**
- Plus icon on an available empty slot → generate / generate final only / import.
- Click a locked slot → name the specific unpassed prerequisites.
- Slotting an imported `.clank`: the counselor reads the manifest, picks or creates a
  slot, attaches prerequisites and dependents (§14.5).
- Replanning at any time, from the edited brief.
- **Generate only what is available** (§14.4).
- Review chaining: a course consumes the payloads of its immediate prerequisites *as the
  plan defines them*, one hop, interleaved through the first modules, never blocking,
  capped at ~10% of hours and stated in the spine; a missing prerequisite skips the
  payload and says so (§6).

**Exit criteria.** A forty-node plan lays out with every root on row 0 and components
side by side. A `.clank` from a stranger enters the graph only through the counselor.
Review load for a course with three prerequisites respects the cap.

---

## M7 — Textbook ingestion

**Goal.** Upper-division courses, where model knowledge thins.

**Deliverables**
- Ingestion as a separate model slot, requested lazily — only when a PDF is first
  supplied, and only if the inherited default cannot read pages (§13.4).
- The **probe**, not a threshold: one dense page with a known word in a corner, sent once
  per model on selection, cached, cost disclosed (§13.5).
- The ladder: native PDF with page-range chunking under per-request limits → local
  rasterization and image send → text-layer extraction, degraded.
- Scanned-PDF detection: no text layer by character count; **bad text layer** by
  implausible character distributions, unmapped glyphs, near-zero digits or operators on
  a page the vision pass calls equation-dense, or a sample cross-checked against the
  vision pass. **No usable text layer means a vision model is required, and the app says
  so and stops.** No OCR library ships (§12.4).
- The ingestion artifact as **structure, not transcription** — section boundaries and
  coverage, atom mapping, the book's notation and definitions, worked-example setups
  restated; short verbatim fragments only where precision demands it. Every generation
  stage reads the artifact; **no stage ever reads the PDF** (§12.3).
- Figure clipping: embedded rasters enumerated and pulled at original resolution; vector
  figures cropped from the page raster to a generously padded model bounding box.
  Resolution capped at generation time, not only on import (§12.5).
- `derived_from_user_material` set and surfaced on import.

**Exit criteria.** A 400-page textbook ingests within the expected token order. A scanned
book with a mangled OCR layer is caught and refused rather than built on. Generation cost
per lesson does not rise with book length — proof that no stage is re-reading the PDF.

**Risks.** Gemini's `RECITATION` filter truncates mid-response after the tokens are paid,
and cannot be disabled — one more reason the ingestion slot is swappable, and a reason to
test the structure-not-prose constraint against that provider specifically.

---

## Cross-cutting, every milestone

- **Untrusted by default.** A course file is a document from a stranger, including your
  own files. No raw HTML, no script, no iframe, no network fetch at render.
- **Fail loudly, never approximate.** No generated fallbacks, no silent degradation. A
  reader must always be able to tell that they are being shown less than the whole thing.
- **No developer information in user-facing UI.** Same remedy means one case to the
  reader; identities, versions and reasons go to the log.
- **Record everything, display little.** Not showing something is reversible; not
  recording it is permanent.
- **Don't build what nobody will exercise.** Before any path is added, name who walks it.
- **The courses folder holds `.clank` files and nothing else.** It is the folder users
  share from; progress, professor transcripts, caches and config live in the user data
  folder. Nothing private is ever written where a course file sits.

## Known omissions, carried deliberately (§9)

No server, accounts, sync, telemetry, payments, entity, credential, transcript,
proctoring or subject exclusion list. **No accessibility work** — the cheapest of these to
do now and among the most expensive to retrofit. **No third-party attribution artifact** —
MIT and Apache-2.0 both require the notice to travel, so this is a known obligation not
discharged; a generated file is the whole remedy whenever it is wanted.

One legal item with a date on it: the name is safe for an unincorporated project, and
becomes a problem at entity formation. **Register the company under a name that is not the
product name** (§11.10a).
