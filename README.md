# Clanker Academy

A free, open-source desktop app that generates and delivers a university-shaped
course of study on your own machine, using your own inference provider and your
own materials. No server, no accounts, no telemetry. Built with Tauri, React and
Vite. To build from source you need Node.js (LTS) and Rust (via rustup), plus
the platform prerequisites for your OS.

## Security posture

Tauri is configured to grant the minimum: a narrow capability allowlist, no
declared commands or plugins, and a strict CSP (no remote script, no inline
script, no remote connect). `tests/config-assertion.test.ts` pins all of it —
**widening the capability allowlist or adding a command, plugin, or CSP source
requires updating that test on purpose.** Course files are untrusted input;
`dangerouslySetInnerHTML` and HTML-string assignment are banned by lint, and
`npm run package:fixtures` rebuilds the hand-authored `.clank` from
`src/fixtures/`.

## Installing

Every release is built automatically when a version tag is pushed; the
installers are on the [releases page](https://github.com/htsula/clanker-academy/releases).
The builds are **unsigned** and there is **no auto-update**: nothing is sent
anywhere by the app, and every update is a manual re-download of a small
binary from that page.

Because the builds are unsigned, your operating system will warn the first
time you open one. That warning is the gate doing its job on an unknown
developer, not a detection of a problem with the file. Two paths past it:

- **macOS (Gatekeeper).** After dragging the app into Applications,
  right-click it and choose **Open**, then **Open** again in the dialog.
  Or, in Terminal:
  `xattr -dr com.apple.quarantine "/Applications/Clanker Academy.app"`
- **Windows (SmartScreen).** When the "Windows protected your PC" screen
  appears, click **More info**, then **Run anyway**.
- **Linux.** The `.deb` and `.AppImage` carry no gate; install or run them
  as you normally would.
