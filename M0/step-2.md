# Step 2 — A React app that runs in a browser

**Goal.** `npm run dev` serves a page you can open. No desktop app yet.

## Why separately from Tauri

If something is broken here, it is a web problem. Once Tauri is added, every problem looks
like a Tauri problem. Get the ordinary part working while it is still ordinary.

## Plan

1. Create a **Vite + React + TypeScript** project in the repo.
2. `npm install`, then `npm run dev`, and open the URL it prints.
3. Change some visible text, confirm the page updates without a reload.
4. Set up TypeScript in **strict mode** now — it costs nothing today and is a migration
   later.
5. Commit.

## Expected at the end

- A browser tab showing your page.
- Editing a component updates it live.
- `npx tsc --noEmit` passes.
