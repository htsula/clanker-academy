# Clanker Academy — Build Spec v2

Implements the 55 decisions in `DECISIONS-ANSWERED.md`, plus D-A10 and D-B24 as
resolved 2026-08-31. Supersedes `workings/00-plan-v1.md` entirely.

**Stack is not chosen here.** This document specifies behaviour, data shapes and
boundaries only. Language, framework, storage engine and packaging are listed as open
decisions at the end and are yours to make.

---

## 1. What this is

A free, open-source desktop application that generates and delivers a
university-shaped course of study on the user's own machine, using the user's own
inference provider and the user's own materials.

**No server exists.** No accounts, no sync, no telemetry, no payments, no hosted
catalog, no credential. The app is a binary and a folder of files.

**Three subsystems:**

| | Does what | Runs when |
|---|---|---|
| **Counselor** | Turns intent into a program plan — which courses, in what order | Interactive, minutes |
| **Generator** | Turns a course charter into a course file | Batch, minutes to hours, resumable |
| **Runtime** | Delivers a course file: lessons, assessment, office hours, progress | Interactive, the actual product |

The Runtime is the product. The Generator is what makes courses exist. The Counselor
is the front door. **Build them in that order — see §10.**

---

## 2. The three objects that matter

Everything in this design follows from separating these.

### The course file — immutable, portable, shareable

One file, one course. Self-contained. Never modified after generation. This is what a
user sends to a friend so the friend does not pay the token cost again.

### The progress store — private, local, mutable

Everything about *a person's* passage through courses. Never inside a course file.
This is why a completed course is still pristine and still sendable.

**The rule that makes it work:** progress is keyed to `(course_id, atom_id)`, not to a
file path and not to a course version. Import v2 of a course you have progress in, and
every atom whose ID is unchanged keeps its evidence; changed atoms reset. This requires
atom IDs to be stable across regeneration — see §4.2.

### The plan — the counselor's output, and the only binding graph

A DAG of **course slots**: a name, a description, and prerequisite edges. The plan is what
the dashboard draws (§14) and the only thing that gates anything.

**A slot is not a file.** Most slots are empty most of the time — the plan describes a
programme of study long before any of it exists, and a course is generated only once it
becomes available to take (§14.4). A `.clank` fills a slot; it does not create one.

**Course files carry no binding prerequisites.** A manifest may *describe* what a course
assumes, and that description is how the counselor recognises a file it is handed — but it
never creates an edge. **The counselor is the sole writer of the plan graph.** Hand it a
`.clank` from anywhere and it reads the metadata, decides which slot the file fills, and
attaches prerequisites and dependents. That single-writer rule is what keeps the gating
logic coherent when files arrive from strangers.

---

## 3. The course file format

### 3.1 Container

A zip archive with a fixed internal layout and a reserved extension. Zip rather than a
single JSON because courses carry images (clipped figures, rendered plots) and
base64-in-JSON roughly doubles their size and makes streaming impossible.

```
<name>.<ext>
├─ manifest.json        identity, provenance, cost, integrity
├─ spine.json           the atom graph — objectives, Bloom tags, prereq atom refs
├─ lessons/
│   └─ L-###.json       prose blocks, figure refs, widget instances
├─ items/
│   ├─ practice.json    formative, in-lesson
│   ├─ checkpoint.json  module gates
│   ├─ final.json       held out, never shown during study
│   └─ transfer.json    held out, combines atoms in ways no lesson demonstrates
├─ rubrics/             for constructed responses
├─ review.json          the payload this course EMITS to its dependents (§6)
├─ figures/             raster images only (see §8)
└─ sources.json         what this was grounded on, with provenance flags
```

### 3.2 manifest.json

```
course_id           stable UUID, survives regeneration
version             monotonic integer
content_hash        hash over every other file in the container
title, subject, level
hours_estimate      student-hours, the honest number
prereq_courses[]    DESCRIPTIVE ONLY — what this course assumes, for the counselor to
                    match against when slotting the file. Never a binding edge; the plan
                    owns gating (§2)
prereq_atoms[]      DESCRIPTIVE ONLY — atom IDs this course assumes are held
generator {
  harness_version
  pipeline          which stages ran, in order, with their config
  models{}          model ID used per stage
  generated_at
  tokens{in,out}    ACTUAL counts, per stage
  cost_estimate     what it cost the person who generated it
}
scope               full | final_only (§4.4)
grounding           parametric | open_corpus | user_supplied | mixed
derived_from_user_material   bool
integrity{}         per-file hashes
```

Two fields carry weight beyond bookkeeping.

**`tokens` / `cost_estimate`** is the only real cost data that will ever exist. Every
figure in the review carries ±2.5× uncertainty until a manifest reports actual counts.
It also tells a recipient what they were just saved.

**`derived_from_user_material`** is set when any generation stage read a user-supplied
document. It is displayed on import (§8.4). It is not a restriction — it is how the app
tells a recipient the truth about what they were handed, and how you stay out of the
question of what anyone chose to share.

### 3.3 What a course file may never contain

**Executable code of any kind.** Not scripts, not expressions, not templates that
evaluate. A course file is data that the app renders. This is the hard boundary and §8
is built on it.

---

## 4. The generator

### 4.1 Pipeline

Stages are declared, not hardcoded. Each is individually on/off with its own model tier,
and the configuration is written into the manifest — which is what makes your D-B16
testing workflow possible: generate the same charter under two pipelines, hand both to a
reader, compare.

| # | Stage | Status | Cost |
|---|---|---|---|
| 0 | **Charter** — scope, terminal objectives, out-of-scope, assessment blueprint | required | small |
| 1 | **Spine** — decompose to modules → lessons → atoms, each with a Bloom tag and prereq atom refs | required | small |
| 2a | **Instruction** — lecture prose, worked examples, figure and widget calls | required | large |
| 2b | **Assessment** — items, distractors, rubrics, the four banks | required | large |
| 3 | **Critics** — factual, pedagogical, difficulty, item analysis, adversarial-student | configurable | large |
| 4 | **Deterministic checks** | required | **$0** |
| 5 | **Simulated cohort** | configurable | very large |
| 6 | **Review payload** — emit `review.json` | required | small |
| 7 | **Package** — hash, manifest, write | required | $0 |

**2a and 2b run blind to each other, both reading only the spine.** This is the one idea
from v1 that survived every review pass. A test written from a lecture measures whether
you read the lecture; a test written from the objective measures the objective.

**Stage 4 is not optional and costs nothing.** Pure graph and set operations, no model
calls: every atom has ≥1 lesson and ≥N items (coverage); every item traces to an atom
taught here or in a satisfied prereq (orphan); nothing is used before it is introduced
(forward-reference); the atom graph is acyclic (cycle detection). The review established
that these are the only checks that provably work. Run them always.

Stage 3's value is unmeasured — generator and critic share weights, so their errors
correlate on exactly the confident-plausible-wrong cases you care about. Ship it
configurable and let your reader panel find out whether it earns its cost.

### 4.2 Atom ID stability

Atom IDs must be derived from content, not position — a hash of the normalized objective
statement, not `lesson-3-atom-7`. Otherwise regenerating a course orphans every progress
record that referenced it, and the version-bump rule in §2 silently does nothing.

### 4.3 Failure, cost and the meter

BYOK means your bugs bill the user's card, with no refund path. The runtime must:

- **Estimate before spending.** Show a range and the model tier before generation starts.
- **Enforce a ceiling.** User sets a per-job cap; the orchestrator counts as it goes and
  stops at the cap rather than after it.
- **Show the running total** live, in currency, not tokens.
- **Checkpoint every stage.** A job that dies at hour three resumes at hour three.
- **Define `PARTIAL`.** A course that failed Stage 4 is unreleasable but not deleted — it
  is openable, inspectable, and resumable. Never silently discard paid-for work.

---

### 4.4 Final-only builds

A reader testing out of a course (§5.3, D-A09) needs its final and nothing else. Generating
the lectures would be paying for material they intend never to read.

**The pipeline runs Stages 0, 1, 2b, 4, 6, 7 and skips 2a.** Charter and spine as normal;
the assessment pipeline produces the final bank only; the deterministic checks run against
what exists; the review payload is still emitted, because test-out delivers it (§6) and it
is generated from the spine rather than from prose. Instruction generation — the bulk of a
course — does not run. **Roughly 5–10% of a full course's cost.**

`manifest.scope` records `full` or `final_only`. This is **not** the `PARTIAL` state of §4.3:
partial means a build failed midway and is unreleasable, final-only means a build succeeded
at a smaller job. A recipient of a shared final-only `.clank` must be told what they have
before opening it (§8.4).

**Failing the test-out is the case that has to work.** The reader now holds a course with a
final and no lessons, so the app offers to generate the rest. Two things make that clean:

- **The spine already exists**, so the remaining build is cheaper than a fresh one, and the
  lessons are generated against the same objective list the final was — which *preserves the
  blind-generation property* (§4.1) across a two-stage build rather than breaking it. The
  lectures still never see the items.
- **It is a version bump on the same `course_id`**, and atom IDs are content-derived (§4.2),
  so progress keyed to `(course_id, atom_id)` carries the failed attempt forward intact.

**Forms are single-use and regenerated on demand** (§5.3). A build produces one form. A
failed attempt burns it, and a retake generates a fresh one — which costs one form for the
readers who need it rather than two for everyone. Pre-generating a second form would pay
double up front for a case most readers never reach.

---

## 5. The runtime

### 5.1 Lesson delivery

Prose, worked examples, figures, and widget instances rendered in reading order.
Formative items are inline and ungraded — retrieval, not recognition; free response
preferred over multiple choice. Feedback names the misconception, not just the verdict.

### 5.2 Office hours

Persistent sidebar, and the feature that has no analogue in a real lecture hall:

- **Select any text → right-click → ask.** Highlight a term you forgot or a paragraph you didn't understand and get it explained in place.
- Gets automatically pasted into the sidebar professor chat.
- Scoped to the current lesson, the atom graph, and which courses the user has actually
  completed — so an explanation can lean on what they hold and flags what it cannot.
- Socratic first where the student has something to work with; direct when they are stuck.
- On the third confusion about the same atom, change **modality** — analogy, worked
  example, first-principles derivation — not wording. **Scoped to the conversation**, whose
  transcript already carries the history. Three confusions in one sitting is the case this
  rule is for; three across three weeks is a different thing and is not treated as the same.
- **Questions are not logged.** An earlier draft called every question a signal about a weak
  atom and sent it to the progress store. Cut: there is no telemetry, and courses are
  generated by whoever runs the app, so the signal reaches nobody who could act on it. It
  would be data collected because it was collectable.
- **Conversations are session files, one per conversation, in the user data folder** — the
  ordinary chat-harness shape, individually readable and deletable. Never in the courses
  folder (§7).
- **No vision, for now.** The professor cannot see figures. So when a reader asks about one,
  it must say so plainly rather than inferring a description from context and presenting it
  as sight — a confidently wrong account of a diagram is worse than an admission. It can
  still help: the caption, the surrounding prose and the atom the figure serves are all text
  it already holds, and that answers most questions about a figure without seeing it.
- **No refusal behaviour.** D-P17 is "no integrity claim of any kind," and a refusal that
  paraphrase defeats inconveniences only the honest.

### 5.3 Assessment, gates, and the two kinds of grading

Checkpoints sit at module boundaries; failure routes to remediation on the specific failed
atoms, then a different item set. The final draws from a bank never shown during study and
includes transfer items.

**Grading splits cleanly, and the split is load-bearing:**

| | Graded by | Governs |
|---|---|---|
| **In-course checkpoints** | The same model configured as the professor (§5.2) | Pacing and remediation |
| **The final** | **Nothing — it is objective by construction** | The `passed` flag |

**The final contains no subjective assessment.** Every item on it is machine-checkable, so
scoring is deterministic and requires no model call. Three consequences worth stating,
because each is easy to break later:

1. **The pass flag never depends on a model's judgment at grading time.** It depends on the
   model that *generated* the items, which is recorded — but two readers with the same
   answers always get the same result, on any machine, on any provider.
2. **Stage 2b is constrained.** The final's bank may only draw item types that can be
   scored mechanically — numeric with tolerance, exact symbolic, multi-select, ordering,
   matching, code run against tests. Transfer items must be expressed in those forms too;
   that is a constraint on the item type library, not a reason to drop them. **Adding a
   free-response item to a final is a spec violation**, not a judgment call.
3. **The final grades offline.** This is what makes D-B26 E (offline auto-gradable
   assessment) work at all, and it means a reader with no key and no connection can still
   sit a final and pass a course.

**Forms are single-use.** A course file ships one form, so a reader who receives a shared
`.clank` can sit it without generating anything. Once a form has been seen it is spent, and
any retake generates a fresh one. Nothing is pre-generated against the possibility of
failure: paying for a second form up front costs every reader double for a case most never
reach, while regenerating costs one extra form only for the readers who actually need it.

**There is no attempt cap.** A reader may fail and retake as often as they like — a cap
walls readers who genuinely meet the standard and would eventually clear it, which is a
worse error than letting someone take a fourth attempt.

**Test-out (D-A09):** any course, any time, sit the final. Pass and the course is marked
passed, its atoms are marked held, and **its review payload is delivered anyway** — that
exposure is the only contact the reader will have with the material.

### 5.3a The results page

A finished attempt is not a score, it is a review surface. The same screen serves finals and
in-course unit tests. The professor sidebar (§5.2) stays open throughout.

**Card view.** Every question in the attempt is a tile in a grid. Wrong ones are red.

**Detail view.** Clicking a tile opens the question, the reader's answer, the correct answer,
and an **Explanation** button beneath.

**Explanation is a seeded prompt, not a subsystem.** The button pastes the item into the
professor sidebar with a system instruction to explain the correct answer. There is no
separate explanation generator, no pre-baked explanation text, and no second code path — it
is office hours with a first message written for the reader. So "I still don't follow" is
just the next thing they type, and every capability the professor already has comes with it.

**The reader's wrong answer is not sent.** The payload is the item, the correct answer and
the atom — nothing about what the reader chose.

Asking a model to explain *why someone made an error* is asking it to infer a mental state
from one data point, and it will produce a fluent, specific, confident account of reasoning
the reader may never have done. A wrong story about your own thinking is worse than no story,
because it is authoritative and about you. This is the same failure the professor avoids with
figures (§5.2): do not infer the unobservable and present it as seen.

The reader reads why the correct answer is correct and locates their own error against it —
which is not merely the safe option but the better one, since working out where your own
reasoning broke is a stronger learning mechanism than being told.

**"What did I struggle most with"** sits on the card view and aggregates wrong items by the
atom each traces to, rolled up to the unit. **This is free** — Stage 4's orphan check already
guarantees every item names its atom, so it is a group-and-count over data that must exist.

**Granularity follows the item count, and differs by assessment type.** A final spreads few
items across many atoms, so only the unit-level rollup carries signal — "you missed both
questions on this atom" is noise. A unit test concentrates many items on few atoms, so
**per-atom reporting is meaningful there** and should be used. Same screen, same computation,
different rollup depending on what was sat.

It is a count, not a model call — instant, free and deterministic, with the professor one
click away if the reader wants it discussed.

**Two open details.** Tiles have more than two states — right, wrong, and skipped — and red
alone carries the wrong state, so a mark or a shape on the tile would separate them without
relying on colour. And the results of past attempts are all in the event log, so **revisiting
an earlier failed attempt after studying** is available for free if wanted.

**Revealing correct answers is consistent with single-use forms.** Showing the answers burns
the form, and forms are already spent once seen (§5.3) — the retake generates a fresh one, so
nothing is lost by being fully open about what was missed.

### 5.4 Completion state and the dashboard

**One state, and it is binary: `passed` is true or false.** It flips when and only when the
final is passed. A reader who worked through every lesson but never sat the final has not
passed, and the dashboard says so.

**In-course progress is a linear bar with bumps at the tests.** Shown while studying, not
on the dashboard. Because progress is linear, everything before the reader's furthest point
is filled in by definition — there is no partial-completion bookkeeping to maintain.

**The dashboard is a prerequisite tech tree — see §14.** It shows the binary flag and nothing
else about how the flag was earned.
Specifically, a course that was tested out of and a course that was read through look
identical, permanently. This is deliberate:

- Distinguishing them creates a perverse incentive. A reader who tested out and sees a
  different-looking tile will click through the whole course to make their dashboard
  uniform — spending hours to change a badge, which is the opposite of what the product is
  for.
- The distinction is redundant anyway. Test-out happens in lower-level courses the reader
  wants as a foundation for later ones. Whether someone read Calc I or tested out of it
  stops mattering once three courses that depend on it sit above it, passed.

**Recorded but never displayed.** The event log is append-only and records what happened:
whether the pass came via test-out or completion, which model graded each checkpoint, and
which model generated the course. Not showing something is a rendering choice, reversible
any time; not recording it is permanent. So record all of it and render none of it.

**Version-gap accounting is not a feature anywhere.** The linear bar needs no handling for
items whose widgets will not render — once a point is passed, everything before it is filled
regardless. Those items simply appear with an error card where the figure would be and score
normally (§11.6a). A reader on an old build is an edge case that gets the bare minimum, and
the bare minimum here is no code at all.

**The D-P00 language, resolved.** "Passed" is the word, and it is exactly true: you passed
the assessments this course generated for itself. No disclaimer is needed because no
further claim is made.

---

## 6. Review payloads — D-A10 as resolved

Review is a **build-time artifact**, not a runtime scheduler. No spacing algorithm, no
forgetting curve, no queue.

**Emission.** Every course, at Stage 6, emits `review.json`: a small set of retrieval
items and micro-lessons over its terminal atoms. Roughly 20–40 items per course.

**Consumption.** A course consumes the review payloads of its **immediate prerequisites
only**, as the plan defines them (§2) — not as any manifest claims them. One hop. Econ 101's payload reaches Econ 201 and stops there — a fourth-year
course that requires a course that requires Econ 101 does not re-teach Econ 101. One
reminder pass during the following course, then it is assumed internalized, and anything
that did not stick is what the office-hours sidebar is for.

**Delivery.** Interleaved through the first modules of the dependent course. Never a
blocking gate — a review item you miss is a signal, not a wall.

**Budget.** Total review load per course capped at ~10% of its hours. Where multiple
prereqs would exceed the cap, triage by which atoms the new course's spine actually
declares as prerequisites. State the cap in the spine, so it is visible rather than
emergent.

**Degradation.** An imported course whose prerequisite is not present locally skips the
payload and says so on the course page. It does not block.

**What this buys.** The docket priced a full spaced-review program at 500–1,875 student
hours, 9–18% of a degree, peaking in year four. One-hop review with a 10% cap bounds it
at a few hours per course, with no scheduler to build and no decay model to defend.

---

## 7. Sharing — D-B24 as resolved

**No server, no directory, no index, no upload, no search.** The app reads and writes
course files in a local folder. Users move them by whatever means they already use.

- **Courses folder.** The app watches a folder; files dropped in appear in the catalog.
  **It holds `.clank` files and nothing else.** It is the folder a reader shares from, so
  progress, professor transcripts, caches and config all live in the user data folder
  instead. Anything that wants to write beside a course file is wrong by construction.
- **Export** is a file copy — the course file is already the artifact.
- **Progress never travels.** Sending a completed course sends the course, not a record
  of how you did.
- **Import shows provenance before anything else** (§8.4).

Two consequences worth naming. This is the shared catalog the economic review said was
necessary and the legal review said was impossible — achieved peer to peer, with you
never hosting a byte. And building a directory or an index later is the single change that
would put you back in the distribution business; that is a decision, not a feature.

---

## 8. Trust boundary — imported course files

A course file is a document from a stranger that the app will render. Treat it as hostile
input in every case, including your own files.

### 8.1 Prose
Render through a strict allowlist of block and inline types. **No raw HTML, no script, no
iframes, no external network fetches at render time.** Links are click-through with the
destination shown; nothing auto-loads.

### 8.2 Widgets
D-B27's answer is already the safe one: the generator may only **instantiate** widgets
from a fixed hand-written library, never author them. So the file carries a widget name
plus parameters, and the app validates those parameters against that widget's schema and
refuses anything unrecognized. No code from a course file ever executes.

### 8.3 Figures
**Raster only.** SVG carries script and is not worth sanitizing. Decode, re-encode, cap
dimensions and file size on import. Reject anything that does not decode as an image.

### 8.4 Provenance on import
Before a single lesson renders, show: who generated it, with which models, which pipeline,
what it was grounded on, what it cost to make, and whether `derived_from_user_material`
is set. Verify `content_hash` and every per-file hash; refuse on mismatch.

---

## 9. What is deliberately not built

No server, accounts, sync or telemetry. No payments, entity, or terms. No credential,
transcript or completion artifact. No integrity enforcement or proctoring. No subject
exclusion list. No accessibility work — D-P21 accepts that exposure, and it is worth
knowing it is the cheapest of these to add now and among the more expensive to retrofit.

No third-party attribution artifact — neither a licences screen nor a
`THIRD-PARTY-LICENSES.txt`. MIT and Apache-2.0 both require the notice to travel with a
copy, so this is a known obligation deliberately not discharged, in the same class as the
accessibility decision above. Recorded so it reads as a choice rather than an oversight; a
generated file is the whole remedy whenever it is wanted.

---

## 10. Build order

**Build the consumer before the producer.** A course file can be hand-authored, or
generated once by you with a throwaway script, long before the harness is any good. That
puts a studyable thing in front of a reader in weeks rather than quarters — and whether
anyone will actually study is the only question that matters and the only one none of the
review's 130 findings could answer.

| | Milestone | What exists at the end |
|---|---|---|
| **M0** | Course file format + renderer | A hand-authored course you can read, with figures and widgets |
| **M1** | Import/export + provenance + trust boundary | You can hand someone a course and they can open it |
| **M2** | Progress store + assessment + checkpoints + test-out | Someone can *take* the course, not just read it |
| **M3** | Office hours + highlight-to-ask | The feature real lectures cannot offer |
| **M4** | Generator: charter → spine → blind 2a/2b → Stage 4 → package | The app makes its own courses, one subject |
| **M5** | Configurable pipeline + critics + manifest cost recording | Your reader panel can A/B the harness |
| **M6** | Counselor + programs + prereq graph + review payload chaining | Multi-course study plans |
| **M7** | Textbook ingestion | Upper-division, where model knowledge thins |

M0–M3 is a complete product for courses that already exist. M4 is where the token meter
first appears in front of a user, so §4.3 must be finished before M4 ships, not after.

---
## 11. Resolved — stack and identity

Answered 2026-08-31. Each entry records what follows from the choice.

| | Decision | Chosen |
|---|---|---|
| 11.1 | UI | **React + Vite** in **Tauri**. No native code beyond what has no plugin. |
| 11.2 | Distribution | **GitHub releases.** Signed installers later. |
| 11.3 | Extension | **`.clank`** |
| 11.4 | Container | **Zip** |
| 11.5 | Progress store | **Append-only event log** — one JSONL for every course, read whole at startup (§15) |
| 11.6 | Widget library | Set before first release. Additive afterwards; removal breaks compatibility. **v1 is `plot@1.0` alone** (§15). |
| 11.7 | Providers | **Any the user brings.** Router from day one; **OpenCode Zen** first. |
| 11.8 | Shipped courses | **None now.** Free first-year courses later, alongside paid pre-generated ones. |
| 11.9 | Claims | **No disclaimer, because no claim.** Assessments mark a course as complete in the UI; the user reads it as an AI's assessment by a model they chose. |
| 11.10 | Name | **Clanker Academy** |

### 11.1a The rendering rule React makes load-bearing

React is fine, and it puts one specific hole within easy reach: `dangerouslySetInnerHTML`.
§3.3 and §8.1 are only real if lesson content never becomes an HTML string.

- **Lessons ship as a structured block tree**, not markdown and not HTML. The renderer is a
  component switch over known block types. An unknown block type renders as a labelled
  placeholder — never as raw content.
- If authoring in markdown is convenient at generation time, convert **markdown → AST →
  React elements** at build time and store the tree. Never markdown → HTML string → DOM.
- **`dangerouslySetInnerHTML` appears nowhere in the codebase.** Make it a lint rule at M0,
  not a habit.
- Math renders from a source string through a renderer in strict mode with trust disabled.
  Cap expression length and nesting depth; a course file is untrusted input, and math
  renderers have historically been an injection path.
- In the wrapper (Tauri — see below), the webview holds only the capabilities explicitly
  allowlisted in the config, and the IPC surface is only the commands declared. Grant the
  minimum of both, and set a strict CSP: no remote script, no remote connect beyond the
  configured providers.

**Wrapper: Tauri.** Two consequences, one of which is an argument I underweighted when I
recommended otherwise.

**It starts locked, which suits this app.** Electron requires you to *switch on*
`contextIsolation` and `sandbox` and switch *off* `nodeIntegration`; a misconfiguration
silently hands a course file a path to code execution. Tauri has no Node in the webview at
all, and the IPC surface is exactly the set of commands declared plus the capabilities
allowlisted per window in the config. For an app whose central constraint is that untrusted
`.clank` content must never reach execution, a locked default beats a documented checklist.
So: **declare the minimum command surface, allowlist the minimum capabilities, and set a
strict CSP in the Tauri config** — no remote script, no remote connect beyond the configured
providers.

**Small binaries matter more here than they usually do.** With GitHub releases and no
auto-update (§11.2a), every update is a full manual re-download. Roughly 10MB against
roughly 150MB, paid every time a reader updates by hand, is a real difference in whether
they bother — and §11.6a's whole design assumes updating is the remedy for an out-of-date
reader.

**Where the work lands.** The webview runs ordinary JS, so zip handling and PDF rendering
happen there with normal libraries — the ingestion pipeline (§12) does not force Rust. The
official plugins cover filesystem, HTTP and dialogs. Rust is needed only where something
must run outside the webview or no plugin covers it; a sidecar binary is the escape hatch if
that ever gets expensive.

**Linux ships from M1.** The usual reasoning — a vocal minority not worth the support cost —
inverts here. The early audience for a bring-your-own-key local course generator skews
heavily toward the population that runs Linux, tolerates fiddling, and opens pull requests;
Windows users report and do not patch. Cross-building is a CI workflow file, not work. And
inbound issues and error logs are now a resource rather than a tax, since they can be fed
into a model and turned into fixes by one person.

Three things follow, because the strategy only pays if the inbound is actionable.

**Separate the two categories of Linux bug, publicly.** Bugs in this app take PRs and can be
triaged. Bugs in webkit2gtk cannot — no patch to this repo fixes a compositing failure in
the system webview, and the real remedies are environment-variable workarounds
(`WEBKIT_DISABLE_DMABUF_RENDERER`, `WEBKIT_DISABLE_COMPOSITING_MODE`) or a distro upgrade.
Ship those workarounds as a documented launch flag with a FAQ entry to point at. Without the
distinction, an unfixable recurring category reads as an endless bug stream.

**Check the webview version at startup and say so.** webkit2gtk's version is pinned to the
distro, so "update to fix it" can mean "upgrade your OS" — which breaks the assumption
underneath §11.6a, where updating the app is always the remedy. Below a known-good version,
name the version found and what may not work, then let the reader proceed. Same shape as the
compatibility modal: detect, state plainly, do not block.

**Ship a one-click diagnostics dump** — webview version, distro, GPU, driver, relevant
environment variables, app version. A blank window produces no useful log, and the most
valuable Linux reports are exactly the ones the reporter cannot describe. This is what turns
"it doesn't work" into something a model can act on, and it is the cheapest part of the
whole strategy.

Windows and macOS remain WebView2 and WKWebView, an ordinary pair to target.

### 11.2a What unsigned GitHub releases cost

- macOS Gatekeeper and Windows SmartScreen will both warn on an unsigned binary. Expect to
  lose a meaningful share of non-technical installs to that dialog and document the
  override path in the README.
- **No auto-update.** Version skew across users is permanent, not transitional — which is
  what makes §11.6a mandatory rather than nice.

### 11.6a Version compatibility — fail loudly, never approximate

**No generated fallbacks.** An earlier draft had every widget instance carry a static prose
fallback for older readers. Rejected, correctly: it costs tokens on every widget in every
course, and nobody generating or sharing a course will ever exercise the fallback path, so
it would be wrong by default. Untested degradation is worse than clear failure, because the
reader cannot tell they are being shown the degraded thing.

Instead the format carries identity and version, and unknown things fail visibly.

#### Widget versioning

Widget identity is `name@major.minor` — `plot@1.4`, `derivation-stepper@2.0`.

**Compatibility rule:** a widget renders iff the renderer has the **same major** and a
**minor ≥ the widget's minor**. A `plot@1.1` instance runs on a `plot@1.4` renderer. A
`plot@1.4` instance refuses on a `plot@1.1` renderer, because 1.4 may use a parameter 1.1
cannot handle. A different major never runs.

- **Minor bump = additive.** New optional parameters, new capability, same meaning for
  everything that already existed.
- **Major bump = anything else.** A rewrite, a removed parameter, or a changed meaning.
- **Releases ship only the latest minor of each major.** The registry declares
  `plot: [1.4, 2.1]`; updates replace a minor renderer in place. Old majors stay shipped —
  deprecate by keeping the renderer, never by deleting it.

**The discipline that makes this safe, stated so it does not get lost:** within a major,
parameters are *add-only*. Never remove one, never repurpose one, never change a default.
The moment a 1.4 renderer changes what a 1.0 parameter means, every old course using it
renders silently wrong — which is the exact failure this whole section exists to prevent.
If a change cannot be expressed additively, it is a major bump.

`manifest.widgets_used[]` records exact versions used (`plot@1.1`), gathered by walking the
lesson and item trees at Stage 7. Zero tokens — collected, not generated.

#### The compatibility modal

Shown on **first open** of a course whose `widgets_used[]` is not fully satisfiable. Import
shows a passive badge; this is the blocking one, because it is where time starts being
invested.

> **This course needs a newer version.**
> Made with Clanker Academy 0.9.2 · you have 0.7.1
>
> 104 of 500 interactive elements won't render — affecting **31 of 84 lessons** and
> **4 assessment items**.
>
> **[ Cancel ]  [ Update ]  [ Proceed anyway ]** ← red

**No breakdown by reason, and no widget names.** Whether an element needs a newer minor or a
major the app has never shipped is the same fact to a reader: it does not render, and the
fix is to update. Nobody reads a changelog to pick a version — they update to the latest.
Listing identities would be developer information in a user's dialog. The identities go to
the app log, where they are useful for debugging and cost nothing.

The counts stay because they are the only thing that answers the reader's actual question —
*is this course usable to me right now* — and lessons and items answer it better than a raw
widget total, which is why both appear.

- **Update** opens the releases page. There is no auto-update (§11.2a), so this is a link,
  not a process, and it points at latest rather than at a specific version.
- **Proceed anyway** records the choice per course and does not ask again on every open — a
  persistent indicator on the course page carries it instead. Once the app is updated the
  flag is moot and clears itself.

#### Assessment items are not a special case

An item whose widget will not render is shown anyway, with the standard inline error card in
the widget's place. The reader answers it or does not; it scores like any other item.

**There is no withdrawal, no recalculation, and no refusal to score.** All of that was
proposed and cut. It is code that exists only to serve readers who declined to update, and
the reader retains the ability to answer from the item's text regardless — a figure they
cannot see is the same situation as a figure they do not understand, which the scoring path
already handles by letting them guess.

The alternative considered was marking such items automatically incorrect. Rejected because
it requires detecting the condition and branching on it, whereas showing the item requires
nothing: the error card already exists from the render rule below, and the scoring path
never learns that widgets exist at all.

#### Render-time behaviour

An unsatisfiable widget renders an inline error card naming the identity and both versions.
**The failure does not propagate** — a course with one unknown widget in lesson 34 stays
fully readable; only that element is a hole. Throwing at course level would make a shared
course unopenable over an element the reader may not need, and with no auto-update that
state persists for as long as they stay on an old build.

The same identity-and-version rule covers block types (§11.1a) and any future item type.

### 11.7a The router's real problem is dialects, not HTTP

OpenCode Zen alone speaks several shapes — an OpenAI-responses endpoint, an
Anthropic-messages endpoint, an OpenAI chat-completions endpoint, and a Google-style path.
So the router's unit is **the API dialect, not the provider.** A provider is a base URL,
an auth scheme, a dialect, and a capability descriptor.

Capability descriptor per model, because the harness cannot assume any of it:

- **Structured output.** The generator needs reliable JSON for the spine, items and
  manifest. Support tiers vary. Implement a fallback ladder — **native schema → JSON mode →
  prompt-and-parse with a repair retry** — and record which tier was used in the manifest,
  because it predicts where malformed output will come from.
- **Usage reporting.** Some providers return token counts; some do not. Where they do not,
  the cost meter (§4.3) must estimate locally and **label the number as an estimate.** The
  meter is spending someone's money; it may not silently guess.
- **Context window.** Governs how much source material a stage can hold and therefore how
  a long textbook chapter gets chunked. It is a routing input, not a footnote.
- **Reasoning/temperature/streaming quirks** per dialect, normalized at the boundary.

**Capability flags carry thresholds, not booleans** — see §12.2, where the difference between
"accepts images" and "can actually read a page" decides whether a provider can ingest a
textbook at all.

Ship Zen at M4 because it is what you test on. The abstraction is a day's work at M4 and a
rewrite at M6.

### 11.9a Claims and the completion label — resolved

No marketing claims means effectively no misrepresentation surface, and no disclaimer is
needed for a free tool that promises nothing.

The label is **"passed"** — see §5.4. It is a statement about what the reader did, not
about what they know, so it is exactly true and needs nothing attached to it. The state is
binary, test-out and completion are indistinguishable in the UI by design, and the grader
model is recorded but never displayed.

### 11.10a Clanker Academy — safe as a project, restricted as an entity

Two different regimes, and the distinction is the useful part.

- **§224(1)(a)** names *university* and *college*, plus material tending to imply a school
  of law, medicine, nursing, engineering and the other enumerated professions. *Academy* is
  not on that list. **Materially safer than "Clanker U,"** which leaned on an abbreviation
  that reads as "university" in exactly this context.
- **Entity formation is separate and stricter.** New York restricts *Academy* — along with
  *School*, *Institute*, *Education*, *College* and *University* — in the names of business
  corporations, LLCs and limited partnerships, requiring consent of the Board of Regents or
  the Commissioner of Education (BCL §301(a)(11), LLCL §204(i)). Education Law §216 also
  bars incorporating an entity providing post-secondary education without that consent.

Nothing here touches an unincorporated open-source project, so the name is fine today. It
becomes a problem at exactly the moment you form the LLC for the monetization paths.

**The fix costs nothing: do not make the entity name match the product name.** Ship the
product as Clanker Academy; register the company as something with no restricted word in
it. Products and legal entities routinely have different names, and separating them now
means the name never has to change later.

Still worth the hour with counsel before the repo goes public — but the question is now
narrow: whether an unincorporated, free, no-claims tool called Clanker Academy implies
operation of an institution. It is a much better question than the one "Clanker U" posed.

---

## 12. Textbook ingestion (M7)

Resolved 2026-08-31. Elaborates D-B22 and constrains §11.7a's router.

### 12.1 Ingestion is a separate model slot

**Ingestion does not use the generation model.** It is a one-time job with different
requirements, and the capability tiers run backwards against price: the cheap models a
reader will pick for generation are the ones least able to read a page.

- Native PDF input: Claude, Gemini, GPT.
- Images but not PDF: the `-VL` open-weight variants — Qwen3-VL, Pixtral, GLM-4.6V.
- Neither: DeepSeek's mainline models, and the base Qwen/Llama/Mistral models people run
  for cheap text generation.

Gemini reads PDFs at **258 tokens per page** and does not charge for text it extracts
natively, so a 400-page textbook ingests for roughly 103k tokens — pennies. A reader
committed to a cheap generation model can afford one ingestion pass on a good one. The
config therefore carries **two model slots**, and the app asks for the ingestion one only
when a reader first supplies a PDF.

### 12.2 The ladder

1. **Provider takes PDF** → send page ranges. Chunk to stay under per-request page limits
   (Anthropic 100, or 600 above a 1M context; Gemini 1000).
2. **Provider takes images** → rasterize pages locally, send images.
3. **Provider is text-only** → local text-layer extraction. Degraded, and where the
   "research the point and substitute" fallback earns its keep.

**"Accepts images" is not "can read a page."** `deepseek-v4-flash-vision-exp` lists `image`
among its input modalities and caps them at 384 tokens — a thumbnail. This is not a
declarable property, so it is **tested rather than looked up**: one dense page with a known
word in a corner, sent once per model, cached (§13.5). A catalog answers vision, context,
PDF support and structured output; only a probe answers usability.

### 12.3 Extract once; the artifact is structure, not prose

Every generation stage reads the stored ingestion artifact. **No stage ever reads the PDF.**
Sending ten PDF pages per call costs ~20–30k tokens against ~6k for the same content as
text, on a path walked hundreds of times per course.

The artifact holds **structure, not a transcription**: section boundaries and what each
covers, the atom/objective mapping, the notation and definitions the book uses, worked-
example setups restated. Short verbatim fragments where precision matters — a definition, a
theorem statement — but never continuous prose.

Three reasons, and they point the same way. It is what the generator actually needs: what to
teach, in whose notation, not a copy of the book. It is a far better copyright posture,
being transformative rather than reproductive. And it avoids **Gemini's `RECITATION` filter**,
which halts generation on output that looks like reproduction, fires on users' own content,
cannot be disabled, and fails by *truncating mid-response after you have paid for the
tokens* — which would otherwise turn a fifty-lesson run into a `PARTIAL` course for reasons
unrelated to any bug. Recitation-style truncation is a Google behaviour; other providers
filter differently, which is one more reason the ingestion slot is swappable.

### 12.4 Scanned PDFs: detect, refuse, do not OCR locally

**No OCR library ships.** The vision model *is* the OCR, and a better one — Tesseract would
add tens of megabytes with language data, run for many minutes on a full textbook, and
produce worse output on exactly the material that matters: equations, subscripts,
multi-column layout. It would be a second-rate OCR carried alongside a first-rate one
already being called. And it would be a fallback inside a fallback, since OCR alone does not
produce the structure artifact — that still needs a model.

What ships instead is **detection**:

- **No text layer.** Extract text, count characters per page against a threshold.
- **Bad text layer — the nastier case.** Many scans were already OCR'd by whoever digitized
  them, so the layer exists and is mangled, especially for math, and a presence check
  passes. Catch it with cheap heuristics — implausible character distributions, unmapped
  glyphs, near-zero digits or operators on a page the vision pass reports as full of
  equations — or by cross-checking a sample against the vision pass, which runs anyway.

**Rule: no usable text layer means ingestion requires a vision-capable model, and the app
says so and stops.** It does not degrade, does not OCR locally, and does not build a course
on garbage.

### 12.5 Figure clipping

D-B27 allows clipping whole figures from the reader's textbook. **No computer-vision or
detection library is needed.** Two paths, both on dependencies already carried:

- **Embedded rasters** — photographs and scanned diagrams are discrete objects in the PDF
  and can be enumerated and pulled at original resolution by the same PDF library used for
  rasterization in §12.2. No cropping, no coordinates.
- **Vector figures** — plots and geometric diagrams are drawing operators with no image to
  extract. The vision model is already reading the page, so it returns an approximate
  bounding box and the page raster is cropped to it. Cropping is a canvas operation, no
  library.

**Pad the boxes generously.** Model boxes are approximate, and the error is asymmetric: 20px
of extra margin looks fine, a tight crop that clips an axis label does not.

**Cap resolution at generation time**, not only on import (§8.3). Forty figures at 300 DPI
turns a `.clank` into tens of megabytes, and these files are meant to be emailed.

**Figures are the one artifact that stays a verbatim copy.** A definition can be restated; a
phase portrait cannot. A `.clank` carrying clipped figures holds reproductions of a
copyrighted work, and these files get shared. This is precisely what
`derived_from_user_material` marks (§3.2, §8.4), and D-P06 puts responsibility with the
reader — but if any part of this pipeline ever draws attention, it will be the figures
rather than the generated prose.

---

## 13. Model slots

Five configurable slots, each with a recommendation list and a dropdown filtered to the
models the reader's provider offers that are capable of that slot's job. Supersedes §12.1's
two-slot sketch.

### 13.1 The slots

| Slot | Job | Token volume per course | Hard requirements |
|---|---|---|---|
| **Planning** | Building the program plan, and Stages 0–1: charter, module/lesson/atom decomposition | **~50k — smallest** | Structured output |
| **Course generation** | Stages 2a/2b: lecture prose, items, rubrics | **~6M in / 800k out — largest** | Structured output |
| **Final checker** | Stage 3 critics and the pre-package pass | Comparable to generation if full critics run | Structured output |
| **Ingestion** | Reading the reader's textbook (§12) | ~100k, once per book | **Vision or native PDF, above the document-page threshold** |
| **Professor** | Office-hours sidebar, grading in-course subjective checkpoints (§5.3), and the counselor *conversation* | Many small calls, across the life of the course | Low latency; long context |

### 13.2 The principle behind the recommendations

**Volume and leverage run opposite each other, so the price recommendation is not uniform.**

- **Planning is the smallest slot and the highest leverage — recommend the strongest model
  available.** Everything downstream is generated against the spine and validated against it
  by Stage 4's deterministic checks. A bad spine poisons every lesson and every item in the
  course, and it does so invisibly, because the coverage and orphan checks will all pass
  against a wrong objective list. It is ~50k tokens. Spending Opus-tier money here costs
  cents and protects the whole build.

  **The counselor splits across two slots rather than compromising on one.** A program plan is
  a few thousand tokens that decides what someone studies for years, so it wants the strong
  model — but a conversation with a model that thinks for a minute per turn is unusable. So:

  - **The conversation runs on the professor slot** — cheap, fast, already the model handling
    every other back-and-forth in the app.
  - **The plan is built on the planning slot** — slow and strong, from a compacted brief the
    conversation produces.

  A reader will not tolerate a minute between chat turns and will happily wait a few minutes
  for a program to be built. Splitting on that boundary gets the right model for each, rather
  than a compromise that is mediocre at both.
- **Course generation is the largest slot — this is where a cheap model pays.** It is two
  orders of magnitude more tokens than the spine. A reader economising should economise
  here, and the structure of the harness is what makes that safe: generation works from a
  spine a better model produced, and its output is checked.
- **Professor is the largest slot across a whole program**, because it is charged per
  question over hundreds of study hours rather than once per course. It is the slot whose
  cost a reader will actually feel accumulating.

### 13.2a The handoff brief

The conversation does not hand the planning model a transcript. It produces a **structured
brief** — goals, stated prior knowledge, hours per week, timeline, subject interest, and any
constraints such as intending to test out of something or having a particular textbook.

Three reasons this is a structured object rather than a chat log. It is small, so the strong
model spends its context reasoning about the plan rather than reading conversation. It can be
**shown to the reader for confirmation** before minutes are spent building anything. And it
makes the plan **re-runnable**: if the program comes back wrong, the brief is edited and
regenerated, without repeating the interview.

**The wait is latency, not cost.** Plan construction is a few thousand tokens — cents even on
the most expensive model — so this moment needs a progress indicator and a cancel, not a
spend warning. That distinguishes it from course generation (§4.3), which needs both.

This shape generalises: **cheap-and-fast for the conversation, strong-and-slow for the
artifact the conversation produces.** Replanning follows the same path.

### 13.3 The checker must not match the generator

**Recommend, and warn when violated: the final checker should be a different model family
from course generation.** A critic that shares weights with the generator shares its blind
spots, and their errors correlate on precisely the confident-plausible-wrong cases the
critic exists to catch. Same-family checking inflates confidence without improving output.

This is a **warning, not a block** — a reader with access to one family should still be able
to proceed, told plainly that the check is weaker than it looks.

### 13.4 Configuration UX

- **One default model, five overrides.** Asking for five choices before a reader has seen
  anything contradicts D-P10 (§5, straight to the counselor). Set one model, let every slot
  inherit it, and expose the per-slot overrides collapsed. The recommendation list is what
  makes the collapsed state defensible.
- **Ingestion is requested lazily** — only when a reader first supplies a PDF, and only if
  the inherited default cannot read pages.
- **The manifest records the model per slot**, not merely per stage (§3.2), so a course's
  provenance names what generated its spine as distinctly as what generated its prose.

### 13.5 The capability table

Filtering a dropdown to "models compatible with this slot" needs each model's vision
support, context limit, document-input support and structured-output tier. Provider
endpoints mostly will not tell you: OpenAI's `/v1/models` returns `id`, `created` and
`owned_by` and nothing else; Anthropic's is similarly thin; Gemini's carries
`inputTokenLimit` but no clean modality flag. Gateways are the exception. Discovery alone
does not work.

**Source: [models.dev](https://github.com/sst/models.dev)**, served as `api.json`. It is
maintained by the SST team — the same people who build OpenCode and Zen, and it is what
opencode uses internally, so the primary provider's capability data is maintained by that
provider's own authors. Its fields map onto what the slots need:

| Need | Field |
|---|---|
| Vision | `modalities.input` contains `image` |
| Document ingestion | `modalities.input` contains `pdf` |
| Context window | `limit.context` |
| Structured output (§11.7a) | `structured_output` |
| Cost per slot, shown at config time | per-token pricing |

**Use the official client: `@opencode-ai/models`.** It provides both halves of the design in
one MIT dependency, with **zero runtime dependencies** (`effect` is an optional peer):

- `Models.make().providers()` — live `GET /api.json`.
- `@opencode-ai/models/snapshot` — a full copy of the database bundled in the package as a
  separate tree-shakable entrypoint, automated and **at most ~24h behind live**.

The fallback pattern is the one the README documents, and it is exactly what this section
specifies independently:

```ts
const providers = await client.providers()
  .catch(async () => (await import("@opencode-ai/models/snapshot")).providers)
```

Live fetch keeps the catalog current even though the binary is not — which is what makes
this survive having no auto-update (§11.2a). The bundled snapshot keeps the app correct
offline and on first run. Manual entry remains the escape hatch for a model the catalog does
not carry; a wrong manual declaration fails loudly at first use.

**Cost of carrying it:** `snapshot.js` is 5.2 MB raw and **475 KB gzipped**; the client
itself is 2.3 KB. In a ~10 MB Tauri binary that is a few percent, and **the snapshot should
be dynamically imported** — as in the pattern above — so those 5.2 MB are parsed only when
the live fetch fails, not on every cold start.

**Two integration notes.** The package is at `0.0.61`, so pin it and expect pre-1.0 API
churn. And `Models.make({ fetch })` accepts an injected fetch — under Tauri, either add
`models.dev` to `connect-src` in the CSP or route the call through the HTTP plugin via that
option, since §11.1a's strict CSP will otherwise block it.

**Licence: MIT** (Copyright (c) 2025 models.dev), and since the catalog arrives as an npm
dependency it lands in the dependency tree with everything else, so licence tooling picks it
up automatically rather than needing a hand-written entry.

No attribution artifact ships — see §9.

**The ingestion slot gets a probe, because no catalog can answer its question.**
`deepseek-v4-flash-vision-exp` lists `image` among its input modalities and is useless for a
textbook page at 384 tokens per image. "Accepts images" and "can read a dense page" are
different properties and only one of them is declarable.

So: render one page of dense text with a known word in a corner, send it, ask for the word
back. Passing means genuinely usable. It costs a fraction of a cent, runs once per model,
caches locally, and is ground truth rather than a claim. **This replaces the
document-page token threshold in §12.2** — that number was always going to be a guess, and
an empirical check is both cheaper to maintain and more accurate.

Probing spends the reader's money without being asked, so it runs on selection of a single
model rather than across a whole dropdown, and the cost is disclosed in line with §4.3.

---

## 14. The dashboard is a tech tree

The dashboard draws **the plan** (§2), not the installed course files: a layered graph of
course slots, roots at the top, dependents below, lines for prerequisite edges. Each node is
a box carrying the course name. Disconnected components sit side by side — a programme
routinely has a maths chain, a subject chain, and standalone courses with no edges at all.

**Most nodes are empty most of the time.** The counselor produces the whole programme before
any of it exists, so a reader sees their entire degree on day one as a graph of slots, nearly
all unfilled. That is the intended first impression.

### 14.1 Depth is computed, not authored

**A course's row is its longest path from any root in the prerequisite graph.** "Easier
courses up top" is therefore derived rather than stored as a difficulty attribute — which
matters, because an authored difficulty can contradict the edges (a course marked easy
sitting below three hard prereqs) and a computed depth cannot. One source of truth, and the
layout cannot disagree with the gating logic.

Row 0 — slots with no prerequisites — is also the "you can begin here today" row, for free.

### 14.2 Three states, and a fill

| State | Overlay |
|---|---|
| **Passed** | Green check, transparent |
| **Locked** — a prerequisite is unpassed | Grey lock, transparent |
| **Everything else** | Transparent grey fill, rising from the bottom in proportion to progress |

The fill does the work two separate states would otherwise need. A slot at 0% is an empty
box; one at 40% is visibly forty percent grey. Available and in-progress are the same state
seen at different values, so nothing has to distinguish them.

**There is no "start course" button.** A reader opens a slot and begins; the fill creeps.
Removing the button removes the moment where starting feels like a commitment being made,
which is the moment a reader hesitates.

### 14.3 The plus: filling an empty slot

An **available slot with no course file** carries a plus icon rather than a fill. It opens a
screen offering three ways to fill it:

- **Generate the course** — the full build.
- **Generate the final only** — for testing out (§4.4). Roughly 5–10% of the cost, and if the
  attempt fails the rest can be generated on top of the same spine.
- **Import a `.clank`** — a file from anywhere.

Combining gate state with whether a file is present gives the whole surface:

| | No file | Has file |
|---|---|---|
| **Locked** | Lock | Lock |
| **Available** | **Plus** → generate or import | Box with progress fill |
| **Passed** | — | Green check |

### 14.4 Generate only what is available

**No course is generated until it is available to take.** Cost is therefore incremental
across a programme rather than paid up front, a reader's first generation happens after they
have already used the app rather than before, and work is never spent on a course a later
replan removes.

### 14.5 Filling a slot with a course from elsewhere

A reader can hand the counselor any `.clank` — downloaded, sent by a friend — and say they
want to take it. The counselor reads its manifest metadata, identifies which slot it fills or
creates a new one for it, and attaches prerequisites and dependents. It may also make later
courses depend on it.

This is the only path by which an outside file enters the graph, and it is why manifest
prerequisites are descriptive rather than binding (§2): the counselor decides what an
imported course is *for*, and nothing a stranger writes in a file can change the gating.

The plan is renegotiable at any point — the counselor can be reopened to add, remove or
reorder future courses, including slotting in something just downloaded.

### 14.6 Interaction

- **Click a slot with a file** → open it.
- **Click an empty available slot** → the generate-or-import screen.
- **Click a locked slot** → name the specific unpassed prerequisites. The graph holds this
  already, and it turns a dead end into the reader's next decision.
- **Fit-to-view on open**, with pan and zoom. A one-course plan and a forty-course degree use
  the same view.

### 14.7 Rendering

**SVG, not canvas.** At a few dozen nodes, occasionally a hundred, SVG gives hit-testing,
focus handling and CSS state styling for free; canvas only pays above thousands. Overlays —
check, lock, progress fill — are elements over the box, so they are styled rather than drawn.

**Layout is a Sugiyama-style layered drawing**: assign layers by depth (§14.1), order within
each layer to minimise edge crossings, then assign coordinates. Crossing minimisation is the
part not worth hand-writing.

**Layout library: `d3-dag`** (v1.2.2, MIT, ~44 KB gzipped ESM, four transitive deps). It
returns coordinates only; drawing stays ours. It **packs disconnected components
automatically** — no manual side-by-side packing is needed, correcting an earlier note here.
It also ships a dagre compatibility layer, so moving off it later is cheap.

**The layering operator must be configured explicitly, and the default is wrong for us.**
Verified by running it: `layeringLongestPath()` defaults to `topDown(true)`, which aligns
*leaves* to the bottom rather than *roots* to the top. On a graph with four disconnected
components, that placed a standalone course with no prerequisites in the **bottom row**,
where it reads as the hardest thing in the programme. `topDown(false)` puts every root on row
0, which is §14.1's rule and the "you can begin here today" property.

```js
sugiyama()
  .layering(layeringLongestPath().topDown(false))   // roots on row 0 — NOT the default
  .decross(decrossTwoLayer())                        // heuristic; decrossOpt is exact but exponential
  .coord(coordSimplex())
  .nodeSize(() => [w, h])
  .gap([xGap, yGap])
```

Confirmed on a four-component graph: all roots land on row 0, chains descend correctly, and
components sit side by side. `decrossOpt` should be avoided at course-catalogue sizes — it is
optimal and exponential; the heuristic, or the library's `fast | medium | slow` quality
preset, is what a forty-node graph wants.

---

## 15. Dependencies and storage layout

Settled 2026-09-03, after §11 fixed the stack. Each entry records what follows from the
choice, and two of them record a proposal that was cut — those are the useful ones.

### 15.1 The dependencies

| | Item | Chosen |
|---|---|---|
| 15.1a | Graph layout | **`d3-dag`** v1.2.2, with §14.7's verified `sugiyama()` config |
| 15.1b | Widget library v1 | **`plot@1.0` alone** |
| 15.1c | Math | **KaTeX**, `trust: false`, `strict: true`, length and nesting caps |
| 15.1d | Zip | **`fflate`** |
| 15.1e | Schema validation | **Zod**, at the untrusted-input boundary only |
| 15.1f | PDF | **`pdf.js`** (`pdfjs-dist`) |
| 15.1g | State management | **None.** React context plus a reducer |
| 15.1h | Testing | **Vitest + React Testing Library**, and nothing else |

**`plot@1.0` alone is the whole widget library at first release.** Additions are cheap and
removals are a major bump (§11.6), so the narrowest v1 is the right shape. Two consequences.
The registry, the `name@major.minor` identity rule and §11.6a's render check all ship with a
single entry in them — **the mechanism is what M0 proves, not the catalogue** — and the
weight shifts onto the **block vocabulary**, which now carries what widgets would otherwise
have carried. The hand-authored M0 course is the only thing that tests whether that
vocabulary is right, so it is written before the schema is frozen at M1.

**Zod stops at the trust boundary** — block tree, widget parameters, manifest, spine, item
banks, everything §8 treats as hostile. Internal shapes stay plain TypeScript. Validation
that creeps inward spends runtime re-proving what the compiler already proved.

**No state library, and the reasoning generalises.** The loaded course is read-only after
parse, the widget registry is a module constant, and reading position is component-local;
the only genuinely shared mutable thing is the progress projection (§15.2), which one
reducer covers. A library was proposed by reflex and cut for failing this document's own
test — compare options by code written, and check whether the simpler option adds a branch.
The two places a symptom would first appear are M3's professor sidebar streaming tokens
beside a rendered lesson and M4's live cost meter; even there the first fix is splitting the
context, not adding a dependency.

**Testing needs no second framework, and the obvious one does not work here.** Playwright
cannot drive a Tauri shell at all — Tauri runs the system webview (WebView2, WKWebView,
webkit2gtk) rather than Chromium over CDP. The supported path is WebDriver: `tauri-driver`,
Windows and Linux only since macOS has no WKWebView driver, or WebdriverIO's embedded-driver
service across all three. It is also unnecessary, because the risky logic is pure: Stage 4's
four checks (§4.1), the §11.6a compatibility rule, zip parse and hash refusal, schema
rejection of a hostile manifest, the progress projection, and deterministic grading (§5.3).

**Security posture is tested as configuration, not as a browser session.** Read
`tauri.conf.json` and assert that the declared commands and allowlisted capabilities equal
an expected set. That is what §11.1a actually depends on, it catches a quietly widened
allowlist in milliseconds on every run, and it needs no driver. Launching on three webviews
is a manual smoke per release (M1). Revisit only if smoke starts missing things — and then
it is WebdriverIO.

### 15.2 The progress store on disk

**One JSONL for every course, read whole at startup** into an in-memory projection that
everything else reads. No SQLite, no reverse reading, no second read path. The file is the
source of truth; the projection is disposable and rebuilt on every launch.

Measured on a synthetic full degree — 40 courses at roughly 320 events each — the file is
**2.2 MB and reads and projects in about 60 ms**. Ten times that is still under a second, so
there is no scale at which a reader of this app needs an index.

Progress is a **max over position events**, which is what §5.4's linear bar already means, so
a reader who revisits section 3 after reaching section 10 needs no special handling.

**What governs the size is event granularity, not course count.** Log discrete events, never
continuous ones:

- Scroll and page position are not events.
- Professor conversations are not events, and neither is a question about one (§5.2).
- **A test attempt is one appended object** — form ID, and an answer sheet of
  `(item, atom, given, correct)` for every question — not a line per question. This is also
  what makes §5.3a's results page, and revisiting an earlier attempt, a read of a single
  record rather than a reassembly.

The only recovery logic is **dropping a trailing line that will not parse**. A crash can tear
an append; append-only means nothing earlier can be damaged.

### 15.3 Where files live

| Location | Holds |
|---|---|
| **Courses folder** | `.clank` files, and nothing else |
| **User data folder** | The progress log, professor session files, caches, configuration |

The courses folder is the one a reader shares from, which is the whole reason for the split:
nothing private is ever written where a course file sits (§7).
