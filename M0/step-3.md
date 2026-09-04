# Step 3 — Wrap it in Tauri and open a real window

**Goal.** A desktop window on your own machine, showing the step 2 page.

## Plan

1. Add Tauri v2 to the project and let its init put the Rust side in place.
2. Point Tauri's dev server config at Vite's dev URL and its build output at Vite's `dist`.
3. `npm run tauri dev` — a window opens.
4. `npm run tauri build` — an installer or binary is produced for your platform. Install it
   and run it once, so you have seen the real thing, not just dev mode.
5. Commit.

## Expected at the end

- A native window showing your React page.
- A built binary that runs after being installed.
- The first build is slow; that is Rust compiling, and it is cached afterwards.

## Do not

Do not add a Tauri command, plugin, or capability yet. The next step decides what the app is
allowed to do, and it is easier to grant from nothing than to audit what accumulated.
