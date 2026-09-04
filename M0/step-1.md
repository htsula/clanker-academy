# Step 1 — Tools installed, empty repo, first commit

**Goal.** A folder under version control, and the toolchains a Tauri build needs, verified
by actually running them.

## Plan

1. **Install Node** (LTS). Check: `node -v` and `npm -v` both print a version.
2. **Install Rust** via rustup — Tauri's build side is Rust even though you will write
   almost none. Check: `cargo -V` prints a version.
3. **Install the platform prerequisites** for whichever machine you are on. These are the
   step people skip and then debug for an hour:
   - **Windows** — Microsoft C++ Build Tools, and WebView2 (present on Windows 11).
   - **macOS** — Xcode Command Line Tools: `xcode-select --install`.
   - **Linux** — the `webkit2gtk` development package and its build dependencies, named
     differently per distro.
4. **Create the project folder** and `git init` inside it.
5. Add a `.gitignore` covering at minimum `node_modules/`, `dist/`, `target/`.
6. Add a `README.md` with one paragraph: what this is, and that it needs Node and Rust.
7. **First commit.**

## Expected at the end

- `node -v`, `npm -v` and `cargo -V` all answer.
- `git log` shows one commit.
- Nothing builds yet, and nothing is supposed to.

## Note

Do the platform prerequisites for your own machine only. The other two get exercised by CI
in step 5, which is a better place to find out they are wrong than your afternoon.
