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