# Step 5 — Guard rails: lint ban, tests, three-platform CI

**Goal.** The things that must predate the habits they prevent.

## Plan

1. Add **ESLint** and set `react/no-danger` to **error**. This is §11.1a's ban on
   `dangerouslySetInnerHTML`, and it only works if it lands before the habit.
2. Add **Vitest + React Testing Library** (D9). No other test framework — Playwright cannot
   drive a Tauri shell, and the risky logic here is pure anyway.
3. If step 4's config assertion test is not yet written, write it now.
4. Add **GitHub Actions**: on every push, run lint and tests, and build **Windows, macOS and
   Linux**. Cross-building is a workflow file, not work.
5. Deliberately break each guard rail once — add a `dangerouslySetInnerHTML`, add a
   capability — and watch CI go red. Then revert. A guard rail you have never seen fire is
   a guard rail you are trusting on faith.
6. Commit.

## Expected at the end

- Three binaries produced by CI, each of which launches.
- Lint, tests and the config assertion all run on every push.
- You have personally seen each guard rail fail the build.

## Do not

Do not start step 6 until CI is green on all three platforms. A cross-platform break found
here is a config line; found in step 12 it is a bisect.
