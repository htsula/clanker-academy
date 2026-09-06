// Report what is standing in the dev server's way — and, only when asked, clear it.
//
// tauri.conf.json hardcodes devUrl http://localhost:5173. Vite's default is to
// drift to the next free port when 5173 is taken, which means the Tauri window
// silently loads whatever *older* server still holds 5173 — a stale build
// presented as the current one. vite.config.ts sets strictPort so that drift
// becomes a hard failure instead; this script explains that failure before it
// happens, and names the process responsible.
//
// Two distinct leftovers cause it:
//
//   1. A previous dev server still LISTENING on the port.
//   2. A previous dev server that is running but bound to NOTHING. `tauri dev`
//      spawns `npm run dev` as a child; when the tauri process dies the npm and
//      vite processes below it are orphaned, and a vite that hung before it
//      finished binding holds no port at all — so a port check alone never sees
//      it. One such process sat for 44 minutes holding nothing.
//
// Killing is opt-in. `npm run dev` only looks and reports: a port can be held by
// something that has nothing to do with this project, and silently killing it on
// every dev run is not a trade worth making. Two commands pass --force and do
// the reclaiming — `npm run dev:force` (reclaim, then start the server) and
// `npm run dev:clean` (reclaim only). Every message below names whichever one
// applies, so the report is enough on its own to act on.
//
// Even under --force, only this project's processes and the port's actual
// holders are touched, and never this script's own ancestors — `predev` runs
// *underneath* the very `npm run dev` chain that the pattern below would
// otherwise match.

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const force = args.includes('--force')
const portArg = args.find((a) => !a.startsWith('--'))

const port = Number(portArg ?? 5173)
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`free-port: "${portArg}" is not a valid port`)
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

const describe = (pid) => {
  const cmd = (byPid.get(pid)?.cmd ?? '').slice(0, 70).trim()
  return cmd ? `${pid} (${cmd})` : `${pid}`
}

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

// --- what is in the way -------------------------------------------------------

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

function listenersOn(port) {
  const pids = new Set()

  if (process.platform === 'win32') {
    // Columns: Proto  LocalAddress  ForeignAddress  State  PID
    for (const line of sh('netstat', ['-ano', '-p', 'TCP']).split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 5 || cols[3] !== 'LISTENING') continue
      // Match the port exactly, so :5173 does not also match :51730.
      if (!new RegExp(`:${port}$`).test(cols[1])) continue
      pids.add(Number(cols[4]))
    }
  } else {
    for (const pid of sh('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).split(/\r?\n/)) {
      if (pid.trim()) pids.add(Number(pid.trim()))
    }
  }

  pids.delete(0) // the System idle process is never ours
  return [...pids].filter((p) => !protectedPids.has(p))
}

const holders = listenersOn(port)

// --- report, or reclaim -------------------------------------------------------

if (!force) {
  for (const pid of holders) {
    const mine = isProjectVite(byPid.get(pid)?.cmd ?? '')
    console.error(
      `free-port: ${port} is held by ${describe(pid)}` +
        (mine ? ' — a stale dev server for this project' : ' — NOT a process from this project'),
    )
  }
  if (stale.size > 0) {
    console.error(`free-port: ${stale.size} stale dev process(es) from this project: ${[...stale].join(', ')}`)
  }

  if (holders.length > 0) {
    // strictPort would fail a second from now anyway; fail here, where the
    // message can say who is responsible and what to do about it.
    console.error(
      `free-port: not killing anything. Check the process above, then either ` +
        `\`npm run dev:force\` (reclaim ${port} and start the server) or ` +
        `\`npm run dev:clean\` (reclaim only).`,
    )
    process.exit(1)
  }

  if (stale.size > 0) {
    // Nothing holds the port, so dev can start; these are only leaked processes.
    // Say so plainly, and name a command that *only* reaps them — whoever reads
    // this (person or agent) wanted to start a dev server, not another one.
    console.warn('free-port: the port is free, so dev can start — but these are leaked and worth reaping.')
    console.warn('free-port: run `npm run dev:clean` to kill them without starting a server.')
  } else {
    console.log(`free-port: ${port} is free, no stale dev processes`)
  }
  process.exit(0)
}

for (const pid of stale) {
  kill(pid)
  console.log(`free-port: killed stale dev process ${describe(pid)}`)
}

for (const pid of holders) {
  kill(pid)
  console.log(`free-port: killed ${describe(pid)} holding ${port}`)
}

// Confirm, so a failure to reclaim is loud rather than a confusing strictPort
// error a second later.
const survivors = listenersOn(port)
if (survivors.length > 0) {
  console.error(`free-port: ${port} is STILL held by ${survivors.join(', ')} — free it manually`)
  process.exit(1)
}

if (stale.size === 0 && holders.length === 0) console.log(`free-port: ${port} is free, no stale dev processes`)
