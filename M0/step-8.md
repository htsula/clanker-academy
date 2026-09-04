# Step 8 — Math

**Goal.** Equation blocks render, and hostile input cannot use them as a way in.

## Plan

1. Add **KaTeX** (D3).
2. Configure it with `trust: false` and `strict: true`. Never the permissive defaults.
3. **Cap expression length and nesting depth before the call**, in the schema or a guard —
   not by trusting the renderer to cope.
4. An expression that fails to parse, or exceeds a cap, renders an inline error in place of
   the equation. The lesson stays readable.
5. Commit.

## Expected at the end

- Equations in your fixtures render correctly, inline and display.
- A deliberately malformed expression produces an inline error, not a blank page.
- An absurdly long or deeply nested expression is refused by the cap, with a test for it.

## Why this gets its own step

Math renderers have historically been an injection path, and a course file is untrusted
input (§8). This is a security surface, not a formatting feature.
