// Test the actual package allow-list and registry resolution, not a workspace or
// node_modules symlink. Run after `npm run build`; reuse its verified artifacts.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('..', import.meta.url))
if (!existsSync(join(project, 'exports', 'peernet.js'))) throw new Error('run npm run build before test:package')
const temporary = mkdtempSync(join(tmpdir(), 'peernet-package-test-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (command, args, cwd, timeout = 120_000) => execFileSync(command, args, { cwd, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
try {
  const [packed] = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', temporary], project))
  assert.equal(packed.version, '3.0.0')
  assert.ok(packed.files.some(file => file.path === 'exports/peernet.js'))
  assert.ok(packed.files.every(file => !/^(?:src|test|node_modules)\//.test(file.path)), 'development files must not be published')
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  // Do not run dependency installation hooks merely to check packaging. Native
  // QUIC is verified separately; fresh identity/hash creation needs no relay.
  run(npm, ['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', join(temporary, packed.filename)], temporary)
  const output = run(process.execPath, ['--input-type=module', '-e', readFileSync(new URL('./installed-smoke.mjs', import.meta.url), 'utf8')], temporary, 30_000)
  assert.match(output, /STANDALONE_PEERNET_READY/)
  const lock = JSON.parse(readFileSync(join(temporary, 'package-lock.json'), 'utf8'))
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (name === 'node_modules/@leofcoin/peernet') continue // the artifact under test
    assert.ok(!/^(git\+|git:|github:|file:)/.test(entry.resolved ?? ''), name)
  }
  console.log(output.trim())
  console.log('PASS: clean standalone npm installation; registry-only transitive dependencies')
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
