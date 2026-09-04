// Clear the way for the dev server, then free its port.
//
// tauri.conf.json hardcodes devUrl http://localhost:5173. Vite's default is to
// drift to the next free port when 5173 is taken, which means the Tauri window
// silently loads whatever *older* server still holds 5173 — a stale build
// presented as the current one. vite.config.ts sets strictPort so that drift
// becomes a hard failure; this script removes the usual causes of that failure.
//
// Two distinct leftovers have to go:
//
//   1. A previous dev server still LISTENING on the port. Reclaim it.
//   2. A previous dev server that is running but bound to NOTHING. `tauri dev`
//      spawns `npm run dev` as a child; when the tauri process dies the npm and
//      vite processes below it are orphaned, and a vite that hung before it
//      finished binding holds no port at all — so a port check alone never sees
//      it. One such process sat for 44 minutes holding nothing.
//
// Only this project's processes are touched, and never this script's own
// ancestors — `predev` runs *underneath* the very `npm run dev` chain that the
// pattern below would otherwise match.

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const port = Number(process.argv[2] ?? 5173)
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`free-port: "${process.argv[2]}" is not a valid port`)
  process.exit(1)
}

const projectRoot = resolve(process.cwd())

function sh(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return '' // no match, or the tool is absent — both mean "nothing to do"
  }
}

function kill(pid) {
  if (process.platform === 'win32') sh('taskkill', ['/PID', String(pid), '/T', '/F'])
  else sh('kill', ['-9', String(pid)])
}

// --- process table -----------------------------------------------------------

// Returns [{ pid, ppid, cmd }] for every process we can see.
function processTable() {
  const rows = []

  if (process.platform === 'win32') {
    // JSON keeps command lines containing commas and quotes intact, which a CSV
    // dump does not.
    const out = sh('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress -Depth 2',
    ])
    if (!out.trim()) return rows
    let parsed
    try {
      parsed = JSON.parse(out)
    } catch {
      return rows
    }
    for (const p of Array.isArray(parsed) ? parsed : [parsed]) {
      rows.push({ pid: p.ProcessId, ppid: p.ParentProcessId, cmd: p.CommandLine ?? '' })
    }
  } else {
    for (const line of sh('ps', ['-eo', 'pid=,ppid=,args=']).split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)
      if (m) rows.push({ pid: Number(m[1]), ppid: Number(m[2]), cmd: m[3] })
    }
  }

  return rows
}

const table = processTable()
const byPid = new Map(table.map((r) => [r.pid, r]))

// Every process between this script and PID 0. These are the npm/cmd wrappers
// that launched us; killing one would kill the run we are preparing for.
function ancestorsOf(pid) {
  const seen = new Set()
  let cur = byPid.get(pid)
  while (cur && !seen.has(cur.pid)) {
    seen.add(cur.pid)
    cur = byPid.get(cur.ppid)
  }
  return seen
}

const protectedPids = ancestorsOf(process.pid)

// --- 1. sweep stale dev processes for this project ---------------------------

// A vite belonging to this project. The path appears in vite's own command line;
// its `cmd /c vite` and `npm run dev` wrappers carry no such marker, so those are
// reached by walking up from a matched vite rather than by pattern alone.
const isProjectVite = (cmd) => cmd.includes(projectRoot) && /vite/i.test(cmd)
const isDevWrapper = (cmd) => /[\\/]c\s+vite\b/i.test(cmd) || /\brun\s+dev\b/i.test(cmd)

const stale = new Set()
for (const row of table) {
  if (protectedPids.has(row.pid) || !isProjectVite(row.cmd)) continue
  stale.add(row.pid)
  // Claim the wrapper chain above it, stopping at anything we must not touch.
  let parent = byPid.get(row.ppid)
  while (parent && !protectedPids.has(parent.pid) && isDevWrapper(parent.cmd)) {
    stale.add(parent.pid)
    parent = byPid.get(parent.ppid)
  }
}

for (const pid of stale) {
  const row = byPid.get(pid)
  kill(pid)
  console.log(`free-port: killed stale dev process ${pid} (${(row?.cmd ?? '').slice(0, 70).trim()})`)
}

// --- 2. reclaim the port ------------------------------------------------------

function listenersOn(port) {
  const pids = new Set()

  if (process.platform === 'win32') {
    // Columns: Proto  LocalAddress  ForeignAddress  State  PID
    for (const line of sh('netstat', ['-ano', '-p', 'TCP']).split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 5 || cols[3] !== 'LISTENING') continue
      // Match the port exactly, so :5173 does not also match :51730.
      if (!new RegExp(`:${port}$`).test(cols[1])) continue
      pids.add(cols[4])
    }
  } else {
    for (const pid of sh('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).split(/\r?\n/)) {
      if (pid.trim()) pids.add(pid.trim())
    }
  }

  pids.delete('0') // the System idle process is never ours
  return [...pids].filter((p) => !protectedPids.has(Number(p)))
}

const holders = listenersOn(port)
for (const pid of holders) {
  kill(pid)
  console.log(`free-port: killed PID ${pid} holding ${port}`)
}

// Confirm, so a failure to reclaim is loud rather than a confusing strictPort
// error a second later.
const survivors = listenersOn(port)
if (survivors.length > 0) {
  console.error(`free-port: ${port} is STILL held by ${survivors.join(', ')} — free it manually`)
  process.exit(1)
}

if (stale.size === 0 && holders.length === 0) console.log(`free-port: ${port} is free, no stale dev processes`)
