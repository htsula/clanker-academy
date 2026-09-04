# Step 4 — Lock the app down before it can do anything

**Goal.** The security posture from §11.1a, set while the surface is still empty.

## Why now

Tauri starts locked, and the whole reason it was chosen over Electron is that the default is
safe. That advantage is spent the moment things get switched on casually. Deciding the
allowed surface while it is empty takes minutes; auditing it later takes a day.

## Plan

1. In `tauri.conf.json`, **declare the minimum command surface** — right now, none. Every
   command added later is a decision, not a default.
2. **Allowlist the minimum capabilities** per window. Add nothing speculatively.
3. Set a **strict CSP**: no remote script, no inline script, no remote connect. There is no
   provider to talk to yet, so the connect list is empty.
4. Write the **config assertion test** (D9): read `tauri.conf.json` and assert the declared
   commands and allowlisted capabilities equal an expected set, failing if either grows.
   This needs Vitest, which step 5 installs — write the test then, or install Vitest early
   and write it now.
5. Commit, and note in the README that widening the allowlist means updating that test on
   purpose.

## Expected at the end

- The app still opens and still shows the page.
- `tauri.conf.json` grants essentially nothing.
- A capability added without updating the expected set fails the test.

## The rule this encodes

A course file is untrusted data and must never reach code (§3.3, §8). The config is where
that is actually enforced.
