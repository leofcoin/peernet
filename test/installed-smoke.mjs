import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { homedir } from 'node:os'
import Peernet, { PeernetArchiveMode } from '@leofcoin/peernet'
import { CodecHash } from '@leofcoin/codec-format-interface'

const entry = import.meta.resolve('@leofcoin/peernet')
const manifest = JSON.parse(await readFile(new URL('../package.json', entry), 'utf8'))
assert.equal(manifest.version, '3.0.0')
assert.equal(manifest.dependencies['@netpeer/swarm'], '^0.10.0')
const swarmEntry = import.meta.resolve('@netpeer/swarm/client')
const swarmManifest = JSON.parse(await readFile(new URL('../package.json', swarmEntry), 'utf8'))
assert.match(swarmManifest.version, /^0\.10\./)
assert.equal(typeof (await import('@netpeer/swarm/client')).default, 'function')
assert.equal(typeof PeernetArchiveMode, 'function')
const peer = await new Peernet({
  network: 'leofcoin:peach', version: '0.4.0', stars: [],
  // Storage resolves roots below homedir. Normalize the temporary absolute
  // target as the launcher does, so no test account escapes the temp directory.
  root: relative(homedir(), join(process.cwd(), 'ephemeral-identity')), autoStart: false, freshIdentity: true
}, 'ephemeral-package-test-password')
assert.ok(peer.id)
assert.ok(peer.selectedAccount)
assert.equal(typeof peer.createArchiveMode, 'function')
assert.equal(globalThis.walletStore.db.root, join(process.cwd(), 'ephemeral-identity'))
const message = new peer.protos['peernet-ps']({ data: new Uint8Array([1, 2, 3]), topic: new Uint8Array([4]) })
const hash = new CodecHash()
hash.fromBs32(await message.hash())
assert.equal(hash.name, 'peernet-ps')
assert.deepEqual(hash.encoded, new Uint8Array([...hash.codec, ...hash.length, ...hash.digest]))
// Loading the browser entry replaces global storage adapters. Only check that
// entry after Node initialization, never construct a Node identity with it.
assert.equal(typeof (await import('@leofcoin/peernet/browser')).default, 'function')
console.log('STANDALONE_PEERNET_READY: 3.0.0 with swarm ' + swarmManifest.version)
process.exit(0)
