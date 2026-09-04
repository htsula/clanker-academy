import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

function readJson(relative: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relative), 'utf8'))
}

// The minimal allowlist, decided at step 4 while the surface was empty. This is
// a deliberate subset of `core:default` — app, event, webview and window
// defaults only, dropping the image/menu/path/resources/tray defaults the
// blanket set would grant. WIDENING THIS LIST MEANS UPDATING THIS TEST ON
// PURPOSE — it is the whole point of the assertion (see README).
const EXPECTED_CAPABILITIES = [
  'core:app:default',
  'core:event:default',
  'core:webview:default',
  'core:window:default',
]

describe('Tauri security config (D9 config assertion)', () => {
  it('allowlists exactly the expected capabilities', () => {
    const caps = readJson('src-tauri/capabilities/default.json') as { permissions: string[] }
    expect(caps.permissions).toEqual(EXPECTED_CAPABILITIES)
  })

  it('declares no Tauri commands and no plugins in the Rust source', () => {
    const lib = readFileSync(resolve(root, 'src-tauri/src/lib.rs'), 'utf8')
    const main = readFileSync(resolve(root, 'src-tauri/src/main.rs'), 'utf8')
    for (const source of [lib, main]) {
      expect(source).not.toMatch(/tauri::command/)
      expect(source).not.toMatch(/invoke_handler/)
      expect(source).not.toMatch(/\.plugin\(/)
    }
  })

  it('registers no plugins in the config', () => {
    const config = readJson('src-tauri/tauri.conf.json') as Record<string, unknown>
    const app = config.app as Record<string, unknown>
    expect(app.plugins).toBeUndefined()
    expect(config.plugins).toBeUndefined()
  })

  it('sets a strict CSP with no remote connect and exactly self as the script source', () => {
    const config = readJson('src-tauri/tauri.conf.json') as {
      app: { security: { csp: string } }
    }
    const csp = config.app.security.csp
    expect(typeof csp).toBe('string')

    const scriptDirective = csp.match(/script-src[^;]*/)?.at(0) ?? ''
    const defaultDirective = csp.match(/default-src[^;]*/)?.at(0) ?? ''

    const scriptSources = (scriptDirective + ' ' + defaultDirective)
      .split(/\s+/)
      .filter((s) => s !== '' && s !== 'script-src' && s !== 'default-src')
    expect(scriptSources).toEqual(["'self'"])

    const connectSources = (csp.match(/connect-src[^;]*/)?.at(0) ?? 'connect-src ').split(/\s+/)
    expect(connectSources.filter((s) => s.startsWith('http:') || s.startsWith('https:') || s.startsWith('ws:') || s.startsWith('wss:'))).toEqual(['http://ipc.localhost'])
  })
})