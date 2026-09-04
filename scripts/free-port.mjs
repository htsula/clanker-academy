// Free a TCP port before the dev server starts.
//
// tauri.conf.json hardcodes devUrl http://localhost:5173. Vite's default is to
// drift to the next free port when 5173 is taken, which means the Tauri window
// silently loads whatever *older* server still holds 5173 — a stale build
// presented as the current one. vite.config.ts sets strictPort so that drift
// becomes a hard failure; this script removes the usual cause of that failure
// by reclaiming the port from a previous run.
//
// Only processes actually LISTENING on the port are touched.

import { execFileSync } from 'node:child_process'

const port = Number(process.argv[2] ?? 5173)
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`free-port: "${process.argv[2]}" is not a valid port`)
  process.exit(1)
}

function sh(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return '' // no match, or the tool is absent — both mean "nothing to free"
  }
}

// Returns the PIDs listening on `port`, as strings.
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
  return [...pids]
}

const pids = listenersOn(port)
if (pids.length === 0) {
  console.log(`free-port: ${port} is free`)
  process.exit(0)
}

for (const pid of pids) {
  if (process.platform === 'win32') {
    sh('taskkill', ['/PID', pid, '/T', '/F'])
  } else {
    sh('kill', ['-9', pid])
  }
  console.log(`free-port: killed PID ${pid} holding ${port}`)
}

// Confirm, so a failure to reclaim is loud rather than a confusing strictPort
// error a second later.
const survivors = listenersOn(port)
if (survivors.length > 0) {
  console.error(`free-port: ${port} is STILL held by ${survivors.join(', ')} — free it manually`)
  process.exit(1)
}
