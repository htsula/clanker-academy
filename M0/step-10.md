# Step 10 — The widget registry, the version rule, and the error card

**Goal.** `plot@1.0` renders, and every widget version that is *not* satisfiable fails
visibly in place.

## The point of this step

**The mechanism is the deliverable, not the widget.** One widget is enough to prove the
registry, the identity rule and the failure path — and §11.6 means every widget shipped is
supported forever, so shipping one is the cautious choice.

## Plan

1. Build the **registry**: a map from `name` to the majors this build ships, each at its
   latest minor. Declared in code, never in a course file.
2. Implement the §11.6a rule: a widget instance renders **iff** the renderer has the **same
   major** and a **minor ≥ the instance's minor**. A different major never renders.
3. Write `plot@1.0`: parameters only — data or a function, axis labels, ranges — validated
   against its own Zod schema. Unrecognized parameters are refused.
4. Build the **inline error card**: it names the identity and both versions, sits where the
   widget would be, and **does not propagate**. One bad widget in lesson 34 leaves the rest
   of the course fully readable.
5. Collect the widget identities found when walking a lesson tree — this is what
   `manifest.widgets_used[]` is built from at package time (step 12).
6. Commit.

## Expected at the end

- A `plot@1.0` instance renders a real plot.
- A `plot@1.9` instance shows the error card (minor too high).
- A `plot@2.0` instance shows the error card (unknown major).
- An instance with a bogus parameter is refused by the schema.
- In every case the surrounding lesson renders normally.
- Unit tests for the version rule as a pure function — every combination, no rendering.
